import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import {
  type EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { CONTACT_FORM_DEFAULTS } from "./document-nodes.ts";
import { countBlocks, hasContactForm, mainHeading } from "./document-queries.ts";
import { type SectionTemplate, sectionTemplate } from "./section-templates.ts";

/** The palette's tiles, in the order it shows them. */
export const PALETTE_KINDS = [
  "text",
  "heading",
  "list",
  "image",
  "button",
  "contactForm",
  "quote",
  "line",
  "space",
] as const;
export type PaletteKind = (typeof PALETTE_KINDS)[number];

/** The note beside the Contact form tile, and the answer to Duplicate, once the document holds one. */
export const ONLY_ONE_CONTACT_FORM = "A page can hold only one contact form.";

/** A new block of this kind, as the palette adds it, and whether the cursor goes in it. */
export function newBlock(
  schema: Schema,
  kind: PaletteKind,
): { node: ProseMirrorNode; isText: boolean } {
  const { nodes } = schema;
  switch (kind) {
    case "text":
      return { node: nodes.paragraph.create(), isText: true };
    case "heading":
      return { node: nodes.heading.create({ level: 2 }), isText: true };
    case "list":
      return {
        node: nodes.bulletList.create(null, nodes.listItem.create(null, nodes.paragraph.create())),
        isText: true,
      };
    case "quote":
      return {
        node: nodes.blockquote.create(null, nodes.paragraph.create()),
        isText: true,
      };
    case "image":
      return { node: nodes.image.create({ mediaId: "" }), isText: false };
    case "button":
      return { node: nodes.button.create({ label: "", href: "", style: "filled" }), isText: false };
    case "contactForm":
      return { node: nodes.contactForm.create({ ...CONTACT_FORM_DEFAULTS }), isText: false };
    case "line":
      return { node: nodes.horizontalRule.create(), isText: false };
    case "space":
      return { node: nodes.space.create(), isText: false };
  }
}

/**
 * Where a new block goes: just after the column's direct child holding the
 * selection (the whole list or quote, never inside it), or after the selected
 * block itself. With no column around the selection, after the first block.
 */
export function insertionPoint(doc: ProseMirrorNode, selection: Selection): number {
  if (selection instanceof NodeSelection && selection.$from.parent.type.name === "column") {
    return selection.to;
  }
  const $head = selection.$head;
  // A gap cursor beside an atom has the column itself as its parent.
  if ($head.parent.type.name === "column") return $head.pos;
  for (let depth = $head.depth; depth > 0; depth--) {
    if ($head.node(depth - 1).type.name === "column") return $head.after(depth);
  }
  // Doc > section > column > first block.
  return 2 + doc.child(0).child(0).child(0).nodeSize;
}

/**
 * The transaction that adds one block of `kind`, as its own undo step: a text
 * block gets the cursor, anything else becomes the selected block. Null when
 * the document is already at the cap, or already holds a contact form and
 * `kind` is another one.
 */
export function insertBlock(
  state: EditorState,
  kind: PaletteKind,
  maxBlocks: number,
): Transaction | null {
  if (countBlocks(state.doc) >= maxBlocks) return null;
  if (kind === "contactForm" && hasContactForm(state.doc)) return null;

  const tr = closeHistory(state.tr);
  const at = insertionPoint(state.doc, state.selection);
  const { node, isText } = newBlock(state.schema, kind);
  tr.insert(at, node);
  if (isText) {
    const inside = Selection.findFrom(tr.doc.resolve(at + 1), 1, true);
    tr.setSelection(
      inside instanceof TextSelection ? inside : TextSelection.near(tr.doc.resolve(at + 1)),
    );
  } else {
    tr.setSelection(NodeSelection.create(tr.doc, at));
  }
  return tr.scrollIntoView();
}

/** The names the palette and the announcements use for each section template. */
export const SECTION_TEMPLATE_NAMES: Record<SectionTemplate, string> = {
  blank: "Blank section",
  hero: "Hero",
  "image-text": "Image and text",
  cta: "Call to action",
};

/** How many blocks a template adds: the children of each of its columns. */
export function templateBlockCount(kind: SectionTemplate): number {
  return sectionTemplate(kind, { mainHeading: false }).content.reduce(
    (total, column) => total + column.content.length,
    0,
  );
}

/**
 * Where a new section goes: directly after the top-level section holding the
 * selection. A gap cursor between sections goes there; before the first
 * section, or with no section around the selection, at the end.
 */
export function sectionInsertionPoint(doc: ProseMirrorNode, selection: Selection): number {
  const { $head } = selection;
  if ($head.depth === 0) return $head.pos > 0 ? $head.pos : doc.content.size;
  return $head.after(1);
}

/**
 * The position before top-level child `index`; the end of the document at the
 * child count. Null when `index` is outside 0 to the child count.
 */
export function topLevelPosition(doc: ProseMirrorNode, index: number): number | null {
  if (index < 0 || index > doc.childCount) return null;
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

/** Whether a `kind` section fits: under the section cap, and its blocks under the block cap. */
export function sectionFits(
  doc: ProseMirrorNode,
  kind: SectionTemplate,
  maxSections: number,
  maxBlocks: number,
): boolean {
  return doc.childCount < maxSections && countBlocks(doc) + templateBlockCount(kind) <= maxBlocks;
}

/**
 * The transaction that adds a ready-made section as its own undo step, with
 * the cursor in its first text block. It goes before top-level child `index`
 * (0 to the child count) when given, else after the selection's section. Null
 * when `index` is outside that range, the document is at the section cap, or
 * the template's blocks would pass the block cap.
 */
export function insertSection(
  state: EditorState,
  kind: SectionTemplate,
  options: { allowMainHeading: boolean; maxSections: number; maxBlocks: number; index?: number },
): Transaction | null {
  if (!sectionFits(state.doc, kind, options.maxSections, options.maxBlocks)) return null;
  const at =
    options.index === undefined
      ? sectionInsertionPoint(state.doc, state.selection)
      : topLevelPosition(state.doc, options.index);
  if (at === null) return null;
  const json = sectionTemplate(kind, {
    mainHeading: options.allowMainHeading && mainHeading(state.doc) === null,
  });
  const section = state.schema.nodeFromJSON(json);
  const tr = closeHistory(state.tr);
  tr.insert(at, section);
  let cursor = -1;
  section.descendants((node, pos) => {
    if (cursor >= 0) return false;
    if (node.isTextblock) {
      cursor = at + 1 + pos + 1;
      return false;
    }
    return true;
  });
  if (cursor >= 0) tr.setSelection(TextSelection.create(tr.doc, cursor));
  return tr.scrollIntoView();
}

/** "Hero added: now section 3 of 5." */
export function sectionAddedAnnouncement(
  kind: SectionTemplate,
  index: number,
  total: number,
): string {
  return `${SECTION_TEMPLATE_NAMES[kind]} added: now section ${index + 1} of ${total}.`;
}
