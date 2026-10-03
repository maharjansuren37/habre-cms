import { useEditorState } from "@tiptap/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "#app/lib/ui/button.tsx";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";
import styles from "./palette.module.css";
import { countBlocks, insertBlock, type PaletteKind } from "./palette-insert.ts";

type Editor = NonNullable<ReturnType<typeof import("@tiptap/react").useEditor>>;

const TILES: { kind: PaletteKind; label: string; icon: ReactNode }[] = [
  { kind: "text", label: "Text", icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { kind: "heading", label: "Heading", icon: <path d="M6 4v16M18 4v16M6 12h12" /> },
  {
    kind: "list",
    label: "List",
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </>
    ),
  },
  {
    kind: "image",
    label: "Image",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m21 16-5-5-9 9" />
      </>
    ),
  },
  { kind: "button", label: "Button", icon: <rect x="3" y="8" width="18" height="8" rx="4" /> },
  {
    kind: "quote",
    label: "Quote",
    icon: <path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6" />,
  },
  { kind: "line", label: "Line", icon: <path d="M3 12h18" /> },
  { kind: "space", label: "Space", icon: <path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" /> },
];

/** Each kind's tile icon, which the drag ghost shows too (14b). */
export const KIND_ICONS = Object.fromEntries(TILES.map((tile) => [tile.kind, tile.icon])) as Record<
  PaletteKind,
  ReactNode
>;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Adds one block after the selected one, as one transaction, and returns focus to the writing area. */
function addBlock(editor: Editor, kind: PaletteKind) {
  const tr = insertBlock(editor.state, kind, MAX_DOCUMENT_BLOCKS);
  if (!tr) return;
  editor.view.dispatch(tr);
  editor.view.focus();
}

/**
 * The palette (design.md, *Palette*): eight tiles, each a `button` that adds
 * its block after the selected one - by click, or Enter / Space on the focused
 * tile. Rendered both in the side panel and inside the phone's dialog.
 */
function Tiles({
  editor,
  headingId,
  onAdded,
}: {
  editor: Editor;
  headingId: string;
  onAdded?: () => void;
}) {
  const isFull = useEditorState({
    editor,
    selector: ({ editor: current }) => countBlocks(current.state.doc) >= MAX_DOCUMENT_BLOCKS,
  });
  return (
    <>
      {isFull ? (
        <p className={styles.note} id={`${headingId}-note`}>
          You can have at most {MAX_DOCUMENT_BLOCKS} blocks.
        </p>
      ) : null}
      <div className={styles.grid}>
        {TILES.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            className={styles.tile}
            disabled={isFull}
            // A pointer press leaves the writing area's selection where it is.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (onAdded) onAdded();
              addBlock(editor, tile.kind);
            }}
          >
            <Icon>{tile.icon}</Icon>
            <span className={styles.tileLabel}>{tile.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** The side panel, from 1024px; hidden below it, where Add opens the dialog. */
export function Palette({ editor }: { editor: Editor }) {
  const headingId = useId();
  return (
    <aside className={styles.palette} aria-label="Add to the page">
      <h2 className={styles.heading} id={headingId}>
        Blocks
      </h2>
      <Tiles editor={editor} headingId={headingId} />
    </aside>
  );
}

/** The top bar's Add button, shown below 1024px only. */
export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className={styles.addButton} onClick={onClick}>
      <Icon>
        <path d="M12 5v14M5 12h14" />
      </Icon>
      Add
    </Button>
  );
}

/**
 * The palette on a phone: the kit's native modal `<dialog>`, drawn into
 * `document.body` so it is not nested in the entry form. Choosing a tile closes
 * it first (everything outside an open modal is inert), then the block is
 * added and focus lands in the writing area.
 */
export function AddDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onClose={() => {
        onClose();
        editor.commands.focus();
      }}
    >
      <div className={styles.dialogBody}>
        <h2 className={styles.dialogTitle} id={headingId}>
          Blocks
        </h2>
        <Tiles editor={editor} headingId={headingId} onAdded={() => dialog.current?.close()} />
      </div>
      <div className={styles.dialogActions}>
        <Button type="button" variant="quiet" onClick={() => dialog.current?.close()}>
          Close
        </Button>
      </div>
    </dialog>,
    document.body,
  );
}
