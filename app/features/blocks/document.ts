import { z } from "zod";
import { type Block, blocksOf, type Document, textNodes } from "./document-nodes.ts";
import { isSafeHref, isStorableText } from "./inline-runs.ts";

export type {
  Block,
  Blockquote,
  Button,
  Column,
  Document,
  Heading,
  HorizontalRule,
  Image,
  List,
  ListItem,
  Mark,
  Paragraph,
  Section,
  Space,
  TextNode,
} from "./document-nodes.ts";
export {
  findMainHeading,
  isEmptyBlock,
  isEmptySection,
  isRenderedBlock,
} from "./document-nodes.ts";

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
export const MAX_BUTTON_LABEL_LENGTH = 80;

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
  imageNeedsMedia: "An image needs a file from Media.",
  buttonLabelLong: `A button's text can be at most ${MAX_BUTTON_LABEL_LENGTH} characters.`,
  buttonStyle: "A button's style must be Filled or Outline.",
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

/**
 * At most one mark of each kind, the first kept (the renderer reads the first
 * link), and none stored as absent: the editor refuses two marks of one kind
 * (F-162), and one shape per meaning keeps what is stored canonical (F-155).
 */
const textSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1, REFUSALS.unreadable).refine(isStorableText, REFUSALS.badText),
    marks: z.array(markSchema).optional(),
  })
  .transform(({ marks, ...node }) => {
    const kept = (marks ?? []).filter(
      (mark, index, all) => all.findIndex((other) => other.type === mark.type) === index,
    );
    return kept.length > 0 ? { ...node, marks: kept } : node;
  });

/** Text content, with an empty list stored as absent - TipTap's own shape (F-155). */
const inlineContent = z
  .array(textSchema)
  .optional()
  .transform((content) => (content && content.length > 0 ? content : undefined));

function withoutEmptyContent<T extends { content?: unknown }>({ content, ...node }: T) {
  return content === undefined ? node : { ...node, content };
}

const paragraphSchema = z
  .object({ type: z.literal("paragraph"), content: inlineContent })
  .transform(withoutEmptyContent);

const headingSchema = z
  .object({
    type: z.literal("heading"),
    attrs: z.object({
      level: z.number().int().min(1, REFUSALS.badLevel).max(6, REFUSALS.badLevel),
    }),
    content: inlineContent,
  })
  .transform(withoutEmptyContent);

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

/** Atoms hold no text. Keys outside the contract are dropped, `content` included. */
const imageSchema = z.object({
  type: z.literal("image"),
  attrs: z.object({ mediaId: z.uuid(REFUSALS.imageNeedsMedia) }, REFUSALS.imageNeedsMedia),
});

const buttonSchema = z.object({
  type: z.literal("button"),
  attrs: z.object({
    label: z
      .string()
      .max(MAX_BUTTON_LABEL_LENGTH, REFUSALS.buttonLabelLong)
      .refine(isStorableText, REFUSALS.badText),
    href: z
      .string()
      .max(MAX_HREF_LENGTH, REFUSALS.longLink)
      .refine((href) => href === "" || isSafeHref(href), REFUSALS.badLink),
    style: z.enum(["filled", "outline"], REFUSALS.buttonStyle).default("filled"),
  }),
});

const horizontalRuleSchema = z.object({ type: z.literal("horizontalRule") });
const spaceSchema = z.object({ type: z.literal("space") });

const blockSchema = z.discriminatedUnion("type", [
  paragraphSchema,
  headingSchema,
  listSchema("bulletList"),
  listSchema("orderedList"),
  blockquoteSchema,
  imageSchema,
  buttonSchema,
  horizontalRuleSchema,
  spaceSchema,
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
  "image",
  "button",
  "horizontalRule",
  "space",
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
