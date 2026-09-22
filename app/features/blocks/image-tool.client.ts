import buttonStyles from "#app/lib/ui/button.module.css";
import styles from "./image-tool.module.css";

/**
 * Not `@editorjs/image`: its `uploader` callbacks store a url, which item 5a's
 * own contract already ruled out (a media id is the only thing a block ever
 * stores), and it has no "pick from an existing library" mode of its own
 * (current-work.md's Decisions). This picks only from what `/admin/media`
 * already holds - vanilla DOM, no JSX, because Editor.js builds its own tool
 * tree outside React's.
 */

const PICKER_ENDPOINT = "/admin/media/picker";

/** What the block holds between renders - the resolved fields are what the
 *  loader supplied (`blocks.ts`'s `toEditorJs`) or what a fresh pick just set,
 *  never written back on save. `save()` keeps only `mediaId`. */
type ImageBlockData = {
  mediaId?: string;
  url?: string;
  altText?: string;
  width?: number;
  height?: number;
  missing?: boolean;
};

type PickerMedia = {
  id: string;
  url: string;
  filename: string;
  altText: string;
  width: number;
  height: number;
};

type PickerResponse = { media: PickerMedia[]; page: number; totalPages: number };

const IMAGE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>`;

/** Editor.js constructs this with far more than `data` (`api`, `config`,
 *  `block`, `readOnly`) - only what this tool actually reads is typed, the
 *  same reasoning behind `app/types/editorjs.d.ts` not describing the rest. */
type ImageToolConstructorOptions = { data: ImageBlockData };

export class ImageTool {
  static get toolbox() {
    return { title: "Image", icon: IMAGE_ICON };
  }

  private data: ImageBlockData;
  private wrapper: HTMLElement;

  constructor({ data }: ImageToolConstructorOptions) {
    this.data = data ?? {};
    this.wrapper = document.createElement("div");
    this.wrapper.className = styles.block;
  }

  render(): HTMLElement {
    this.renderContent();
    return this.wrapper;
  }

  /** Empty of a chosen image, this block is dropped rather than reaching the
   *  server as `{ mediaId: undefined }`, which `blocksSchema` could only
   *  refuse with a raw Zod sentence naming no way to fix it. */
  validate(savedData: ImageBlockData): boolean {
    return typeof savedData.mediaId === "string";
  }

  save(): { mediaId: string | undefined } {
    return { mediaId: this.data.mediaId };
  }

  private renderContent() {
    this.wrapper.replaceChildren(
      this.data.mediaId && this.data.url
        ? this.renderPreview()
        : this.renderPlaceholder(this.data.mediaId !== undefined),
    );
  }

  private renderPlaceholder(isMissing: boolean): HTMLElement {
    const placeholder = document.createElement("div");
    placeholder.className = styles.placeholder;
    if (isMissing) {
      const text = document.createElement("p");
      text.className = styles.missingText;
      text.textContent = "This image is no longer available.";
      placeholder.append(text);
    }
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = buttonStyles.button;
    choose.textContent = "Choose image";
    choose.addEventListener("click", () => this.openPicker());
    placeholder.append(choose);
    return placeholder;
  }

  private renderPreview(): HTMLElement {
    const preview = document.createElement("div");
    preview.className = styles.preview;

    const img = document.createElement("img");
    img.src = this.data.url ?? "";
    img.alt = "";
    if (this.data.width) img.width = this.data.width;
    if (this.data.height) img.height = this.data.height;
    img.className = styles.image;

    const altText = document.createElement("p");
    altText.className = styles.altText;
    altText.textContent = this.data.altText ?? "";

    const change = document.createElement("button");
    change.type = "button";
    change.className = `${buttonStyles.button} ${buttonStyles.quiet}`;
    change.textContent = "Change image";
    change.addEventListener("click", () => this.openPicker());

    preview.append(img, altText, change);
    return preview;
  }

  private openPicker() {
    openImagePickerDialog((media) => {
      this.data = {
        mediaId: media.id,
        url: media.url,
        altText: media.altText,
        width: media.width,
        height: media.height,
      };
      this.renderContent();
      // Everything outside an open modal <dialog> is inert (unfocusable) per
      // the platform's own rules, so this only works because the dialog is
      // already closed by the time this callback runs (F-76's fix: the
      // thumbnail's click handler now closes the dialog before calling this).
      // Without that, the old "Choose image" button renderContent() just
      // removed was still what the dialog's own close() would have restored
      // focus to, and focus fell through to <body> once it was gone.
      this.wrapper.querySelector("button")?.focus();
    });
  }
}

let dialogIdCounter = 0;

/** A fresh `<dialog>` per open, appended to `document.body` and removed on
 *  close (however it closed - a pick, Escape, the backdrop, or its own Close
 *  button all fire the platform's own `close` event). */
function openImagePickerDialog(onSelect: (media: PickerMedia) => void) {
  const titleId = `image-picker-title-${++dialogIdCounter}`;

  const dialog = document.createElement("dialog");
  dialog.className = styles.dialog;
  dialog.setAttribute("aria-labelledby", titleId);
  // A click that lands on the dialog element itself, not one of its children,
  // is the backdrop - there is no other way to reach it in the DOM.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());

  const header = document.createElement("div");
  header.className = styles.dialogHeader;
  const title = document.createElement("h2");
  title.id = titleId;
  title.className = styles.dialogTitle;
  title.textContent = "Choose an image";
  const close = document.createElement("button");
  close.type = "button";
  close.className = `${buttonStyles.button} ${buttonStyles.quiet}`;
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  header.append(title, close);

  const body = document.createElement("div");
  body.className = styles.dialogBody;

  dialog.append(header, body);
  document.body.append(dialog);
  dialog.showModal();

  loadPickerPage(body, 1, onSelect, dialog);
}

async function loadPickerPage(
  body: HTMLElement,
  page: number,
  onSelect: (media: PickerMedia) => void,
  dialog: HTMLDialogElement,
) {
  body.replaceChildren(statusMessage("Loading…"));

  let result: PickerResponse;
  try {
    const response = await fetch(`${PICKER_ENDPOINT}?page=${page}`);
    if (!response.ok) throw new Error(`picker responded ${response.status}`);
    result = await response.json();
  } catch {
    body.replaceChildren(statusMessage("The media library could not be loaded. Try again."));
    return;
  }

  if (result.media.length === 0) {
    const empty = statusMessage("");
    empty.append(
      "No images uploaded yet. ",
      Object.assign(document.createElement("a"), {
        href: "/admin/media",
        target: "_blank",
        rel: "noopener",
        textContent: "Upload one",
      }),
    );
    body.replaceChildren(empty);
    return;
  }

  const grid = document.createElement("ul");
  grid.className = styles.grid;
  for (const media of result.media) {
    const item = document.createElement("li");
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = styles.thumbButton;
    const img = document.createElement("img");
    img.src = media.url;
    // Decorative: the visible filename below is the button's own accessible
    // name, so nothing here needs a visually-hidden suffix (unlike the list
    // screens' identical "Delete" links, F-73) - this grid has nothing else
    // to tell two thumbnails apart by.
    img.alt = "";
    img.className = styles.thumb;
    const filename = document.createElement("span");
    filename.className = styles.thumbFilename;
    filename.textContent = media.filename;
    thumb.append(img, filename);
    thumb.addEventListener("click", () => {
      // Closed first: everything outside an open modal <dialog> is inert, so
      // onSelect's own re-focus (F-76) can only reach the new "Change image"
      // button once the dialog - and the inertness it imposes - is gone.
      dialog.close();
      onSelect(media);
    });
    item.append(thumb);
    grid.append(item);
  }
  body.replaceChildren(grid);

  if (result.totalPages > 1) {
    const nav = document.createElement("div");
    nav.className = styles.pagination;
    if (result.page > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = buttonStyles.button;
      prev.textContent = "Previous";
      prev.addEventListener("click", () => loadPickerPage(body, result.page - 1, onSelect, dialog));
      nav.append(prev);
    }
    const status = document.createElement("span");
    status.className = styles.pageStatus;
    status.textContent = `Page ${result.page} of ${result.totalPages}`;
    nav.append(status);
    if (result.page < result.totalPages) {
      const next = document.createElement("button");
      next.type = "button";
      next.className = buttonStyles.button;
      next.textContent = "Next";
      next.addEventListener("click", () => loadPickerPage(body, result.page + 1, onSelect, dialog));
      nav.append(next);
    }
    body.append(nav);
  }
}

function statusMessage(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = styles.status;
  p.textContent = text;
  return p;
}
