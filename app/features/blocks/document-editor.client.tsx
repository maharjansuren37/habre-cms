import { mergeAttributes, Node, type NodeViewProps } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  createContext,
  type FormEvent,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { openMediaPickerDialog } from "#app/features/media/media-picker-dialog.client.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import content from "./content.module.css";
import styles from "./document-editor.module.css";
import type { Document, DocumentMedia, LinkablePage } from "./document-nodes.ts";
import { isSafeHref, LINK_ERRORS } from "./inline-runs.ts";
import { AddButton, AddDialog, Palette } from "./palette.client.tsx";
import {
  ButtonSettings,
  ImageSettings,
  SectionSettings,
  SettingsPanel,
} from "./settings-panel.client.tsx";

/** The longest link address a document may hold (`document.ts`, the contract). */
const MAX_HREF_LENGTH = 2_048;
/** The most sections a document may hold (`document.ts`, the contract). */
const MAX_SECTIONS = 30;

/*
 * The v4 document's own structure (D169): a document of sections, a section of
 * one to three columns, a column of blocks. Sections and columns are
 * `isolating`, so typing and deleting never merge or cross them. They render
 * with `content.module.css`, the stylesheet the public site uses, so the
 * canvas shows what will publish.
 */
const DocumentNode = Node.create({
  name: "doc",
  topNode: true,
  content: "section+",
  addKeyboardShortcuts() {
    // No hard breaks in v1 (current-work.md, Decisions): Shift+Enter starts a
    // new paragraph, the same as Enter.
    return { "Shift-Enter": () => this.editor.commands.keyboardShortcut("Enter") };
  },
});

const SectionNode = Node.create({
  name: "section",
  content: "column{1,3}",
  isolating: true,
  addAttributes() {
    return {
      align: {
        default: "top",
        parseHTML: (element) => (element.dataset.align === "middle" ? "middle" : "top"),
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
      background: {
        default: "none",
        parseHTML: (element) => (element.dataset.background === "band" ? "band" : "none"),
        renderHTML: (attributes) => ({ "data-background": attributes.background }),
      },
    };
  },
  // Only this editor's own sections: a `<section>` pasted from elsewhere is
  // read for its content, never as one of these.
  parseHTML: () => [{ tag: 'section[data-node="section"]' }],
  // The column count is drawn from the columns themselves (content.module.css),
  // so it follows Columns in the chip without redrawing the section.
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, { class: content.section, "data-node": "section" }),
    ["div", { class: content.columns }, 0],
  ],
});

const ColumnNode = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-node="column"]' }],
  renderHTML: () => ["div", { class: content.column, "data-node": "column" }, 0],
});

/** A list item holds one paragraph: lists are flat in v1, so Tab does not nest
 *  - it leaves the writing area, as Tab does anywhere else. */
const ListItemNode = Node.create({
  name: "listItem",
  content: "paragraph",
  defining: true,
  parseHTML: () => [{ tag: "li" }],
  renderHTML: () => ["li", 0],
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.splitListItem(this.name) };
  },
});

/** A quote holds paragraphs only - the contract's shape - so a pasted quote
 *  holding a list or heading is split around it rather than refused at save. */
const BlockquoteNode = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML: () => [{ tag: "blockquote" }],
  renderHTML: () => ["blockquote", 0],
});

/* ---- Image, button, line and space (item 14a2, step 3) ----------------------
 * Four blocks that hold no text: atoms, selected by a click and removed with
 * Backspace or Delete. They are drawn with the public site's own classes, so
 * the canvas shows what publishes. None has a parse rule, so pasted HTML never
 * creates one (an `<img>` pasted from a page is dropped, as in 14a1), and none
 * has an input rule (`---` typed in text stays text). Nothing interactive sits
 * inside the writing area (D169): a button is drawn as a `span`, never a link,
 * and its controls come with the settings panel. */

/** The media each image block draws, by id. Held in state by `DocumentEditor`
 *  and read through context, so it never reaches the editor's options (F-158). */
const MediaContext = createContext<Record<string, DocumentMedia>>({});

function ImageView({ node }: NodeViewProps) {
  const mediaById = useContext(MediaContext);
  const mediaId = String(node.attrs.mediaId ?? "");
  const media = Object.hasOwn(mediaById, mediaId) ? mediaById[mediaId] : undefined;
  return (
    <NodeViewWrapper>
      {media ? (
        <img
          className={content.image}
          src={media.url}
          alt={media.altText}
          width={media.width}
          height={media.height}
          draggable={false}
        />
      ) : (
        <div className={styles.photo}>
          {mediaId === "" ? "No image chosen" : "This image is no longer available."}
        </div>
      )}
    </NodeViewWrapper>
  );
}

const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { mediaId: { default: "" } };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

const ButtonNode = Node.create({
  name: "button",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      label: { default: "", rendered: false },
      href: { default: "", rendered: false },
      style: { default: "filled", rendered: false },
    };
  },
  renderHTML: ({ node }) => {
    const label = String(node.attrs.label ?? "");
    const classes = [
      content.button,
      node.attrs.style === "outline" ? content.outline : content.filled,
    ];
    if (label === "") classes.push(styles.buttonEmpty);
    return ["span", { class: classes.join(" "), "data-node": "button" }, label || "Button text"];
  },
});

const LineNode = Node.create({
  name: "horizontalRule",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  renderHTML: () => ["hr", { class: content.line }],
});

const SpaceNode = Node.create({
  name: "space",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  // Drawn with hatching so an author can see and select the gap.
  renderHTML: () => [
    "div",
    { class: [content.space, styles.spacer].join(" "), "data-node": "space" },
  ],
});

const TEXT_STYLES = [
  { value: "paragraph", label: "Text" },
  { value: "2", label: "Heading" },
  { value: "3", label: "Subheading" },
  { value: "4", label: "Small heading" },
] as const;
type TextStyle = (typeof TEXT_STYLES)[number]["value"];

function extensionsFor(placeholder: string) {
  return [
    DocumentNode,
    SectionNode,
    ColumnNode,
    ListItemNode,
    BlockquoteNode,
    ImageNode,
    ButtonNode,
    LineNode,
    SpaceNode,
    StarterKit.configure({
      // Replaced by the nodes above, whose content the contract narrows.
      document: false,
      listItem: false,
      blockquote: false,
      // Outside the contract: nothing offers them, and a paste drops them.
      code: false,
      codeBlock: false,
      hardBreak: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      // Appends a paragraph at the document's end, where only sections go.
      trailingNode: false,
      // What this item's Text style offers; Main heading is 14a3's, 5-6 item 20's.
      heading: { levels: [2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        // Only `href` is the contract's; TipTap's defaults add target and rel.
        HTMLAttributes: { target: null, rel: null, class: null },
        // The same allowlist the server applies (D30), so a pasted or typed
        // `javascript:` link never becomes a link in the first place.
        isAllowedUri: (url: string) => isSafeHref(url),
      },
    }),
    Placeholder.configure({ placeholder, includeChildren: true }),
  ];
}

const COPY = {
  page: { label: "Page content", placeholder: "Write your page…" },
  post: { label: "Post content", placeholder: "Write your post…" },
} as const;

/**
 * TipTap compares its options by identity and calls `setOptions` when they
 * differ, so they are built once per entry type here, never in a render (F-158).
 */
function optionsFor(copy: { label: string; placeholder: string }) {
  return {
    extensions: extensionsFor(copy.placeholder),
    editorProps: {
      attributes: {
        class: [content.document, styles.prose].join(" "),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": copy.label,
      },
    },
  };
}
const OPTIONS = { page: optionsFor(COPY.page), post: optionsFor(COPY.post) };

/**
 * The v4 document editor (item 14a1): TipTap on one document per entry. The
 * format bar is drawn into `barSlot`, a place under the editor's top bar that
 * the entry form owns; the writing area is the customer's site, in its own
 * light scope (`data-surface="site"`) even inside dark Habre.
 *
 * Nothing interactive sits inside the writing area (D169): the bar and the
 * link dialog are outside it.
 */
export function DocumentEditor({
  initialDocument,
  entryType,
  contentRef,
  onChange,
  barSlot,
  paletteSlot,
  addSlot,
  settingsSlot,
  mediaById,
  pages,
}: {
  initialDocument: Document;
  entryType: "post" | "page";
  /** Reads the current document when the form submits. */
  contentRef: { current: (() => Promise<unknown>) | null };
  onChange: () => void;
  barSlot: HTMLElement | null;
  /** Where the palette is drawn (before the canvas) and where the phone's Add button goes. */
  paletteSlot: HTMLElement | null;
  addSlot: HTMLElement | null;
  /** Where the settings panel is drawn: after the canvas, so it follows the writing area in tab order. */
  settingsSlot: HTMLElement | null;
  /** What the document's images need to draw, by media id. */
  mediaById: Record<string, DocumentMedia>;
  /** The pages a button can go to. Read by the settings panel only - never by the editor's options (F-158). */
  pages: LinkablePage[];
}) {
  const { extensions, editorProps } = OPTIONS[entryType];
  // In state so the media a person picks in the settings panel can be added.
  const [media, setMedia] = useState(mediaById);
  // The section whose settings were asked for with the chip's gear, or none.
  const [settingsSection, setSettingsSection] = useState<number | null>(null);
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  // Set when the stored document holds something this editor's schema does not
  // know. TipTap then opens an empty one, which Save would store over the real
  // content (F-154), so reading the editor fails instead.
  const unreadable = useRef(false);

  const editor = useEditor({
    // The entry form mounts this after hydration; never on the server.
    immediatelyRender: false,
    // Its few required rules live in document-editor.module.css, so the admin
    // can later drop 'unsafe-inline' from its style policy.
    injectCSS: false,
    extensions,
    content: initialDocument,
    enableContentCheck: true,
    // Only while the stored document is being loaded: a later insert that
    // fails the check must not lock Save over a document that did load (F-154).
    onContentError: ({ editor: current }) => {
      if (!current.isInitialized) unreadable.current = true;
    },
    editorProps,
    onUpdate: () => latestOnChange.current(),
  });

  useEffect(() => {
    if (!editor) return;
    contentRef.current = async () => {
      if (unreadable.current) throw new Error("The stored document could not be read.");
      return editor.getJSON();
    };
    return () => {
      contentRef.current = null;
    };
  }, [editor, contentRef]);

  const canvas = useRef<HTMLDivElement>(null);
  const [isAddOpen, setAddOpen] = useState(false);

  /** Opens the section's panel and moves focus into it (the gear is a button, so this is a keyboard path). */
  function openSectionSettings(index: number) {
    flushSync(() => setSettingsSection(index));
    settingsSlot?.querySelector("select")?.focus();
  }

  return (
    <>
      {paletteSlot && editor ? createPortal(<Palette editor={editor} />, paletteSlot) : null}
      {addSlot && editor
        ? createPortal(<AddButton onClick={() => setAddOpen(true)} />, addSlot)
        : null}
      {isAddOpen && editor ? <AddDialog editor={editor} onClose={() => setAddOpen(false)} /> : null}
      {barSlot && editor ? createPortal(<FormatBar editor={editor} />, barSlot) : null}
      <div data-surface="site" className={styles.site} ref={canvas}>
        <MediaContext.Provider value={media}>
          <EditorContent editor={editor} />
        </MediaContext.Provider>
        {/* After the writing area, so Tab reaches it next; outside it, so no
            control sits inside the textbox (D169). */}
        {editor ? (
          <SectionChip editor={editor} canvas={canvas} onOpenSettings={openSectionSettings} />
        ) : null}
      </div>
      {editor ? <AddSection editor={editor} /> : null}
      {settingsSlot && editor
        ? createPortal(
            <SettingsHost
              editor={editor}
              section={settingsSection}
              setSection={setSettingsSection}
              setMedia={setMedia}
              mediaById={media}
              pages={pages}
            />,
            settingsSlot,
          )
        : null}
    </>
  );
}

type Editor = NonNullable<ReturnType<typeof useEditor>>;

/* ---- Sections and columns (step 4) ----------------------------------------
 * Every change below is one transaction, started as its own undo step
 * (`closeHistory`), so one Undo reverts exactly that change and nothing typed
 * just before it. */

/** A column holding one empty paragraph - what a new section or column starts as. */
function emptyColumn(schema: Schema) {
  return schema.nodes.column.create(null, schema.nodes.paragraph.create());
}

/** Where section `index` starts in the document. */
function sectionStart(doc: ProseMirrorNode, index: number) {
  let position = 0;
  for (let i = 0; i < index; i++) position += doc.child(i).nodeSize;
  return position;
}

/** A column nobody wrote in: one empty paragraph. */
function isUntouched(column: ProseMirrorNode) {
  return (
    column.childCount === 1 &&
    column.child(0).type.name === "paragraph" &&
    column.child(0).childCount === 0
  );
}

function apply(editor: Editor, change: (tr: Transaction) => void) {
  const tr = closeHistory(editor.state.tr);
  change(tr);
  editor.view.dispatch(tr.scrollIntoView());
}

/** Adds one section at the end and puts the cursor in it. */
function addSection(editor: Editor) {
  apply(editor, (tr) => {
    const end = tr.doc.content.size;
    const { schema } = tr.doc.type;
    tr.insert(end, schema.nodes.section.create(null, emptyColumn(schema)));
    // Into the section, its column and its paragraph.
    tr.setSelection(TextSelection.create(tr.doc, end + 3));
  });
  editor.view.focus();
}

/**
 * Sets a section's column count. Growing adds empty columns on the right;
 * shrinking appends the removed columns' blocks to the end of the last kept
 * column, in column order (D119) - a column nobody wrote in adds nothing. A
 * cursor in a removed column moves with its text.
 */
function setColumns(editor: Editor, index: number, columns: number) {
  apply(editor, (tr) => {
    const { doc } = tr;
    const { schema } = doc.type;
    const section = doc.child(index);
    const start = sectionStart(doc, index);
    const sectionEnd = start + section.nodeSize - 1;
    if (columns > section.childCount) {
      const added = Array.from({ length: columns - section.childCount }, () => emptyColumn(schema));
      tr.insert(sectionEnd, added);
      return;
    }
    let removedFrom = start + 1;
    for (let i = 0; i < columns; i++) removedFrom += section.child(i).nodeSize;
    // Inside the last kept column, before its end.
    const keptEnd = removedFrom - 1;
    const head = tr.selection.head;
    const moved: ProseMirrorNode[] = [];
    let movedSize = 0;
    let newHead: number | undefined;
    let columnStart = removedFrom;
    for (let i = columns; i < section.childCount; i++) {
      const column = section.child(i);
      if (!isUntouched(column)) {
        if (head > columnStart && head < columnStart + column.nodeSize) {
          newHead = keptEnd + movedSize + (head - columnStart - 1);
        }
        column.forEach((block) => {
          moved.push(block);
        });
        movedSize += column.content.size;
      } else if (head > columnStart && head < columnStart + column.nodeSize) {
        newHead = keptEnd + movedSize;
      }
      columnStart += column.nodeSize;
    }
    tr.delete(removedFrom, sectionEnd);
    if (moved.length > 0) tr.insert(keptEnd, moved);
    if (newHead !== undefined) tr.setSelection(Selection.near(tr.doc.resolve(newHead), -1));
  });
}

/** Removes a section; the cursor goes to the end of the one before it, or the
 *  start of the next. Never the last section: the chip does not offer it. */
function removeSection(editor: Editor, index: number) {
  apply(editor, (tr) => {
    if (tr.doc.childCount <= 1) return;
    const start = sectionStart(tr.doc, index);
    tr.delete(start, start + tr.doc.child(index).nodeSize);
    tr.setSelection(
      index > 0 ? Selection.near(tr.doc.resolve(start), -1) : Selection.near(tr.doc.resolve(0), 1),
    );
  });
  editor.view.focus();
}

/**
 * The section chip (design.md, *Section controls*): on the section holding the
 * cursor, drawn outside the writing area and placed over its section by this
 * code. It offers Section settings (Columns live in the panel) and Remove
 * section; Move section up and down come with 14a3.
 */
function SectionChip({
  editor,
  canvas,
  onOpenSettings,
}: {
  editor: Editor;
  canvas: RefObject<HTMLDivElement | null>;
  onOpenSettings: (index: number) => void;
}) {
  const chip = useRef<HTMLFieldSetElement>(null);
  const { index, count } = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { doc, selection } = current.state;
      const index = Math.min(selection.$head.index(0), doc.childCount - 1);
      return { index, count: doc.childCount };
    },
  });

  useLayoutEffect(() => {
    /** Lines the chip up with the top of its section, wherever text above has moved it. */
    function place() {
      const element = chip.current;
      const host = canvas.current;
      if (!element || !host || editor.isDestroyed) return;
      const { doc } = editor.state;
      const section = editor.view.nodeDOM(sectionStart(doc, Math.min(index, doc.childCount - 1)));
      if (!(section instanceof HTMLElement)) return;
      const top = section.getBoundingClientRect().top - host.getBoundingClientRect().top;
      element.style.top = `${top}px`;
    }
    place();
    editor.on("transaction", place);
    const observer = new ResizeObserver(place);
    observer.observe(editor.view.dom);
    return () => {
      editor.off("transaction", place);
      observer.disconnect();
    };
  }, [editor, canvas, index]);

  const label = `Section ${index + 1} of ${count}`;
  return (
    <fieldset ref={chip} className={styles.chip}>
      <legend className={styles.chipLegend}>{label}</legend>
      <button
        type="button"
        className={styles.chipButton}
        aria-label="Section settings"
        title="Section settings"
        onClick={() => {
          onOpenSettings(index);
        }}
      >
        <svg
          className={styles.chipIcon}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {count > 1 ? (
        <button
          type="button"
          className={styles.chipButton}
          aria-label="Remove section"
          title="Remove section"
          onClick={() => removeSection(editor, index)}
        >
          <svg
            className={styles.chipIcon}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      ) : null}
    </fieldset>
  );
}

/**
 * Which block the settings panel is about, read from the selection: an image
 * that is the selected block, or - after the chip's gear - the section holding
 * the cursor. Text, a line and a space have none.
 */
const NO_BUTTON = { label: "", href: "", style: "filled" } as const;

type SettingsTarget = {
  kind: "text" | "image" | "button" | "atom";
  /** Where the selected atom starts; -1 for text. */
  pos: number;
  mediaId: string;
  /** A selected button's attrs. */
  button: { label: string; href: string; style: "filled" | "outline" };
  /** The section holding the selection, and its column count. */
  section: number;
  columns: number;
};

function SettingsHost({
  editor,
  section,
  setSection,
  setMedia,
  mediaById,
  pages,
}: {
  editor: Editor;
  /** The section whose panel the gear asked for. */
  section: number | null;
  setSection: (update: (current: number | null) => number | null) => void;
  setMedia: (
    update: (current: Record<string, DocumentMedia>) => Record<string, DocumentMedia>,
  ) => void;
  mediaById: Record<string, DocumentMedia>;
  pages: LinkablePage[];
}) {
  const target = useEditorState({
    editor,
    selector: ({ editor: current }): SettingsTarget => {
      const { doc, selection } = current.state;
      const index = Math.min(selection.$head.index(0), doc.childCount - 1);
      const columns = doc.child(index).childCount;
      if (selection instanceof NodeSelection && selection.node.isAtom) {
        const { node } = selection;
        const kind =
          node.type.name === "image" ? "image" : node.type.name === "button" ? "button" : "atom";
        return {
          kind,
          pos: selection.from,
          mediaId: kind === "image" ? String(node.attrs.mediaId ?? "") : "",
          button: {
            label: kind === "button" ? String(node.attrs.label ?? "") : "",
            href: kind === "button" ? String(node.attrs.href ?? "") : "",
            style: node.attrs.style === "outline" ? "outline" : "filled",
          },
          section: index,
          columns,
        };
      }
      return { kind: "text", pos: -1, mediaId: "", button: NO_BUTTON, section: index, columns };
    },
  });
  const [isAtomClosed, setAtomClosed] = useState(false);

  // A new selection ends whatever a close or the gear decided about the last
  // one: the image panel comes back for the next image, and the section panel
  // stays until the selection moves to another section or onto another image
  // or button. The gear does not move the selection, so pressing it with an
  // atom selected leaves this effect idle and the section panel shows (F-166).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `target.pos` is a trigger - selecting another image reopens the panel.
  useEffect(() => {
    setAtomClosed(false);
    setSection((current) =>
      current !== null && (target.kind !== "text" || target.section !== current) ? null : current,
    );
  }, [target.kind, target.pos, target.section, setSection]);

  const isSection = section !== null && section === target.section;
  const isImage = target.kind === "image" && !isAtomClosed && !isSection;
  const isButton = target.kind === "button" && !isAtomClosed && !isSection;

  function close() {
    if (isSection) setSection(() => null);
    else if (target.kind === "image" || target.kind === "button") setAtomClosed(true);
    editor.view.focus();
  }

  /** The pick joins the media map and the image takes its id in ONE transaction, so one Undo restores the old id. */
  function choose() {
    const { pos } = target;
    openMediaPickerDialog("Choose an image", (pick) => {
      setMedia((current) => ({
        ...current,
        [pick.id]: {
          url: pick.url,
          altText: pick.altText,
          width: pick.width,
          height: pick.height,
        },
      }));
      const node = editor.state.doc.nodeAt(pos);
      if (node?.type.name !== "image") return;
      const tr = closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
        ...node.attrs,
        mediaId: pick.id,
      });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      editor.view.dispatch(tr);
    });
  }

  if (isImage) {
    const media = Object.hasOwn(mediaById, target.mediaId) ? mediaById[target.mediaId] : undefined;
    return (
      <SettingsPanel
        key="image"
        title="Image"
        onClose={close}
        keepVisible={() => editor.view.nodeDOM(target.pos) as Element | null}
      >
        <ImageSettings mediaId={target.mediaId} media={media} onChoose={choose} />
      </SettingsPanel>
    );
  }
  if (isButton) {
    /** One transaction per change; ProseMirror's history groups rapid ones. */
    const change = (attrs: Partial<SettingsTarget["button"]>) => {
      const node = editor.state.doc.nodeAt(target.pos);
      if (node?.type.name !== "button") return;
      const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, ...attrs });
      tr.setSelection(NodeSelection.create(tr.doc, target.pos));
      editor.view.dispatch(tr);
    };
    return (
      <SettingsPanel
        key={`button-${target.pos}`}
        title="Button"
        onClose={close}
        keepVisible={() => editor.view.nodeDOM(target.pos) as Element | null}
      >
        <ButtonSettings
          label={target.button.label}
          href={target.button.href}
          style={target.button.style}
          pages={pages}
          onLabel={(label) => change({ label })}
          onHref={(href) => change({ href })}
          onStyle={(style) => change({ style })}
        />
      </SettingsPanel>
    );
  }
  if (isSection) {
    return (
      <SettingsPanel key="section" title={`Section ${target.section + 1}`} onClose={close}>
        <SectionSettings
          columns={target.columns}
          onColumns={(columns) => setColumns(editor, target.section, columns)}
        />
      </SettingsPanel>
    );
  }
  return null;
}

/** Add a section, below the canvas: one section of one empty column, with the cursor in it. */
function AddSection({ editor }: { editor: Editor }) {
  const isFull = useEditorState({
    editor,
    selector: ({ editor: current }) => current.state.doc.childCount >= MAX_SECTIONS,
  });
  return (
    <div className={styles.addSection}>
      <Button
        type="button"
        className={styles.addSectionButton}
        disabled={isFull}
        onClick={() => addSection(editor)}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add a section
      </Button>
      {isFull ? (
        <p className={styles.addSectionNote}>Thirty sections is the most there can be.</p>
      ) : null}
    </div>
  );
}

/**
 * The interim format bar (current-work.md, Design reference): a native select
 * for the text style and the kit's small ghost icon buttons. 14a3 moves these
 * controls into the selected block's toolbar.
 */
function FormatBar({ editor }: { editor: Editor }) {
  const selectId = useId();
  const [isLinkOpen, setLinkOpen] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      textStyle:
        (["2", "3", "4"] as const).find((level) =>
          current.isActive("heading", { level: Number(level) }),
        ) ?? ("paragraph" as TextStyle),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      link: current.isActive("link"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  function setTextStyle(value: TextStyle) {
    // No .focus(): the select keeps it, so arrow keys can step through the
    // styles (F-153, WCAG 3.2.2). The command acts on the saved selection.
    const chain = editor.chain();
    if (value === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value) as 2 | 3 | 4 }).run();
  }

  return (
    <div className={styles.bar} role="toolbar" aria-label="Formatting">
      <label className="visually-hidden" htmlFor={selectId}>
        Text style
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={state.textStyle}
        onChange={(event) => setTextStyle(event.currentTarget.value as TextStyle)}
      >
        {TEXT_STYLES.map((style) => (
          <option key={style.value} value={style.value}>
            {style.label}
          </option>
        ))}
      </select>
      <span className={styles.separator} aria-hidden="true" />
      <Tool
        label="Bulleted list"
        pressed={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </Tool>
      <Tool
        label="Numbered list"
        pressed={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <path d="M10 6h10M10 12h10M10 18h10M4 4h1.5v4M4 8h3M4 11.5h3l-3 4h3" />
      </Tool>
      <Tool
        label="Quote"
        pressed={state.blockquote}
        onClick={() => editor.chain().focus().toggleWrap("blockquote").run()}
      >
        <path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6" />
      </Tool>
      <span className={styles.separator} aria-hidden="true" />
      <Tool
        label="Bold"
        pressed={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
      </Tool>
      <Tool
        label="Italic"
        pressed={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <path d="M10 5h8M6 19h8M14 5l-4 14" />
      </Tool>
      <Tool label="Link" pressed={state.link} onClick={() => setLinkOpen(true)}>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </Tool>
      <span className={styles.separator} aria-hidden="true" />
      <Tool
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </Tool>
      <Tool
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <path d="m15 14 5-5-5-5" />
        <path d="M20 9H10a6 6 0 0 0 0 12h3" />
      </Tool>
      {isLinkOpen ? <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} /> : null}
    </div>
  );
}

/** The kit's small ghost icon button; a toggle says whether it is on. */
function Tool({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="quiet"
      className={styles.tool}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      // A pointer press leaves the caret where it is, so the command applies
      // to the writing area's selection at once and typing carries on there.
      // The keyboard path still focuses the button, and the command returns
      // focus to the writing area.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
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
    </Button>
  );
}

/**
 * The link dialog: the kit's native modal `<dialog>` with one field. The
 * address is checked with the same allowlist the server uses, and refused
 * beside the field. Drawn into `document.body` so its form is not nested in
 * the entry form; its submit stops here so it never saves the entry.
 */
function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hadLink = useRef(editor.isActive("link"));
  const [address, setAddress] = useState(
    () => (editor.getAttributes("link").href as string | undefined) ?? "",
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  /** Closes first: everything outside an open modal dialog is inert, so the
   *  writing area can take focus back only once it is gone. */
  function closeThen(run?: () => void) {
    dialog.current?.close();
    run?.();
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const href = address.trim();
    if (href === "") {
      closeThen(() => editor.chain().focus().extendMarkRange("link").unsetLink().run());
      return;
    }
    if (href.length > MAX_HREF_LENGTH) return setError(LINK_ERRORS.tooLong);
    if (!isSafeHref(href)) return setError(LINK_ERRORS.unsafe);
    closeThen(() => {
      if (editor.state.selection.empty && !hadLink.current) {
        // Nothing selected: the address itself becomes the linked text.
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    });
  }

  return createPortal(
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        editor.commands.focus();
      }}
    >
      <form method="dialog" onSubmit={apply}>
        <div className={styles.dialogBody}>
          <h2 id={titleId} className={styles.dialogTitle}>
            {hadLink.current ? "Edit link" : "Add a link"}
          </h2>
          <Field
            label="Web address"
            name="href"
            type="text"
            inputMode="url"
            autoComplete="off"
            value={address}
            error={error}
            onChange={(event) => {
              setAddress(event.currentTarget.value);
              setError(undefined);
            }}
          />
        </div>
        <div className={styles.dialogActions}>
          {hadLink.current ? (
            <Button
              type="button"
              variant="quiet"
              className={styles.removeLink}
              onClick={() =>
                closeThen(() => editor.chain().focus().extendMarkRange("link").unsetLink().run())
              }
            >
              Remove link
            </Button>
          ) : null}
          <Button type="button" variant="quiet" onClick={() => closeThen()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {hadLink.current ? "Save link" : "Add link"}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
