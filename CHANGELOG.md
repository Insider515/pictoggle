# Changelog

All notable changes to **pictoggle** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-23

Initial public release.

### Features
- `<pic-toggle>` form-associated custom element — behaves like a native
  `<input type="checkbox">`: participates in `FormData`, honours `required`
  validation, responds to `form.reset()`, restores state on back/forward,
  propagates `<fieldset disabled>`.
- `createPicToggle(options)` — standalone factory that returns a DOM element
  wrapping a real `<input type="checkbox">`, usable without the custom
  element.
- Image sources: PNG, SVG, WebP, GIF, AVIF — anything the browser `<img>` can
  decode. Default visual contract is grayscale → full colour on check.
- Label positions: `left`, `right`, `top`, `bottom`, `none` (icon-only).
- `indeterminate` state with its own visual style and `aria-checked="mixed"`.
- Image load failure handling: `image-error` event, `onError` callback,
  `data-image-error` attribute for CSS targeting, dashed placeholder outline.
- Rich label content via the default `<slot>`.
- Public CSS custom properties for size, gap, radius, opacity, filter and
  focus ring — override anywhere in the cascade.
- Automatic adaptations: `prefers-reduced-motion`, `prefers-color-scheme`,
  `forced-colors` (Windows High Contrast) and `@media print`.
- RTL layout via logical margins (`margin-inline-*`, `margin-block-*`).
- Lazy image loading (`loading="lazy"`) and async decoding
  (`decoding="async"`) out of the box.
- Full `HTMLInputElement`-style surface: `.checked`, `.indeterminate`,
  `.disabled`, `.required`, `.name`, `.value`, `.type`, `.defaultChecked`,
  `.form`, `.labels`, `.validity`, `.validationMessage`, `.willValidate`,
  `.checkValidity()`, `.reportValidity()`, `.setCustomValidity()`.
- Fallback hidden `<input>` on browsers that do not implement
  `ElementInternals` (Safari < 16.4).
- TypeScript typings bundled; JSX intrinsic typing for React 19+.
- Zero runtime dependencies, zero build step. The whole module is a single
  self-contained ES file (~30 kB).
