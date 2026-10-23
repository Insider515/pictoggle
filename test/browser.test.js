// Integration tests that run the component in a real browser via headless
// Chrome. No external dev dependency (Playwright, Puppeteer): we just spawn
// `google-chrome --headless --dump-dom` against a tiny Node HTTP server that
// serves the package sources.
//
// Skipped automatically when no Chrome/Chromium binary is found, so this suite
// never blocks `npm test` on a machine without a browser.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// -------------------------------------------------------------------------
// 1. Locate a Chrome/Chromium binary. Return null if none is installed.
// -------------------------------------------------------------------------
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (existsSync(p) && statSync(p).isFile()) return p; } catch { /* ignore */ }
  }
  return null;
}

const CHROME = findChrome();
const SKIP = !CHROME;

// -------------------------------------------------------------------------
// 2. Minimal static HTTP server over the project root.
// -------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.json': 'application/json',
};
let server, port;
before(async () => {
  if (SKIP) return;
  server = createServer((req, res) => {
    // Reject any attempt to escape the project root.
    const safe = req.url.split('?')[0].replace(/\.\./g, '');
    const file = join(ROOT, safe);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
});

// -------------------------------------------------------------------------
// 3. Helper: load a HTML page in headless Chrome and return the DOM text.
// -------------------------------------------------------------------------
async function runPage(html) {
  // Chrome headless treats data: URLs as cross-origin for ES-modules, so write
  // the ad-hoc page to a real file inside the project root (the HTTP server
  // serves from there) and remove it when done.
  const name = `_browser_test_${Date.now()}_${Math.random().toString(36).slice(2)}.html`;
  const path = join(ROOT, name);
  const url = `http://127.0.0.1:${port}/${name}`;
  const fs = await import('node:fs/promises');
  await fs.writeFile(path, html);
  try {
    return await new Promise((resolve, reject) => {
      const p = spawn(CHROME, [
        '--headless', '--disable-gpu', '--no-sandbox',
        '--virtual-time-budget=15000',
        '--dump-dom', url,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      p.stdout.on('data', (b) => { out += b; });
      p.stderr.on('data', (b) => { err += b; });
      let killed = false;
      const timer = setTimeout(() => { killed = true; p.kill('SIGKILL'); }, 25_000);
      p.on('close', (code) => {
        clearTimeout(timer);
        if (killed) reject(new Error('chrome timeout'));
        else if (code === 0) resolve(out);
        else reject(new Error(`chrome exit ${code}: ${err}`));
      });
    });
  } finally {
    await fs.unlink(path).catch(() => {});
  }
}

// Extract the text content of #out from a dumped DOM.
function extract(dom) {
  const m = dom.match(/<pre id="out"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) throw new Error('no <pre id="out"> in page');
  return m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}

// Shared page scaffold: imports the module, waits for upgrade, runs `body(nodes)`
// and writes the JSON-ified result into #out.
function pageWith(body) {
  return `<!doctype html><html><body>
    <form id="f">
      <pic-toggle id="a" src="/src/pictoggle.js" label="A"  name="g" value="a" checked></pic-toggle>
      <pic-toggle id="b" src="/src/pictoggle.js" label="B"  name="g" value="b"></pic-toggle>
      <pic-toggle id="c" src="/src/pictoggle.js" label="C"  name="agree" value="yes" required></pic-toggle>
      <pic-toggle id="d" src="/does/not/exist.png"    label="D"></pic-toggle>
    </form>
    <pre id="out"></pre>
    <script type="module">
      import '/src/pictoggle.js';
      await customElements.whenDefined('pic-toggle');
      await new Promise(r => setTimeout(r, 300));
      try {
        const result = (${body.toString()})(document.querySelectorAll('pic-toggle'), document.getElementById('f'));
        const payload = result && typeof result.then === 'function' ? await result : result;
        document.getElementById('out').textContent = JSON.stringify(payload);
      } catch (err) {
        document.getElementById('out').textContent = JSON.stringify({ error: String(err && err.stack || err) });
      }
    </script>
  </body></html>`;
}

// -------------------------------------------------------------------------
// 4. Actual tests.
// -------------------------------------------------------------------------

test('browser: form-associated FormData reflects checked boxes', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes, form) => {
    const fd = () => [...new FormData(form).entries()];
    const initial = fd();
    nodes[1].checked = true;
    const afterCheck = fd();
    nodes[2].checked = true;
    const afterRequired = fd();
    return { initial, afterCheck, afterRequired };
  }));
  const data = JSON.parse(extract(dom));
  assert.deepEqual(data.initial, [['g', 'a']]);
  assert.deepEqual(data.afterCheck, [['g', 'a'], ['g', 'b']]);
  assert.deepEqual(data.afterRequired, [['g', 'a'], ['g', 'b'], ['agree', 'yes']]);
});

test('browser: required blocks form.checkValidity until agreed', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes, form) => ({
    before: form.checkValidity(),
    nodeCreditValidity: nodes[2].checkValidity(),
    valueMissing: nodes[2].validity && nodes[2].validity.valueMissing,
    nowSet: (nodes[2].checked = true, form.checkValidity()),
  })));
  const data = JSON.parse(extract(dom));
  assert.equal(data.before, false);
  assert.equal(data.nodeCreditValidity, false);
  assert.equal(data.valueMissing, true);
  assert.equal(data.nowSet, true);
});

test('browser: form.reset() restores initial checked and clears indeterminate', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes, form) => {
    nodes[1].checked = true;
    nodes[0].indeterminate = true;
    form.reset();
    return {
      a_checked: nodes[0].checked, a_indeterminate: nodes[0].indeterminate,
      b_checked: nodes[1].checked,
    };
  }));
  const data = JSON.parse(extract(dom));
  assert.deepEqual(data, { a_checked: true, a_indeterminate: false, b_checked: false });
});

test('browser: aria-checked reflects state including mixed', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes) => {
    nodes[1].indeterminate = true;
    return {
      a: nodes[0].getAttribute('aria-checked'),
      b: nodes[1].getAttribute('aria-checked'),
      role: nodes[0].getAttribute('role'),
    };
  }));
  const data = JSON.parse(extract(dom));
  assert.equal(data.a, 'true');
  assert.equal(data.b, 'mixed');
  assert.equal(data.role, 'checkbox');
});

test('browser: image-error event fires for a broken src', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes) => new Promise((resolve) => {
    const d = nodes[3];
    let fired = false;
    d.addEventListener('image-error', () => { fired = true; });
    // If the image already errored before we subscribed, consider it fired.
    if (d.imageError) fired = true;
    // Give the browser enough time to resolve the 404 and dispatch the error.
    setTimeout(() => resolve({ fired, imageError: d.imageError }), 3000);
  })));
  const data = JSON.parse(extract(dom));
  assert.equal(data.imageError, true);
  assert.equal(data.fired, true);
});

test('browser: Enter key does NOT toggle (native checkbox parity)', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes) => {
    const n = nodes[1]; // starts unchecked
    const before = n.checked;
    n.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    const after = n.checked;
    return { before, after };
  }));
  const data = JSON.parse(extract(dom));
  assert.equal(data.before, false);
  assert.equal(data.after, false);
});

test('browser: Space key toggles', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes) => {
    const n = nodes[1];
    const before = n.checked;
    n.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    const after = n.checked;
    return { before, after };
  }));
  const data = JSON.parse(extract(dom));
  assert.equal(data.before, false);
  assert.equal(data.after, true);
});

test('browser: image rendered dimensions honour the size attribute', { skip: SKIP }, async () => {
  const dom = await runPage(pageWith((nodes) => {
    nodes[0].setAttribute('size', '64');
    const img = nodes[0].shadowRoot.querySelector('img');
    const cs = getComputedStyle(img);
    return { width: cs.width, height: cs.height };
  }));
  const data = JSON.parse(extract(dom));
  assert.equal(data.width, '64px');
  assert.equal(data.height, '64px');
});
