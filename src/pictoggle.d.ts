// Public type declarations for the pic-toggle package.

/** Where the text label is placed relative to the image. */
export type PicToggleLabelPosition = 'left' | 'right' | 'top' | 'bottom' | 'none';

/** Options accepted by `createPicToggle`. */
export interface PicToggleOptions {
  /** Image URL (PNG, SVG, WebP, GIF, AVIF — anything the browser's <img> can decode). */
  src: string;
  /** Alt text; defaults to `label` when omitted. */
  alt?: string;
  /** Initial checked state. */
  checked?: boolean;
  /** Initial indeterminate state (visually distinct from checked/unchecked). */
  indeterminate?: boolean;
  /** Initial disabled state. */
  disabled?: boolean;
  /** Size of the image, as pixels (number) or any CSS length. */
  size?: number | string;
  /** Text label shown alongside the image (ignored when `useSlot` is true). */
  label?: string;
  /** Where the label is placed. Default: 'right'. */
  labelPosition?: PicToggleLabelPosition;
  /** Extra attributes added to the control; form attributes (name, value, form, required, autofocus, tabindex) go on the inner <input>, the rest on the outer wrapper. */
  attributes?: Record<string, string | number | boolean | null | undefined>;
  /** Called whenever the checked state actually changes (no-op assignments do not fire). The second argument is the native DOM `Event` when the change came from a user interaction, or `undefined` for programmatic `setChecked`. */
  onChange?: (checked: boolean, event?: Event) => void;
  /** Called whenever the indeterminate state actually changes. */
  onIndeterminate?: (indeterminate: boolean) => void;
  /** Called when the image fails to load. */
  onError?: (event: Event) => void;
  /** Document to create the elements in. Defaults to the global document. */
  ownerDocument?: Document;
  /** Internal: build the control without an inner <input> (used by the Web Component). */
  includeHiddenInput?: boolean;
  /** Internal: wire a <slot> into the label span (used by the Web Component). */
  useSlot?: boolean;
}

/** The DOM element returned by `createPicToggle`, with helper methods attached. */
export interface PicToggleElementAPI extends HTMLLabelElement {
  getChecked(): boolean;
  getIndeterminate(): boolean;
  getImageError(): boolean;
  setChecked(checked: boolean, options?: { silent?: boolean }): void;
  setIndeterminate(value: boolean, options?: { silent?: boolean }): void;
  toggle(): void;
  setDisabled(disabled: boolean): void;
  setSize(size: number | string): void;
  setLabel(label: string): void;
  setLabelPosition(position: PicToggleLabelPosition): void;
  setSrc(src: string): void;
  setAlt(alt: string): void;
  setOnChange(cb: ((checked: boolean, event?: Event) => void) | null): void;
  setOnError(cb: ((event: Event) => void) | null): void;
  destroy(): void;
}

/** Build a DOM element representing an image checkbox. */
export function createPicToggle(options: PicToggleOptions): PicToggleElementAPI;

/** Register the `<pic-toggle>` custom element. Default tag name is `pic-toggle`. */
export function definePicToggle(tagName?: string): void;

/**
 * Form-associated custom element. Participates in <form> submission, native
 * validation, reset and browser state restoration, mirroring the public
 * surface of HTMLInputElement where applicable.
 */
export class PicToggleElement extends HTMLElement {
  static readonly formAssociated: true;

  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  required: boolean;
  name: string;
  value: string;
  readonly type: 'checkbox';
  readonly imageError: boolean;

  /** The HTML attribute value — survives `.checked = x` and is used by `form.reset()`. */
  defaultChecked: boolean;

  readonly form: HTMLFormElement | null;
  readonly labels: NodeList | null;
  readonly validity: ValidityState | null;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
}

export default createPicToggle;

// -------------------------------------------------------------------------
// Framework integration helpers
// -------------------------------------------------------------------------

/** Attribute shape expected by frameworks that bind to the `<pic-toggle>` tag. */
export interface PicToggleAttributes {
  src?: string;
  alt?: string;
  checked?: boolean | '';
  indeterminate?: boolean | '';
  disabled?: boolean | '';
  required?: boolean | '';
  size?: number | string;
  label?: string;
  'label-position'?: PicToggleLabelPosition;
  name?: string;
  value?: string;
  form?: string;
}

// Register the tag in the DOM tag map so `document.querySelector('pic-toggle')`
// is typed as `PicToggleElement` everywhere.
declare global {
  interface HTMLElementTagNameMap {
    'pic-toggle': PicToggleElement;
  }

  // Augment JSX intrinsic elements for React 19+ (and any JSX runtime that
  // exposes the same shape, like Preact). The attribute list is loose on
  // purpose — React/Preact already type the standard DOM attributes, we only
  // need to tell the compiler that the `<pic-toggle>` tag exists.
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'pic-toggle': PicToggleAttributes & { [key: string]: any };
    }
  }
}
