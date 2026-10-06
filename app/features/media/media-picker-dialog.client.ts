import buttonStyles from "#app/lib/ui/button.module.css";
import styles from "./media-picker-dialog.module.css";

/**
 * The media picker dialog, shared by the logo in Settings and the image block
 * in the editor (item 14a2), each naming it in `title`. Vanilla DOM, called
 * from a plain `onClick`; it closes before handing back the pick.
 */

const PICKER_ENDPOINT = "/admin/media/picker";

export type PickedMedia = {
  id: string;
  /** The small fixed size, for the picker's own grid and previews. */
  url: string;
  /** The size an image shows at in the editor. */
  src: string;
  filename: string;
  altText: string;
  width: number;
  height: number;
};

type PickerResponse = { media: PickedMedia[]; page: number; totalPages: number };

let dialogIdCounter = 0;

export function openMediaPickerDialog(title: string, onSelect: (media: PickedMedia) => void) {
  const titleId = `media-picker-title-${++dialogIdCounter}`;

  const dialog = document.createElement("dialog");
  dialog.className = styles.dialog;
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());

  const header = document.createElement("div");
  header.className = styles.dialogHeader;
  const heading = document.createElement("h2");
  heading.id = titleId;
  heading.className = styles.dialogTitle;
  heading.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = `${buttonStyles.button} ${buttonStyles.quiet}`;
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  header.append(heading, close);

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
  onSelect: (media: PickedMedia) => void,
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
    img.alt = "";
    img.className = styles.thumb;
    const filename = document.createElement("span");
    filename.className = styles.thumbFilename;
    filename.textContent = media.filename;
    thumb.append(img, filename);
    thumb.addEventListener("click", () => {
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
