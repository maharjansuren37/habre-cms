import { mergeAttributes, Node } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import content from "./content.module.css";
import styles from "./document-editor.module.css";
import type { Document } from "./document-nodes.ts";
import { isSafeHref } from "./inline-runs.ts";

/** The longest link address a document may hold (`document.ts`, the contract). */
const MAX_HREF_LENGTH = 2_048;

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
  renderHTML: ({ node, HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, { class: content.section, "data-node": "section" }),
    ["div", { class: content.columns, "data-columns": String(node.childCount) }, 0],
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
}: {
  initialDocument: Document;
  entryType: "post" | "page";
  /** Reads the current document - the same hand-off the older editors use. */
  contentRef: { current: (() => Promise<unknown>) | null };
  onChange: () => void;
  barSlot: HTMLElement | null;
}) {
  const copy = COPY[entryType];
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // The entry form mounts this after hydration; never on the server.
    immediatelyRender: false,
    // Its few required rules live in document-editor.module.css, so the admin
    // can later drop 'unsafe-inline' from its style policy.
    injectCSS: false,
    extensions: extensionsFor(copy.placeholder),
    content: initialDocument,
    editorProps: {
      attributes: {
        class: [content.document, styles.prose].join(" "),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": copy.label,
      },
    },
    onUpdate: () => latestOnChange.current(),
  });

  useEffect(() => {
    if (!editor) return;
    contentRef.current = async () => editor.getJSON();
    return () => {
      contentRef.current = null;
    };
  }, [editor, contentRef]);

  return (
    <>
      {barSlot && editor ? createPortal(<FormatBar editor={editor} />, barSlot) : null}
      <div data-surface="site" className={styles.site}>
        <EditorContent editor={editor} />
      </div>
    </>
  );
}

type Editor = NonNullable<ReturnType<typeof useEditor>>;

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
    const chain = editor.chain().focus();
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

const LINK_ERRORS = {
  unsafe:
    "This address cannot be used. Use a web address (https://…), an email link (mailto:…) or a page on this site (/…).",
  tooLong: "This address is too long. A link address can be at most 2,048 characters.",
} as const;

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
