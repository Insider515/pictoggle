/**
 * pictoggle
 * ---------------------------------------------------------------
 * Zero-dependency image checkbox control.
 *
 * Two interchangeable APIs:
 *   1. `createPicToggle(options)` — a function that returns a DOM element
 *      with helper methods. Builds a real `<input type="checkbox">` in light
 *      DOM so it participates in forms out of the box.
 *   2. `<pic-toggle>` — a form-associated custom element. The host itself
 *      is the checkbox (via `ElementInternals`); it supplies the real control
 *      APIs of `HTMLInputElement` and renders its visuals inside Shadow DOM.
 *
 * Visuals are driven entirely by CSS variables and the `filter` property, so
 * PNG, SVG, WebP, GIF and AVIF behave identically.
 */

/* -------------------------------------------------------------------------- */
/*  Stylesheet                                                                */
/* -------------------------------------------------------------------------- */

// All sizes/colors/filters are read as `var(--pt-X, DEFAULT)` so that an
// override declared on any ancestor (:root, a parent class, the host itself)
// wins through the normal CSS cascade. No `--pt-X` is ever declared on the
// control — doing so would block inherited overrides.
//
// Where the same `--pt-X` is read in several places, we assign it once to a
// private `--_pt-X` alias on `.pic-toggle` and consume that. This keeps the
// `DEFAULT` literal in exactly one spot without re-declaring the public token.
const RULES = `
  .pic-toggle {
    /* Private aliases: resolve each public --pt-X token exactly once with
       its default, then consume the alias everywhere below. */
    --_pt-size: var(--pt-size, 48px);
    --_pt-gap:  var(--pt-gap,  10px);
    display: inline-flex;
    align-items: center;
    gap: var(--_pt-gap);
    cursor: pointer;
    user-select: none;
    font: inherit;
    color: inherit;
    line-height: 1.2;
    vertical-align: middle;
    box-sizing: border-box;
  }
  .pic-toggle[data-disabled="true"] { cursor: not-allowed; opacity: 0.6; }
  .pic-toggle__input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .pic-toggle__image {
    width:  var(--_pt-size);
    height: var(--_pt-size);
    object-fit: contain;
    border-radius: var(--pt-radius, 6px);
    display: block;
    flex: 0 0 auto;
    filter:  var(--pt-inactive-filter, grayscale(1));
    opacity: var(--pt-inactive-opacity, 0.55);
    transition: filter var(--pt-transition, 150ms ease), opacity var(--pt-transition, 150ms ease);
  }
  .pic-toggle[data-checked="true"] .pic-toggle__image {
    filter:  var(--pt-active-filter, none);
    opacity: var(--pt-active-opacity, 1);
  }
  .pic-toggle[data-indeterminate="true"] .pic-toggle__image {
    filter:  var(--pt-indeterminate-filter, grayscale(0.5));
    opacity: var(--pt-indeterminate-opacity, 0.75);
  }
  /* Hover brightens the inactive state so users notice the control is interactive. */
  .pic-toggle:not([data-checked="true"]):not([data-indeterminate="true"]):not([data-disabled="true"]):hover .pic-toggle__image {
    opacity: var(--pt-hover-opacity, 0.8);
  }
  /* Keyboard focus ring in light-DOM usage. The Shadow variant (:host(:focus-visible)) lives in SHADOW_FOCUS below. */
  .pic-toggle__input:focus-visible + .pic-toggle__image {
    outline: var(--pt-focus-ring, 2px solid #4c9ffe);
    outline-offset: var(--pt-focus-ring-offset, 2px);
  }
  /* Broken image placeholder — box stays, we show a subtle dashed frame. */
  .pic-toggle[data-image-error="true"] .pic-toggle__image {
    outline: 1px dashed currentColor;
    outline-offset: -1px;
    opacity: 0.3;
  }
  .pic-toggle__label {
    font: inherit;
    color: inherit;
    flex: 0 0 auto;
  }
  /* Logical margins — adapt automatically under dir="rtl". */
  .pic-toggle[data-position="right"]  { flex-direction: row; }
  .pic-toggle[data-position="right"]  .pic-toggle__label { margin: 0; margin-inline-start: var(--_pt-gap); }
  .pic-toggle[data-position="left"]   { flex-direction: row-reverse; }
  .pic-toggle[data-position="left"]   .pic-toggle__label { margin: 0; margin-inline-end:   var(--_pt-gap); }
  .pic-toggle[data-position="top"]    { flex-direction: column-reverse; align-items: center; }
  .pic-toggle[data-position="top"]    .pic-toggle__label { margin: 0; margin-block-end:    var(--_pt-gap); }
  .pic-toggle[data-position="bottom"] { flex-direction: column; align-items: center; }
  .pic-toggle[data-position="bottom"] .pic-toggle__label { margin: 0; margin-block-start:  var(--_pt-gap); }
  .pic-toggle[data-position="none"]   .pic-toggle__label { display: none; margin: 0; }

  /* Respect the user's "reduce motion" OS setting. */
  @media (prefers-reduced-motion: reduce) {
    .pic-toggle__image { transition: none; }
  }
  /* Keep the image legible when printed: no desaturation. */
  @media print {
    .pic-toggle__image { filter: none !important; opacity: 1 !important; }
  }
  /* Windows High Contrast / forced-colors — fall back to system colors. */
  @media (forced-colors: active) {
    .pic-toggle__image { filter: none; }
    .pic-toggle__input:focus-visible + .pic-toggle__image { outline: 2px solid Highlight; }
    .pic-toggle[data-checked="true"] .pic-toggle__image { outline: 2px solid CanvasText; outline-offset: 2px; }
    .pic-toggle[data-indeterminate="true"] .pic-toggle__image { outline: 2px dashed CanvasText; outline-offset: 2px; }
  }
`;

// Shadow-only focus rules — `:host(...)` matches nothing in a light-DOM
// document, so they live outside RULES to keep the document stylesheet lean.
const SHADOW_FOCUS = `
  :host(:focus-visible) .pic-toggle__image {
    outline: var(--pt-focus-ring, 2px solid #4c9ffe);
    outline-offset: var(--pt-focus-ring-offset, 2px);
  }
  @media (forced-colors: active) {
    :host(:focus-visible) .pic-toggle__image { outline: 2px solid Highlight; }
  }
`;

// Host-only rules for Shadow usage. The host participates in the page's own
// cascade; the rules above live inside the shadow root.
const SHADOW_HOST = `
  :host              { display: inline-block; vertical-align: middle; }
  :host([hidden])    { display: none; }
  :host([disabled])  { cursor: not-allowed; opacity: 0.6; }
`;

const SHADOW_STYLE   = SHADOW_HOST + RULES + SHADOW_FOCUS;
const DOCUMENT_STYLE = RULES;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const VALID_POSITIONS = new Set(['left', 'right', 'top', 'bottom', 'none']);

// Attributes that must go on the hidden <input type="checkbox"> rather than on
// the outer wrapper (so they participate in forms and keyboard semantics).
const INPUT_ATTRIBUTES = new Set([
  'name', 'value', 'form', 'required', 'autofocus', 'tabindex',
]);

// Coerce the `size` option to a CSS length. A bare number (JS number OR a
// string of digits, which is what HTML attributes always deliver) is treated
// as pixels. Any string with an explicit unit or a CSS function is passed
// through unchanged.
function coerceSize(size) {
  if (size == null || size === '') return null;
  if (typeof size === 'number' && Number.isFinite(size)) return `${size}px`;
  const str = String(size).trim();
  if (str === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(str)) return `${str}px`;
  return str;
}

// Make sure the document stylesheet is injected exactly once per document for
// the programmatic (non-Web-Component) form.
const INJECTED_DOCS = new WeakSet();
function ensureStylesheet(doc) {
  if (!doc || INJECTED_DOCS.has(doc)) return;
  const style = doc.createElement('style');
  style.setAttribute('data-pictoggle', '');
  style.textContent = DOCUMENT_STYLE;
  const head = doc.head || doc.documentElement;
  if (head) head.appendChild(style);
  INJECTED_DOCS.add(doc);
}

// Route arbitrary extra attributes to the correct target. Form-control
// attributes go on the inner <input>, everything else (`data-*`, `aria-*`,
// `title`, `id`, …) on the outer wrapper. Form attributes passed when there
// is no inner input (shadow usage) are silently ignored.
function applyExtraAttributes(wrapper, input, attributes) {
  if (!attributes) return;
  for (const [key, raw] of Object.entries(attributes)) {
    if (raw == null || raw === false) continue;
    const value = raw === true ? '' : String(raw);
    if (INPUT_ATTRIBUTES.has(key)) {
      if (input) input.setAttribute(key, value);
    } else {
      wrapper.setAttribute(key, value);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Programmatic API                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Build a pic-toggle DOM element.
 * See `./pictoggle.d.ts` for the complete option and method surface.
 */
export function createPicToggle(options = {}) {
  const doc = options.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('pictoggle: no document is available in this environment.');

  ensureStylesheet(doc);

  // The light-DOM form builds a real <input type="checkbox"> so submission
  // works out of the box. The Web Component wrapper passes
  // `includeHiddenInput: false` because its host handles form participation
  // through ElementInternals.
  const includeInput = options.includeHiddenInput !== false;

  // Build the DOM.
  const wrapper = doc.createElement('label');
  wrapper.className = 'pic-toggle';

  const input = includeInput ? doc.createElement('input') : null;
  if (input) {
    input.type = 'checkbox';
    input.className = 'pic-toggle__input';
  }

  const img = doc.createElement('img');
  img.className = 'pic-toggle__image';
  img.setAttribute('draggable', 'false');
  // Native lazy-loading: the browser skips off-screen images, cutting first
  // paint cost on long lists (country pickers, catalogs, ...).
  img.loading = 'lazy';
  img.decoding = 'async';

  const text = doc.createElement('span');
  text.className = 'pic-toggle__label';
  // A <slot> inside the label span lets the Web Component expose a default
  // slot for rich label content. In a light-DOM document the slot renders
  // its own default (empty) content and does no harm.
  if (options.useSlot) text.appendChild(doc.createElement('slot'));

  if (input) wrapper.append(input, img, text);
  else wrapper.append(img, text);

  // Internal state. We keep our own flags so queries don't depend on the
  // (possibly absent) inner <input>.
  wrapper._checked = false;
  wrapper._indeterminate = false;
  wrapper._imageError = false;

  // Internal setters. Semantics mirror HTMLInputElement: assigning the current
  // value is a no-op and does NOT fire `change`.
  const setChecked = (checked, { silent = false } = {}) => {
    const next = Boolean(checked);
    const changed = wrapper._checked !== next;
    if (input && input.checked !== next) input.checked = next;
    wrapper._checked = next;
    if (next) wrapper.dataset.checked = 'true';
    else delete wrapper.dataset.checked;
    // Clearing indeterminate only on an actual value change matches native
    // HTMLInputElement: `.checked = .checked` leaves indeterminate alone.
    if (changed && wrapper._indeterminate) setIndeterminate(false, { silent: true });
    if (changed && !silent && typeof wrapper._onChange === 'function') {
      // Second arg: the DOM `Event` object when a user interaction triggered
      // the change (via `onInputChange` below); `undefined` for programmatic
      // setChecked. This mirrors how native `change` is observed.
      wrapper._onChange(next);
    }
  };
  const setIndeterminate = (value, { silent = false } = {}) => {
    const next = Boolean(value);
    const changed = wrapper._indeterminate !== next;
    wrapper._indeterminate = next;
    if (next) wrapper.dataset.indeterminate = 'true';
    else delete wrapper.dataset.indeterminate;
    if (input) input.indeterminate = next;
    if (changed && !silent && typeof wrapper._onIndeterminate === 'function') {
      wrapper._onIndeterminate(next);
    }
  };
  const setDisabled = (disabled) => {
    const next = Boolean(disabled);
    if (input) input.disabled = next;
    if (next) wrapper.dataset.disabled = 'true';
    else delete wrapper.dataset.disabled;
  };
  const setSize = (size) => {
    const value = coerceSize(size);
    if (value) wrapper.style.setProperty('--pt-size', value);
    else wrapper.style.removeProperty('--pt-size');
  };
  const setLabel = (label) => {
    text.textContent = label == null ? '' : String(label);
  };
  const setLabelPosition = (position) => {
    const next = VALID_POSITIONS.has(position) ? position : 'right';
    wrapper.dataset.position = next;
  };
  const setSrc = (src) => {
    // Reset error state so a new URL gets a fresh chance.
    wrapper._imageError = false;
    delete wrapper.dataset.imageError;
    if (src == null) img.removeAttribute('src');
    else img.setAttribute('src', String(src));
  };
  const setAlt = (alt) => {
    img.setAttribute('alt', alt == null ? '' : String(alt));
  };

  // Install callbacks BEFORE applying the initial options. Init paths are
  // silent so this is defensive, but it keeps future init-fires correct.
  wrapper._onChange = typeof options.onChange === 'function' ? options.onChange : null;
  wrapper._onError = typeof options.onError === 'function' ? options.onError : null;
  wrapper._onIndeterminate = typeof options.onIndeterminate === 'function' ? options.onIndeterminate : null;

  // Apply initial options.
  setSrc(options.src);
  setAlt(options.alt != null ? options.alt : options.label || '');
  if (!options.useSlot) setLabel(options.label);
  setLabelPosition(options.labelPosition || 'right');
  setSize(options.size);
  setDisabled(options.disabled);
  setChecked(options.checked, { silent: true });
  if (options.indeterminate) setIndeterminate(true, { silent: true });

  // Extra attributes last so a caller can override our defaults.
  applyExtraAttributes(wrapper, input, options.attributes);

  // Change event on the inner <input> is what powers keyboard activation
  // (space key on a focused checkbox).
  const onInputChange = input && ((event) => {
    const prev = wrapper._checked;
    wrapper._checked = input.checked;
    if (input.checked) wrapper.dataset.checked = 'true';
    else delete wrapper.dataset.checked;
    if (prev !== input.checked && typeof wrapper._onChange === 'function') {
      wrapper._onChange(input.checked, event);
    }
  });
  if (onInputChange) input.addEventListener('change', onInputChange);

  // Broken image handling.
  const onImageError = (event) => {
    wrapper._imageError = true;
    wrapper.dataset.imageError = 'true';
    if (typeof wrapper._onError === 'function') wrapper._onError(event);
    wrapper.dispatchEvent(new Event('image-error', { bubbles: true }));
  };
  const onImageLoad = () => {
    wrapper._imageError = false;
    delete wrapper.dataset.imageError;
  };
  img.addEventListener('error', onImageError);
  img.addEventListener('load', onImageLoad);

  // Public helpers.
  wrapper.getChecked = () => wrapper._checked;
  wrapper.getIndeterminate = () => wrapper._indeterminate;
  wrapper.getImageError = () => wrapper._imageError;
  wrapper.setChecked = setChecked;
  wrapper.setIndeterminate = setIndeterminate;
  wrapper.toggle = () => setChecked(!wrapper._checked);
  wrapper.setDisabled = setDisabled;
  wrapper.setSize = setSize;
  wrapper.setLabel = setLabel;
  wrapper.setLabelPosition = setLabelPosition;
  wrapper.setSrc = setSrc;
  wrapper.setAlt = setAlt;
  wrapper.setOnChange = (cb) => { wrapper._onChange = typeof cb === 'function' ? cb : null; };
  wrapper.setOnError = (cb) => { wrapper._onError = typeof cb === 'function' ? cb : null; };
  wrapper.setOnIndeterminate = (cb) => { wrapper._onIndeterminate = typeof cb === 'function' ? cb : null; };
  wrapper.destroy = () => {
    if (onInputChange) input.removeEventListener('change', onInputChange);
    img.removeEventListener('error', onImageError);
    img.removeEventListener('load', onImageLoad);
    wrapper.remove();
  };

  return wrapper;
}

/* -------------------------------------------------------------------------- */
/*  Web Component                                                             */
/* -------------------------------------------------------------------------- */

// Base class that is `HTMLElement` in a browser and a no-op stub elsewhere so
// the module can also be imported in Node (SSR, unit tests) without throwing.
const HTMLElementBase = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

/**
 * `<pic-toggle>` — a form-associated custom element that behaves like a
 * native `<input type="checkbox">` for the purposes of:
 *   - form submission (FormData sees it, `name`/`value` are honoured);
 *   - validation (`required` → `:invalid`, `checkValidity()`, `reportValidity()`);
 *   - reset (returns to the initial `checked` attribute on `form.reset()`);
 *   - browser-driven state restoration on back/forward;
 *   - disabled propagation from a parent `<fieldset disabled>`;
 *   - accessibility (`role="checkbox"`, `aria-checked`, labels forwarding).
 *
 * Attribute vs property parity follows native `<input type="checkbox">`:
 * the HTML attribute `checked` records the INITIAL value (= `defaultChecked`),
 * while `.checked` is the live state. Programmatic assignment to `.checked`
 * does NOT rewrite the attribute. For state-dependent styling use
 * `pic-toggle[aria-checked="true"]`, not `pic-toggle[checked]`.
 */
export class PicToggleElement extends HTMLElementBase {
  // Flag that opts this element into the form-associated custom element API.
  // Browsers that don't support it will simply ignore the flag.
  static formAssociated = true;

  static get observedAttributes() {
    return [
      'src', 'alt', 'checked', 'indeterminate', 'disabled', 'size',
      'label', 'label-position', 'name', 'value', 'required', 'form',
    ];
  }

  constructor() {
    super();

    // Hook into the form-associated API if the browser supports it. Otherwise
    // we fall back to a hidden light-DOM <input> appended in connectedCallback.
    this._internals = typeof this.attachInternals === 'function'
      ? this.attachInternals()
      : null;
    this._fallbackInput = null;

    // Shadow root isolates our styles.
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_STYLE;
    root.appendChild(style);

    // Build the visual control WITHOUT its own <input>. The host itself takes
    // on the role of the checkbox for accessibility and form participation.
    //
    // We don't pass `onChange` — all `setChecked` calls go through our setter
    // with `silent: true`, so the callback would never fire. Dispatch of input
    // and change events is handled directly in `_handleActivate`.
    this._control = createPicToggle({
      src: this.getAttribute('src') || undefined,
      alt: this.getAttribute('alt') || '',
      checked: this.hasAttribute('checked'),
      indeterminate: this.hasAttribute('indeterminate'),
      disabled: this.hasAttribute('disabled'),
      size: this.getAttribute('size') || undefined,
      label: this.getAttribute('label') || '',
      labelPosition: this.getAttribute('label-position') || 'right',
      includeHiddenInput: false,
      useSlot: true,
      onError: (event) => {
        this.dispatchEvent(new CustomEvent('image-error', {
          bubbles: true, composed: true, detail: { event },
        }));
      },
    });
    root.appendChild(this._control);

    // Host becomes the keyboard-focusable, clickable surface. Preserve any
    // explicit `tabindex` set by the author.
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    // Always set the HTML `role` attribute — visible in DevTools, used by
    // older AT, and matched by CSS selectors like `[role="checkbox"]`. If the
    // browser also exposes the ARIAMixin on ElementInternals, publish there.
    this.setAttribute('role', 'checkbox');
    this._useInternalsAria = this._internals && 'ariaChecked' in this._internals;
    if (this._useInternalsAria) {
      try { this._internals.role = 'checkbox'; } catch { /* readonly in older impls */ }
    }
    this._syncAria();

    // Click → toggle. Space on the host → toggle (native checkbox semantics;
    // Enter is NOT a toggle on a native checkbox — it submits the form).
    this.addEventListener('click', (e) => this._handleActivate(e));
    this.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && !this.disabled) {
        e.preventDefault(); // stop page scroll while space is held
      }
    });
    this.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && !this.disabled) {
        this._handleActivate(e);
      }
    });

    // Note: _syncFormValue / _updateValidity are invoked from connectedCallback —
    // calling them in the constructor would be redundant (and setFormValue has
    // no effect while the element is not in a form anyway).
  }

  // ----- lifecycle & attribute reflection ----------------------------------

  // Fallback <input> may need to be (re-)created after disconnect/reconnect.
  connectedCallback() {
    this._ensureFallbackInput();
    this._syncFormValue();
    this._updateValidity();
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    const present = newValue !== null;
    switch (name) {
      case 'src':            this._control.setSrc(newValue); break;
      case 'alt':            this._control.setAlt(newValue); break;
      // Delegate to the public setter so attribute- and property-driven
      // updates share one code path (including fallback-input sync).
      case 'checked':        this.checked = present; break;
      case 'indeterminate':  this.indeterminate = present; break;
      case 'disabled':
        this._control.setDisabled(present);
        this._syncAria();
        if (this._fallbackInput) this._fallbackInput.disabled = present;
        break;
      case 'size':           this._control.setSize(newValue); break;
      case 'label':          this._control.setLabel(newValue); break;
      case 'label-position': this._control.setLabelPosition(newValue || 'right'); break;
      case 'required':
        this._syncAria();
        this._updateValidity();
        if (this._fallbackInput) this._fallbackInput.required = present;
        break;
      case 'name':
      case 'value':
      case 'form':
        this._syncFormValue();
        if (this._fallbackInput) {
          if (newValue == null) this._fallbackInput.removeAttribute(name);
          else this._fallbackInput.setAttribute(name, newValue);
        }
        break;
    }
  }

  // ----- user interaction --------------------------------------------------

  _handleActivate(event) {
    if (this.disabled) return;
    event.preventDefault();
    // Flipping `.checked` also clears indeterminate — the inner setChecked
    // does that on a value transition, matching native checkbox behaviour.
    this.checked = !this.checked;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // ----- form-associated plumbing ------------------------------------------

  _syncFormValue() {
    const checked = this.checked;
    const value = this.getAttribute('value') ?? 'on';
    if (this._internals) {
      this._internals.setFormValue(checked ? value : null);
    }
    if (this._fallbackInput) this._fallbackInput.checked = checked;
  }

  // ElementInternals ARIAMixin for assistive-tech, HTML attributes for CSS
  // selectors and DevTools inspection.
  _syncAria() {
    const checked = this.indeterminate ? 'mixed' : (this.checked ? 'true' : 'false');
    if (this._useInternalsAria) {
      this._internals.ariaChecked = checked;
      this._internals.ariaDisabled = this.disabled ? 'true' : 'false';
      this._internals.ariaRequired = this.required ? 'true' : 'false';
    }
    this.setAttribute('aria-checked', checked);
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    if (this.required) this.setAttribute('aria-required', 'true');
    else this.removeAttribute('aria-required');
  }

  // Report `valueMissing` when `required` is set but the box is not checked.
  _updateValidity() {
    if (!this._internals) return;
    if (this.required && !this.checked) {
      this._internals.setValidity(
        { valueMissing: true },
        'Please check this box if you want to proceed.',
        this._control,
      );
    } else {
      this._internals.setValidity({});
    }
  }

  // Fallback for browsers without ElementInternals: a hidden light-DOM <input>
  // that participates in the form the old-fashioned way.
  _ensureFallbackInput() {
    if (this._internals) return;
    if (this._fallbackInput && this._fallbackInput.isConnected) return;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;margin:0;';
    for (const attr of ['name', 'value', 'form']) {
      if (this.hasAttribute(attr)) input.setAttribute(attr, this.getAttribute(attr));
    }
    if (this.hasAttribute('required')) input.required = true;
    if (this.hasAttribute('disabled')) input.disabled = true;
    input.checked = this.checked;
    this.appendChild(input);
    this._fallbackInput = input;
  }

  // `form.reset()` restores to the HTML attribute's current value, matching
  // the native `defaultChecked` semantics. Indeterminate is cleared similarly
  // from the `indeterminate` attribute (an HTML extension not present on
  // native checkbox, kept here for symmetry).
  formResetCallback() {
    this.checked = this.hasAttribute('checked');
    this.indeterminate = this.hasAttribute('indeterminate');
  }

  formStateRestoreCallback(state, _mode) {
    this.checked = state === 'on';
  }

  formDisabledCallback(disabled) {
    this._control.setDisabled(disabled);
    this._syncAria();
  }

  // ----- public API, modeled after HTMLInputElement -------------------------

  // Setters only touch the live state — the HTML attribute `checked` records
  // the INITIAL value (defaultChecked), exactly like `<input type="checkbox">`.
  get checked() { return this._control.getChecked(); }
  set checked(value) {
    this._control.setChecked(Boolean(value), { silent: true });
    // The inner setChecked may clear indeterminate on a value change — mirror
    // that into the fallback <input> so it does not fall out of sync on
    // browsers without ElementInternals.
    if (this._fallbackInput) this._fallbackInput.indeterminate = this.indeterminate;
    this._syncFormValue();
    this._syncAria();
    this._updateValidity();
  }

  get indeterminate() { return this._control.getIndeterminate(); }
  set indeterminate(value) {
    const next = Boolean(value);
    this._control.setIndeterminate(next, { silent: true });
    if (this._fallbackInput) this._fallbackInput.indeterminate = next;
    this._syncAria();
  }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get required() { return this.hasAttribute('required'); }
  set required(value) {
    if (value) this.setAttribute('required', '');
    else this.removeAttribute('required');
  }

  get name() { return this.getAttribute('name') || ''; }
  set name(v) { v == null ? this.removeAttribute('name') : this.setAttribute('name', v); }

  get value() { return this.getAttribute('value') ?? 'on'; }
  set value(v) { v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v)); }

  get type() { return 'checkbox'; }

  // Mirrors native `.defaultChecked`: the value recorded by the HTML
  // attribute, used by `form.reset()`.
  //
  // Note: assigning `.defaultChecked` here also updates `.checked` (through
  // the attributeChangedCallback → setter path). Native `<input>` keeps a
  // "dirty" flag that prevents this once the user has interacted with the
  // control; we do not track that flag — the trade-off is simplicity against
  // a corner-case most authors never hit.
  get defaultChecked() { return this.hasAttribute('checked'); }
  set defaultChecked(v) {
    if (v) this.setAttribute('checked', '');
    else this.removeAttribute('checked');
  }

  // True if the current `src` failed to load.
  get imageError() { return this._control.getImageError(); }

  // Form-element surface mirroring HTMLInputElement.
  get form()              { return this._delegateFormProp('form', null); }
  get labels() {
    // The hidden fallback input is anonymous — no `<label for="...">` can
    // target it. Return null rather than lie with an empty NodeList.
    return this._internals ? this._internals.labels : null;
  }
  get validity()          { return this._delegateFormProp('validity', null); }
  get validationMessage() { return this._delegateFormProp('validationMessage', ''); }
  get willValidate()      { return this._delegateFormProp('willValidate', false); }
  checkValidity()         { return this._delegateFormMethod('checkValidity', true); }
  reportValidity()        { return this._delegateFormMethod('reportValidity', true); }
  setCustomValidity(msg) {
    if (this._internals) {
      if (msg) this._internals.setValidity({ customError: true }, msg, this._control);
      else this._updateValidity();
    } else if (this._fallbackInput) {
      this._fallbackInput.setCustomValidity(msg || '');
    }
  }

  // Read a property from ElementInternals, falling back to the hidden input
  // if the browser lacks internals, falling back to `def` if neither exists.
  _delegateFormProp(prop, def) {
    if (this._internals) return this._internals[prop];
    if (this._fallbackInput) return this._fallbackInput[prop];
    return def;
  }
  _delegateFormMethod(method, def) {
    if (this._internals) return this._internals[method]();
    if (this._fallbackInput) return this._fallbackInput[method]();
    return def;
  }
}

/**
 * Register the <pic-toggle> custom element. Safe to call multiple times.
 */
export function definePicToggle(tagName = 'pic-toggle') {
  if (typeof window === 'undefined' || !window.customElements) return;
  if (!window.customElements.get(tagName)) {
    window.customElements.define(tagName, PicToggleElement);
  }
}

// Auto-register when loaded in a browser. SSR/Node contexts are untouched.
if (typeof window !== 'undefined' && typeof window.customElements !== 'undefined') {
  definePicToggle();
}

export default createPicToggle;
