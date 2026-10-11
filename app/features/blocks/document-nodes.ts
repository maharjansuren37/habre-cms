/**
 * The v4 document's node types (item 14a1, D169) and the helpers that read
 * them, apart from the schema in `document.ts`: the public renderer needs these
 * in the browser bundle, and the schema would bring Zod with it - whose
 * `new Function` probe the public Content-Security-Policy reports.
 */

/** The most blocks a document may hold; here, not in `document.ts`, so the editor can read it without Zod. */
export const MAX_DOCUMENT_BLOCKS = 200;
export const MAX_CONTACT_BUTTON_LENGTH = 40;
export const MAX_CONTACT_THANKS_LENGTH = 200;
/** What a new contact form says, here so the editor's palette and the schema's defaults agree. */
export const CONTACT_FORM_DEFAULTS = {
  buttonLabel: "Send message",
  thanks: "Thanks - your message has been sent.",
} as const;

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } };
export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type Paragraph = { type: "paragraph"; content?: TextNode[] };
export type Heading = { type: "heading"; attrs: { level: number }; content?: TextNode[] };
export type ListItem = { type: "listItem"; content: [Paragraph] };
export type List = { type: "bulletList" | "orderedList"; content: ListItem[] };
export type Blockquote = { type: "blockquote"; content: Paragraph[] };
export type Image = { type: "image"; attrs: { mediaId: string } };
export type Button = {
  type: "button";
  attrs: { label: string; href: string; style: "filled" | "outline" };
};
export type ContactForm = {
  type: "contactForm";
  attrs: { buttonLabel: string; thanks: string };
};
export type HorizontalRule = { type: "horizontalRule" };
export type Space = { type: "space" };
export type Block =
  | Paragraph
  | Heading
  | List
  | Blockquote
  | Image
  | Button
  | ContactForm
  | HorizontalRule
  | Space;
export type Column = { type: "column"; content: Block[] };
export type Section = {
  type: "section";
  attrs: { align: "top" | "middle"; background: "none" | "band" };
  content: Column[];
};
export type Document = { type: "doc"; content: Section[] };

/** What the renderer needs of one media row, resolved at render time and never
 *  stored in the document (D55): where the file is, its alt text and its size.
 *  `srcset` lists every stored size; null for a row with only one object. */
export type DocumentMedia = {
  url: string;
  srcset: string | null;
  altText: string;
  width: number;
  height: number;
};

/** A page a button can go to, as the editor's "Goes to" list needs it: no body. */
export type LinkablePage = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
};

/** Every text node a block or list item holds, in reading order. */
export function textNodes(node: Block | ListItem): TextNode[] {
  if (node.type === "paragraph" || node.type === "heading") return node.content ?? [];
  if (
    node.type === "image" ||
    node.type === "button" ||
    node.type === "contactForm" ||
    node.type === "horizontalRule" ||
    node.type === "space"
  ) {
    return [];
  }
  return (node.content as (Paragraph | ListItem)[]).flatMap((child) => textNodes(child));
}

/** Every block in the document, section by section, column by column. */
export function blocksOf(document: Document): Block[] {
  return document.content.flatMap((section) => section.content.flatMap((column) => column.content));
}

/** A page's main heading: its first level-1 heading that has text. */
export function findMainHeading(document: Document): Heading | undefined {
  for (const block of blocksOf(document)) {
    if (block.type === "heading" && block.attrs.level === 1 && !isEmptyBlock(block)) return block;
  }
  return undefined;
}

/** Whether a block holds no visible text; a list or quote is empty when all its paragraphs are. */
export function isEmptyBlock(block: Block): boolean {
  return textNodes(block).every((node) => node.text.trim() === "");
}

/** Whether every block in every column of a section is empty. */
export function isEmptySection(section: Section): boolean {
  return section.content.every((column) => column.content.every(isEmptyBlock));
}

/**
 * Whether a block draws anything on the public site: a space never does, an
 * image only when its media exists, a button only with both text and an
 * address, a line and a contact form always, and a text block when it has visible text.
 */
export function isRenderedBlock(
  block: Block,
  mediaById: Readonly<Record<string, unknown>>,
): boolean {
  switch (block.type) {
    case "space":
      return false;
    case "image":
      return Object.hasOwn(mediaById, block.attrs.mediaId);
    case "button":
      return block.attrs.label.trim() !== "" && block.attrs.href !== "";
    case "horizontalRule":
    case "contactForm":
      return true;
    default:
      return !isEmptyBlock(block);
  }
}
