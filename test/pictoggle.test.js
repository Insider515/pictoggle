// Minimal smoke tests for the programmatic API. They run under Node's built-in
// test runner (`npm test`). We stub a bare-bones DOM so the module can execute
// without jsdom. These tests only cover behaviour the pure API controls — the
// Web Component path is browser-only and demonstrated by examples/index.html.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ----- tiny DOM stub -----------------------------------------------------
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; },
      removeProperty: (k) => { delete this.style[k]; },
    };
    this.classList = { add: () => {}, remove: () => {} };
    this._listeners = {};
    this.disabled = false;
    this.checked = false;
    this.indeterminate = false;
    this.loading = '';
    this.decoding = '';
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  append(...nodes) { for (const n of nodes) this.children.push(n); }
  appendChild(node) { this.children.push(node); return node; }
  remove() { /* no-op */ }
  querySelector(sel) {
    if (sel === 'input') return this.children.find(c => c.tagName === 'INPUT') || null;
    if (sel === 'img') return this.children.find(c => c.tagName === 'IMG') || null;
    return null;
  }
  addEventListener(name, cb) { (this._listeners[name] ||= []).push(cb); }
  removeEventListener(name, cb) {
    const list = this._listeners[name]; if (!list) return;
    const i = list.indexOf(cb); if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(event) { (this._listeners[event.type] || []).forEach(cb => cb(event)); }
}

globalThis.document = {
  createElement: (tag) => new El(tag),
  head: new El('head'),
  documentElement: new El('html'),
};
globalThis.Event = class { constructor(type) { this.type = type; } };

// Import AFTER the stub is in place so the module sees `document`.
const { createPicToggle } = await import('../src/pictoggle.js');

test('creates a control with the expected default state', () => {
  // The dataset attribute is only present when the state is "on" (checked /
  // indeterminate / disabled / image-error). In the default state nothing is
  // reflected, so the CSS selector `[data-checked="true"]` naturally matches
  // only the active state. Querying for inactive is `:not([data-checked])`.
  const c = createPicToggle({ src: '/img/a.svg', label: 'A' });
  assert.equal(c.getChecked(), false);
  assert.equal(c.dataset.checked, undefined);
  assert.equal(c.dataset.position, 'right');
});

test('initial checked option is honoured', () => {
  const c = createPicToggle({ src: '/img/a.svg', checked: true });
  assert.equal(c.getChecked(), true);
  assert.equal(c.dataset.checked, 'true');
});

test('onChange fires when the inner input toggles', () => {
  let calls = 0; let last = null;
  const c = createPicToggle({ src: '/img/a.svg', onChange: (v) => { calls++; last = v; } });
  const input = c.querySelector('input');
  input.checked = true;
  input.dispatchEvent(new Event('change'));
  assert.equal(calls, 1);
  assert.equal(last, true);
  assert.equal(c.dataset.checked, 'true');
});

test('silent setChecked does not fire onChange', () => {
  let calls = 0;
  const c = createPicToggle({ src: '/img/a.svg', onChange: () => { calls++; } });
  c.setChecked(true, { silent: true });
  assert.equal(calls, 0);
  assert.equal(c.getChecked(), true);
});

test('extra attributes split between input and wrapper', () => {
  const c = createPicToggle({
    src: '/img/a.svg',
    attributes: { name: 'cat', value: 'x', title: 'hi', 'data-x': '1' },
  });
  const input = c.querySelector('input');
  assert.equal(input.getAttribute('name'), 'cat');
  assert.equal(input.getAttribute('value'), 'x');
  assert.equal(c.getAttribute('title'), 'hi');
  assert.equal(c.getAttribute('data-x'), '1');
});

test('label position falls back to right on invalid value', () => {
  const c = createPicToggle({ src: '/img/a.svg', labelPosition: 'nope' });
  assert.equal(c.dataset.position, 'right');
});

test('size accepts numbers and strings', () => {
  const c = createPicToggle({ src: '/img/a.svg', size: 72 });
  assert.equal(c.style['--pt-size'], '72px');
  c.setSize('3rem');
  assert.equal(c.style['--pt-size'], '3rem');
});

test('size as bare digit string (from HTML attribute) gets px appended', () => {
  // Regression: HTML attributes always deliver strings; "48" without a unit
  // must become "48px" or `width: var(--pt-size)` is invalid and the image
  // falls back to its intrinsic dimensions.
  const c = createPicToggle({ src: '/img/a.svg', size: '48' });
  assert.equal(c.style['--pt-size'], '48px');
  c.setSize('32');
  assert.equal(c.style['--pt-size'], '32px');
});

test('setChecked on the same value is a no-op (no change event)', () => {
  // Matches native HTMLInputElement semantics: assigning the current value does
  // not dispatch `change`.
  let calls = 0;
  const c = createPicToggle({ src: '/img/a.svg', checked: true, onChange: () => { calls++; } });
  c.setChecked(true);  // already true
  c.setChecked(true);  // still no-op
  assert.equal(calls, 0);
  c.setChecked(false); // actual transition
  assert.equal(calls, 1);
});

test('setIndeterminate flips state and clears on setChecked', () => {
  const c = createPicToggle({ src: '/img/a.svg' });
  c.setIndeterminate(true);
  assert.equal(c.getIndeterminate(), true);
  assert.equal(c.dataset.indeterminate, 'true');
  // Native behaviour: setting checked to a NEW value clears indeterminate.
  c.setChecked(true);
  assert.equal(c.getIndeterminate(), false);
  assert.equal(c.dataset.indeterminate, undefined);
});

test('setChecked to the same value preserves indeterminate (native parity)', () => {
  // Regression: Native HTMLInputElement does not clear `indeterminate` when
  // `.checked = .checked` is a no-op. Our tri-state demo relies on this.
  const c = createPicToggle({ src: '/img/a.svg', checked: false });
  c.setIndeterminate(true);
  c.setChecked(false); // no-op
  assert.equal(c.getIndeterminate(), true);
});

test('img error dispatches callback and sets data-image-error', () => {
  let errorEvent = null;
  const c = createPicToggle({ src: '/img/broken.png', onError: (e) => { errorEvent = e; } });
  const img = c.querySelector('img');
  img.dispatchEvent(new Event('error'));
  assert.equal(c.getImageError(), true);
  assert.equal(c.dataset.imageError, 'true');
  assert.ok(errorEvent !== null);
});

test('img error clears when image reloads successfully', () => {
  const c = createPicToggle({ src: '/img/x.png' });
  const img = c.querySelector('img');
  img.dispatchEvent(new Event('error'));
  assert.equal(c.getImageError(), true);
  img.dispatchEvent(new Event('load'));
  assert.equal(c.getImageError(), false);
});

test('img is marked for lazy, async decoding', () => {
  const c = createPicToggle({ src: '/img/a.svg' });
  const img = c.querySelector('img');
  assert.equal(img.loading, 'lazy');
  assert.equal(img.decoding, 'async');
});

test('setSrc clears the previous error state', () => {
  const c = createPicToggle({ src: '/img/broken.png' });
  c.querySelector('img').dispatchEvent(new Event('error'));
  assert.equal(c.getImageError(), true);
  c.setSrc('/img/fine.png');
  assert.equal(c.getImageError(), false);
});

test('coerceSize via setSize accepts rem/em/% strings unchanged', () => {
  const c = createPicToggle({ src: '/img/a.svg' });
  for (const [input, expected] of [
    ['3rem', '3rem'], ['2em', '2em'], ['50%', '50%'],
    ['clamp(32px, 10vw, 96px)', 'clamp(32px, 10vw, 96px)'],
    ['  40  ', '40px'],
  ]) {
    c.setSize(input);
    assert.equal(c.style['--pt-size'], expected);
  }
});
