import { z } from "zod";
import { isSafeHref, isStorableText } from "./inline-runs.ts";

/**
 * The stored shape of post and page content from `blocks_format` v4: one
 * ProseMirror document (what the editor's `getJSON()` emits), narrowed to what
 * Habre accepts. What is stored is this schema's output, never the submitted
 * JSON: keys and attrs outside the contract are dropped, a node or mark outside
 * it is refused.
 */
export const BLOCKS_FORMAT_V4 = "v4";

export const MAX_SECTIONS = 30;
export const MAX_COLUMNS = 3;
export const MAX_DOCUMENT_BLOCKS = 200;
export const MAX_BLOCK_TEXT_LENGTH = 20_000;
export const MAX_BLOCK_TEXT_NODES = 2_000;
export const MAX_LIST_ITEMS = 500;
export const MAX_HREF_LENGTH = 2_048;

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

const REFUSALS = {
  unreadable: "The editor sent content in a shape this version cannot read.",
  unknownNode: "The editor sent something it cannot save yet.",
  unknownMark: "The editor sent formatting it cannot save yet.",
  hardBreak: "Line breaks inside a paragraph cannot be saved. Start a new paragraph instead.",
  nestedList: "Lists cannot hold other lists yet.",
  noSections: "There must be at least one section.",
  tooManySections: `You can have at most ${MAX_SECTIONS} sections.`,
  noColumns: "A section needs at least one column.",
  tooManyColumns: `A section can have at most ${MAX_COLUMNS} columns.`,
  emptyColumn: "A column cannot be empty.",
  tooManyBlocks: `You can have at most ${MAX_DOCUMENT_BLOCKS} blocks.`,
  tooLong: "A block can hold at most 20,000 characters.",
  tooManyTexts: "A block has too many pieces of formatted text. Remove some formatting.",
  badLink:
    "A link address cannot be used. Use a web address, an email link or a page on this site.",
  longLink: "A link address can be at most 2,048 characters.",
  badText: "The text holds a character that cannot be saved.",
  badLevel: "A heading level must be from 1 to 6.",
  emptyList: "A list needs at least one item.",
  tooLongList: `A list can have at most ${MAX_LIST_ITEMS} items.`,
  postMainHeading: "A post's title is its main heading - use Heading or smaller.",
  pageMainHeading: "A page can have only one main heading - use Heading or smaller for the others.",
} as const;

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().max(MAX_HREF_LENGTH, REFUSALS.longLink).refine(isSafeHref, REFUSALS.badLink),
    }),
  }),
]);

const textSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1, REFUSALS.unreadable).refine(isStorableText, REFUSALS.badText),
  marks: z.array(markSchema).optional(),
});

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(textSchema).optional(),
});

const headingSchema = z.object({
  type: z.literal("heading"),
  attrs: z.object({
    level: z.number().int().min(1, REFUSALS.badLevel).max(6, REFUSALS.badLevel),
  }),
  content: z.array(textSchema).optional(),
});

const listItemSchema = z.object({
  type: z.literal("listItem"),
  content: z.tuple([paragraphSchema]),
});

const listSchema = (type: "bulletList" | "orderedList") =>
  z.object({
    type: z.literal(type),
    content: z
      .array(listItemSchema)
      .min(1, REFUSALS.emptyList)
      .max(MAX_LIST_ITEMS, REFUSALS.tooLongList),
  });

const blockquoteSchema = z.object({
  type: z.literal("blockquote"),
  content: z.array(paragraphSchema).min(1, REFUSALS.unreadable),
});

const blockSchema = z.discriminatedUnion("type", [
  paragraphSchema,
  headingSchema,
  listSchema("bulletList"),
  listSchema("orderedList"),
  blockquoteSchema,
]);

const columnSchema = z.object({
  type: z.literal("column"),
  content: z.array(blockSchema).min(1, REFUSALS.emptyColumn),
});

const sectionSchema = z.object({
  type: z.literal("section"),
  attrs: z
    .object({
      align: z.enum(["top", "middle"]).default("top"),
      background: z.enum(["none", "band"]).default("none"),
    })
    .prefault({}),
  content: z
    .array(columnSchema)
    .min(1, REFUSALS.noColumns)
    .max(MAX_COLUMNS, REFUSALS.tooManyColumns),
});

const documentSchema = z.object({
  type: z.literal("doc"),
  content: z
    .array(sectionSchema)
    .min(1, REFUSALS.noSections)
    .max(MAX_SECTIONS, REFUSALS.tooManySections),
});

const KNOWN_NODES = new Set([
  "doc",
  "section",
  "column",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "text",
]);
const KNOWN_MARKS = new Set(["bold", "italic", "link"]);
const OWN_MESSAGES = new Set<string>(Object.values(REFUSALS));
/** doc > section > column > list > listItem > paragraph > text; anything deeper is refused. */
const MAX_DEPTH = 7;
const LIST_TYPES = new Set(["bulletList", "orderedList"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Finds a node or mark the contract does not have, naming the one refusal that
 * explains it. Run before the schema, whose own message for these would be a
 * union mismatch. `insideItem` is true below a list item, where a list is nested.
 * The depth limit keeps a hostile nesting from exhausting the stack.
 */
function findUnsupported(node: unknown, insideItem = false, depth = 1): string | undefined {
  if (!isRecord(node)) return undefined;
  if (depth > MAX_DEPTH) return REFUSALS.unreadable;
  const { type, content, marks } = node;
  if (type === "hardBreak") return REFUSALS.hardBreak;
  if (typeof type === "string" && !KNOWN_NODES.has(type)) return REFUSALS.unknownNode;
  if (insideItem && typeof type === "string" && LIST_TYPES.has(type)) return REFUSALS.nestedList;
  if (Array.isArray(marks)) {
    for (const mark of marks) {
      if (isRecord(mark) && typeof mark.type === "string" && !KNOWN_MARKS.has(mark.type)) {
        return REFUSALS.unknownMark;
      }
    }
  }
  if (!Array.isArray(content)) return undefined;
  for (const child of content) {
    const found = findUnsupported(child, insideItem || type === "listItem", depth + 1);
    if (found) return found;
  }
  return undefined;
}

function textLength(block: Block): number {
  return textNodes(block).reduce((sum, node) => sum + node.text.length, 0);
}

function textNodes(node: Block | ListItem): TextNode[] {
  if (node.type === "paragraph" || node.type === "heading") return node.content ?? [];
  return (node.content as (Paragraph | ListItem)[]).flatMap((child) => textNodes(child));
}

function blocksOf(document: Document): Block[] {
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

/** What a new entry starts with. */
export function emptyDocument(): Document {
  return {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [{ type: "column", content: [{ type: "paragraph" }] }],
      },
    ],
  };
}

export type ParsedDocument = { ok: true; document: Document } | { ok: false; message: string };

export function parseDocument(input: unknown, type: "post" | "page"): ParsedDocument {
  const unsupported = findUnsupported(input);
  if (unsupported) return { ok: false, message: unsupported };

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "";
    return { ok: false, message: OWN_MESSAGES.has(message) ? message : REFUSALS.unreadable };
  }
  const document = parsed.data as Document;

  const blocks = blocksOf(document);
  if (blocks.length > MAX_DOCUMENT_BLOCKS) return { ok: false, message: REFUSALS.tooManyBlocks };
  for (const block of blocks) {
    if (textNodes(block).length > MAX_BLOCK_TEXT_NODES) {
      return { ok: false, message: REFUSALS.tooManyTexts };
    }
    if (textLength(block) > MAX_BLOCK_TEXT_LENGTH) return { ok: false, message: REFUSALS.tooLong };
  }

  const mainHeadings = blocks.filter((b) => b.type === "heading" && b.attrs.level === 1).length;
  if (type === "post" && mainHeadings > 0) return { ok: false, message: REFUSALS.postMainHeading };
  if (type === "page" && mainHeadings > 1) return { ok: false, message: REFUSALS.pageMainHeading };

  return { ok: true, document };
}
