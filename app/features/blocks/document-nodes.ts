/**
 * The v4 document's node types (item 14a1, D169) and the helpers that read
 * them, apart from the schema in `document.ts`: the public renderer needs these
 * in the browser bundle, and the schema would bring Zod with it - whose
 * `new Function` probe the public Content-Security-Policy reports.
 */

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
export type Block = Paragraph | Heading | List | Blockquote;
export type Column = { type: "column"; content: Block[] };
export type Section = {
  type: "section";
  attrs: { align: "top" | "middle"; background: "none" | "band" };
  content: Column[];
};
export type Document = { type: "doc"; content: Section[] };

/** Every text node a block or list item holds, in reading order. */
export function textNodes(node: Block | ListItem): TextNode[] {
  if (node.type === "paragraph" || node.type === "heading") return node.content ?? [];
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
