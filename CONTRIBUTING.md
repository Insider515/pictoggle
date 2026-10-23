# Contributing to pictoggle

Thanks for taking the time to look. This package has no runtime dependencies
and no build step, so getting started is quick.

## Prerequisites

- **Node.js ≥ 18** (uses the built-in `node --test` runner).
- **Chrome/Chromium** (optional) — for the integration test suite. The suite
  is skipped automatically if no browser binary is found. Set `CHROME_BIN` to
  point at a specific binary.

## Development loop

```bash
git clone https://github.com/Insider515/pictoggle.git
cd pictoggle
npm run test:unit       # fast: pure-Node DOM stub tests
npm run test:browser    # headless Chrome; requires Chrome/Chromium
npm test                # both
```

Browse the demo with any static HTTP server:

```bash
cd pictoggle
python3 -m http.server 8080
# open http://localhost:8080/examples/
```

## Source layout

```
src/
  pictoggle.js    — the whole module (zero deps, pure ES).
  pictoggle.d.ts  — public typings + JSX intrinsic for React 19+.
test/
  pictoggle.test.js — unit tests on a Node DOM stub.
  browser.test.js        — form-associated behaviour in headless Chrome.
examples/
  index.html           — hand-run demo of every feature.
```

## Coding guidelines

- No runtime dependencies. Ever. This is the whole point of the package.
- No build step. The package ships the file in `src/` as-is.
- Prefer standard DOM APIs; no polyfills.
- Keep the single `src/pictoggle.js` file self-contained — a user can
  copy-paste it into their project if they want to.
- Comments explain **why**, not **what**.
- Each `createPicToggle` option and each public method on
  `PicToggleElement` must have a type in `.d.ts`.

## Testing conventions

- Every bug fix lands with a regression test.
- Prefer unit tests (fast, no browser) when the behaviour can be exercised
  through the pure DOM stub.
- Form-associated / ARIA / layout behaviour belongs in `browser.test.js`.
- Browser tests must `{ skip: SKIP }` so CI passes on hosts without Chrome.

## Releasing

1. `npm test` must be green with Chrome available locally.
2. Bump the `version` in `package.json`.
3. Add an entry to `CHANGELOG.md` under a new `[x.y.z] — YYYY-MM-DD` heading.
4. `git tag vX.Y.Z && git push --tags`.
5. `npm publish --access public`.

## Reporting issues

Please include:
- Browser + version (or Node + version for the API form).
- A minimal reproduction — ideally a single HTML file.
- What you expected vs. what happened.
