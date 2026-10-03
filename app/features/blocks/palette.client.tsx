import { useEditorState } from "@tiptap/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "#app/lib/ui/button.tsx";
import type { StartDrag } from "./block-drag.client.tsx";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";
import { countBlocks } from "./document-queries.ts";
import styles from "./palette.module.css";
import {
  insertBlock,
  insertSection,
  type PaletteKind,
  SECTION_TEMPLATE_NAMES,
  sectionAddedAnnouncement,
  sectionFits,
} from "./palette-insert.ts";
import type { SectionTemplate } from "./section-templates.ts";

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

/** The Sections group's four tiles, in the mockup's order (`prototypes/editor.html`). */
const SECTION_TILES: { kind: SectionTemplate; icon: ReactNode }[] = [
  { kind: "blank", icon: <rect x="3" y="5" width="18" height="14" rx="2" /> },
  {
    kind: "hero",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 10h10M9 14h6" />
      </>
    ),
  },
  {
    kind: "image-text",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <rect x="5" y="7" width="7" height="10" rx="1" />
        <path d="M15 9h4M15 13h4" />
      </>
    ),
  },
  {
    kind: "cta",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <rect x="8" y="12" width="8" height="4" rx="2" />
        <path d="M7 8h10" />
      </>
    ),
  },
];

/** What a section tile needs from the editor beyond the editor itself. */
export type SectionPaletteOptions = {
  entryType: "post" | "page";
  maxSections: number;
  announce: (message: string) => void;
};

/** The sentence under a full page's heading; the editor's Add a section shows it too. */
export const SECTIONS_FULL_NOTE = "Thirty sections is the most there can be.";

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

/** Adds a ready-made section after the selection's section, announces it, and returns focus to the writing area. */
function addSectionFrom(editor: Editor, kind: SectionTemplate, options: SectionPaletteOptions) {
  const tr = insertSection(editor.state, kind, {
    allowMainHeading: options.entryType === "page",
    maxSections: options.maxSections,
    maxBlocks: MAX_DOCUMENT_BLOCKS,
  });
  if (!tr) return;
  editor.view.dispatch(tr);
  editor.view.focus();
  // The new section sits where the selection now is.
  const index = editor.state.selection.$head.index(0);
  options.announce(sectionAddedAnnouncement(kind, index, editor.state.doc.childCount));
}

/**
 * The Sections group: four wide tiles, each a `button` that adds a ready-made
 * section (14c1). A click or Enter / Space only - dragging a section tile is 14c2.
 */
function SectionTiles({
  editor,
  options,
  onAdded,
}: {
  editor: Editor;
  options: SectionPaletteOptions;
  onAdded?: () => void;
}) {
  const { sectionsFull, blocksUsed, fitting } = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      sectionsFull: current.state.doc.childCount >= options.maxSections,
      blocksUsed: countBlocks(current.state.doc),
      fitting: SECTION_TILES.map((tile) =>
        sectionFits(current.state.doc, tile.kind, options.maxSections, MAX_DOCUMENT_BLOCKS),
      ),
    }),
  });
  const fits = (kind: SectionTemplate) =>
    fitting[SECTION_TILES.findIndex((tile) => tile.kind === kind)] === true;
  const anyDisabled = SECTION_TILES.some((tile) => !fits(tile.kind));
  // The Blocks group above already says the blocks sentence once the document is full.
  let note: string | null = null;
  if (anyDisabled) {
    if (sectionsFull) note = SECTIONS_FULL_NOTE;
    else if (blocksUsed < MAX_DOCUMENT_BLOCKS)
      note = `You can have at most ${MAX_DOCUMENT_BLOCKS} blocks.`;
  }
  return (
    <>
      {note ? <p className={styles.note}>{note}</p> : null}
      <div className={styles.grid}>
        {SECTION_TILES.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            className={`${styles.tile} ${styles.wide}`}
            disabled={!fits(tile.kind)}
            // A pointer press leaves the writing area's selection where it is.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (onAdded) onAdded();
              addSectionFrom(editor, tile.kind, options);
            }}
          >
            <Icon>{tile.icon}</Icon>
            <span className={styles.tileLabel}>{SECTION_TEMPLATE_NAMES[tile.kind]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * The palette (design.md, *Palette*): eight tiles, each a `button` that adds
 * its block after the selected one - by click, or Enter / Space on the focused
 * tile. Rendered both in the side panel and inside the phone's dialog. In the
 * side panel a tile also drags its block to a place in any column (14b); a
 * press without movement is still a click.
 */
function Tiles({
  editor,
  headingId,
  onAdded,
  startDrag,
  draggingTile,
}: {
  editor: Editor;
  headingId: string;
  onAdded?: () => void;
  startDrag?: StartDrag;
  draggingTile?: PaletteKind | null;
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
            className={`${styles.tile} ${draggingTile === tile.kind ? styles.isDragging : ""}`}
            disabled={isFull}
            // A pointer press leaves the writing area's selection where it is.
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startDrag ? (event) => startDrag({ kind: tile.kind }, event) : undefined}
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
export function Palette({
  editor,
  startDrag,
  draggingTile,
  sections,
}: {
  editor: Editor;
  startDrag: StartDrag;
  draggingTile: PaletteKind | null;
  sections: SectionPaletteOptions;
}) {
  const headingId = useId();
  return (
    <aside className={styles.palette} aria-label="Add to the page">
      <h2 className={styles.heading} id={headingId}>
        Blocks
      </h2>
      <Tiles
        editor={editor}
        headingId={headingId}
        startDrag={startDrag}
        draggingTile={draggingTile}
      />
      <h2 className={`${styles.heading} ${styles.groupHeading}`}>Sections</h2>
      <SectionTiles editor={editor} options={sections} />
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
export function AddDialog({
  editor,
  onClose,
  sections,
}: {
  editor: Editor;
  onClose: () => void;
  sections: SectionPaletteOptions;
}) {
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
          Add to the page
        </h2>
        <section aria-labelledby={`${headingId}-blocks`}>
          <h3 className={styles.heading} id={`${headingId}-blocks`}>
            Blocks
          </h3>
          <Tiles
            editor={editor}
            headingId={`${headingId}-blocks`}
            onAdded={() => dialog.current?.close()}
          />
        </section>
        <section aria-labelledby={`${headingId}-sections`}>
          <h3 className={styles.heading} id={`${headingId}-sections`}>
            Sections
          </h3>
          <SectionTiles
            editor={editor}
            options={sections}
            onAdded={() => dialog.current?.close()}
          />
        </section>
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
