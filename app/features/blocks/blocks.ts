import { z } from "zod";
import {
  isStorableText,
  parseInlineHtml,
  type Refusal,
  type Run,
  runsSchema,
  runsToHtml,
} from "./inline-runs.ts";

/**
 * The stored shape of post and page content: an ordered list of blocks, each
 * `{ id, type, data }`. Defined once and used by the editor, the save action and
 * (from item 4) the public renderer.
 *
 * **Text is a list of runs** (`inline-runs.ts`): plain text carrying bold,
 * italic and links. `v1` held plain strings; `0003_blocks_v2.sql` converted
 * them. Nothing here ever holds HTML: the editor's markup is parsed into runs on
 * the way in, and escaped on the way out.
 */
export const BLOCKS_FORMAT = "v2";

// Editor.js generates ids; the cap is a bound on anything a client can send.
// The id shares the run text's storability rule - it goes into the same jsonb.
const blockId = z
  .string()
  .min(1)
  .max(64)
  .refine(isStorableText, "a character that cannot be stored");

const textBlock = z.object({
  id: blockId,
  type: z.literal("text"),
  data: z.object({ text: runsSchema }),
});

// Levels 2 and 3 only: the page's own <h1> is the entry title, so a heading
// block can never be one.
const headingBlock = z.object({
  id: blockId,
  type: z.literal("heading"),
  data: z.object({ text: runsSchema, level: z.union([z.literal(2), z.literal(3)]) }),
});

const listBlock = z.object({
  id: blockId,
  type: z.literal("list"),
  data: z.object({
    style: z.enum(["bullet", "number"]),
    items: z.array(runsSchema).min(1).max(500),
  }),
});

// The only thing a block ever stores for an image - never a url, alt text or
// caption (item 5a's own contract: those live on the media row and are
// resolved at read time, so a bucket or domain change never touches content).
const imageBlock = z.object({
  id: blockId,
  type: z.literal("image"),
  data: z.object({ mediaId: z.uuid() }),
});

export const blockSchema = z.discriminatedUnion("type", [
  textBlock,
  headingBlock,
  listBlock,
  imageBlock,
]);
export const blocksSchema = z.array(blockSchema).max(200);

export type Block = z.infer<typeof blockSchema>;

/** A resolved image block's other half - looked up by media id at read time,
 *  never stored on the block itself. */
export type ImageMediaSummary = { url: string; altText: string; width: number; height: number };

/** What Editor.js calls each block type, and what this project calls it. */
const EDITOR_JS_TYPES = {
  paragraph: "text",
  header: "heading",
  list: "list",
  image: "image",
} as const;

/**
 * `@editorjs/list` 2.0.9 saves each item as `{ content, meta, items }`, not as a
 * string - `String(item)` on one gives `"[object Object]"`, which is how every
 * list was stored until F-32. A string is still accepted, because a hand-written
 * payload may send one.
 *
 * **Nested items are flattened, not dropped and not kept as a tree.** The tool
 * is configured with `maxLevel: 1` so the editor cannot make them; this is the
 * defensive half, and flattening keeps a writer's words when something else
 * sends them. A nested list shape belongs to the page builder, which will need a
 * new `blocks_format`.
 */
// Deeper than any list a person writes, and shallow enough that a crafted body
// cannot exhaust the stack: unbounded recursion here threw RangeError and
// answered 500 (F-41). The format holds one level anyway.
const MAX_LIST_DEPTH = 8;
// Matches the schema's own cap, so a body cannot build a huge array first.
const MAX_LIST_ITEMS = 500;

/** Each item's HTML, in order; parsed into runs by the caller. */
function flattenListItems(items: unknown, depth = 0): string[] {
  // Anything that is not an array - including a string, which would otherwise be
  // iterated one character at a time and stored as that many list items.
  if (depth > MAX_LIST_DEPTH || !Array.isArray(items)) return [];
  const flat: string[] = [];
  for (const item of items) {
    // Bounds the work, not the correctness: the schema refuses past 500 items
    // either way, so no test can tell this line from its absence. It stops a
    // crafted body building a 150,000-element array first.
    if (flat.length > MAX_LIST_ITEMS) break;
    if (typeof item === "string") {
      flat.push(item);
      continue;
    }
    // `typeof null === "object"`, so null has to be excluded by name: reading
    // `.content` off it threw a TypeError to the action, which has no catch.
    if (item === null || typeof item !== "object") continue;
    const listItem = item as { content?: unknown; items?: unknown };
    flat.push(String(listItem.content ?? ""));
    // Pushed one at a time, not spread: spreading a very wide child exhausts
    // the call stack, which the depth bound cannot see (one level, 150k items).
    for (const nested of flattenListItems(listItem.items, depth + 1)) flat.push(nested);
  }
  return flat;
}

export type FromEditorJs = { ok: true; blocks: Block[] } | { ok: false; message: string };

/** What happened and what to do, for each refusal (design.md, Words). */
const REFUSAL_MESSAGES: Record<Refusal, (block: string) => string> = {
  unsafe_link: (block) =>
    `${block} has a link to an address that cannot be used. Links must start with https://, http://, mailto:, # or a single /.`,
  link_too_long: (block) =>
    `${block} has a link address longer than 2,048 characters. Shorten the link, then save.`,
  too_long: (block) =>
    `${block} could not be saved: it is longer than 20,000 characters. Split it into smaller blocks.`,
  too_much_formatting: (block) =>
    `${block} has too much formatting to save. Remove some bold, italic or links, or split it into smaller blocks.`,
};

/** One piece of the editor's HTML as runs, or the sentence the writer reads. */
function toRuns(
  html: string,
  blockName: string,
): { ok: true; runs: Run[] } | { ok: false; message: string } {
  const parsed = parseInlineHtml(html);
  if (parsed.ok) return parsed;
  return { ok: false, message: REFUSAL_MESSAGES[parsed.reason](blockName) };
}

/**
 * Turns what the editor submits into stored blocks. Every failure names the
 * block that caused it, because the editor shows this message to a person who
 * has to find it among their own writing. `scope` (for a page, "Section 2")
 * says which editor the block is in.
 */
export function fromEditorJs(input: unknown, scope?: string): FromEditorJs {
  const nameOf = (position: number) =>
    scope ? `${scope}, block ${position}` : `Block ${position}`;
  const outer = z.object({
    blocks: z.array(z.object({ id: blockId, type: z.string(), data: z.unknown() })),
  });
  const parsed = outer.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "The editor sent content in a shape this version cannot read." };

  const blocks: unknown[] = [];
  for (const [index, block] of parsed.data.blocks.entries()) {
    const type = EDITOR_JS_TYPES[block.type as keyof typeof EDITOR_JS_TYPES];
    if (!type) {
      return {
        ok: false,
        message: `${nameOf(index + 1)} is a "${block.type}", which cannot be saved yet.`,
      };
    }
    if (type === "list") {
      const list = block.data as { style?: string; items?: unknown[] };
      // Editor.js says ordered/unordered; this project says number/bullet.
      // Anything else - checklist, which the tool can produce - is refused by
      // name rather than stored as a bullet list with its ticks thrown away.
      if (list.style !== "ordered" && list.style !== "unordered") {
        // The tool builds Unordered / Ordered / Checklist into every list
        // block's settings menu and ignores the toolbox config, so a writer can
        // still reach a checklist. Refusing protects the ticks, but leaves them
        // unable to save anything until they undo it - so the message says how
        // (F-35), rather than only naming what is wrong.
        return {
          ok: false,
          message:
            list.style === "checklist"
              ? `${nameOf(index + 1)} is a checklist, which cannot be saved yet. Open that block's settings and choose Unordered or Ordered, then save.`
              : `${nameOf(index + 1)} is a "${list.style}" list, which cannot be saved yet.`,
        };
      }
      const items: Run[][] = [];
      for (const html of flattenListItems(list.items ?? [])) {
        const item = toRuns(html, nameOf(index + 1));
        if (!item.ok) return item;
        // An empty item is dropped, as an empty string was in v1.
        if (item.runs.length > 0) items.push(item.runs);
      }
      blocks.push({
        id: block.id,
        type,
        data: { style: list.style === "ordered" ? "number" : "bullet", items },
      });
      continue;
    }
    if (type === "image") {
      const image = block.data as { mediaId?: unknown };
      // The uuid shape is enforced below by blocksSchema, the same place
      // every other block's data shape is enforced - not re-checked here.
      blocks.push({ id: block.id, type, data: { mediaId: image.mediaId } });
      continue;
    }
    const data = block.data as { text?: unknown; level?: unknown };
    const text = toRuns(String(data.text ?? ""), nameOf(index + 1));
    if (!text.ok) return text;
    blocks.push({
      id: block.id,
      type,
      data: type === "heading" ? { text: text.runs, level: data.level } : { text: text.runs },
    });
  }

  const validated = blocksSchema.safeParse(blocks);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    const position = typeof issue?.path[0] === "number" ? issue.path[0] + 1 : 1;
    return {
      ok: false,
      message: `${nameOf(position)} could not be saved: ${issue?.message ?? "invalid content"}.`,
    };
  }
  return { ok: true, blocks: validated.data };
}

export type FromEditorJsSections =
  | { ok: true; sections: Section[] }
  | { ok: false; message: string };

const UNREADABLE_SHAPE = "The editor sent content in a shape this version cannot read.";
const STALE_EDITOR =
  "This page editor is from an older version of the site. Copy your changes, reload, and paste them in.";

/**
 * A page's save: what the section editor submits, `{ sections: [{ id, columns:
 * [{ blocks }] }] }`, as stored sections. Each column goes through `fromEditorJs`
 * so a failure names its section, column and block. The layout is never taken
 * from the client: it is the number of columns sent, and a section with none, or
 * with more than `MAX_COLUMNS`, is a shape this version cannot read.
 */
export function fromEditorJsSections(input: unknown): FromEditorJsSections {
  const outer = z
    .object({
      sections: z.array(z.object({ id: blockId, columns: z.array(z.unknown()) })),
    })
    .safeParse(input);
  // A tab opened before sections existed still sends the flat shape.
  if (!outer.success && z.object({ blocks: z.array(z.unknown()) }).safeParse(input).success)
    return { ok: false, message: STALE_EDITOR };
  // Bounds the work before any column is parsed, as the list flattening does.
  if (!outer.success || outer.data.sections.length > MAX_SECTIONS)
    return { ok: false, message: UNREADABLE_SHAPE };

  const sections: unknown[] = [];
  for (const [index, section] of outer.data.sections.entries()) {
    const count = section.columns.length;
    if (count < 1 || count > MAX_COLUMNS) return { ok: false, message: UNREADABLE_SHAPE };
    const children: Block[][] = [];
    for (const [columnIndex, column] of section.columns.entries()) {
      const blocks = fromEditorJs(
        column,
        count === 1 ? `Section ${index + 1}` : `Section ${index + 1}, column ${columnIndex + 1}`,
      );
      if (!blocks.ok) return blocks;
      children.push(blocks.blocks);
    }
    sections.push({ id: section.id, type: "section", data: { layout: String(count), children } });
  }

  const validated = sectionsSchema.safeParse(sections);
  if (!validated.success) {
    return {
      ok: false,
      message: `This page could not be saved: ${validated.error.issues[0]?.message ?? "invalid content"}.`,
    };
  }
  return { ok: true, sections: validated.data };
}

/**
 * The inverse, for loading a saved entry back into the editor. Editor.js
 * sanitizes on save and on paste, **never on render** - its tools assign
 * `innerHTML` - so text goes through `runsToHtml`, which escapes it (F-33).
 *
 * `mediaById` resolves each image block's id to what the tool needs to show
 * a preview - the caller (the loader, which already queried the database)
 * builds it once for the whole entry, not per block. A missing entry means
 * the file was deleted from the library after being placed (spec's own
 * Decisions: degrades rather than being prevented).
 */
export function toEditorJs(
  blocks: Block[],
  mediaById: Record<string, ImageMediaSummary> = {},
): { blocks: { id: string; type: string; data: unknown }[] } {
  return {
    blocks: blocks.map((block) => {
      if (block.type === "list") {
        return {
          id: block.id,
          type: "list",
          data: {
            style: block.data.style === "number" ? "ordered" : "unordered",
            // The tool reads `{ content, meta, items }`, the same shape it
            // saves; handing it bare strings renders an empty list.
            items: block.data.items.map((content) => ({
              content: runsToHtml(content),
              meta: {},
              items: [],
            })),
          },
        };
      }
      if (block.type === "image") {
        const media = mediaById[block.data.mediaId];
        return {
          id: block.id,
          type: "image",
          data: media
            ? { mediaId: block.data.mediaId, ...media }
            : { mediaId: block.data.mediaId, missing: true },
        };
      }
      return {
        id: block.id,
        type: block.type === "heading" ? "header" : "paragraph",
        data: { ...block.data, text: runsToHtml(block.data.text) },
      };
    }),
  };
}

export const MAX_SECTIONS = 30;
export const MAX_COLUMNS = 3;
export const MAX_PAGE_BLOCKS = 200;
/** What a page stores once it is `v3`; posts stay `BLOCKS_FORMAT`. */
export const PAGE_BLOCKS_FORMAT = "v3";

/**
 * A page's section (`blocks_format` v3, D114). `children` is a list of columns,
 * each a list of the leaf blocks above - nesting stops there, so a section can
 * never contain a section. `layout` is the column count as a string, and the two
 * must agree - the server derives the layout from the columns it is sent.
 */
const sectionBlock = z.object({
  // Letters, digits, `_` and `-`: the editor builds a selector from it, and
  // `crypto.randomUUID()` already fits.
  id: blockId.regex(/^[A-Za-z0-9_-]+$/, "section ids may only use letters, digits, _ and -"),
  type: z.literal("section"),
  data: z
    .object({
      layout: z.enum(["1", "2", "3"]),
      children: z.array(z.array(blockSchema).max(MAX_PAGE_BLOCKS)).min(1).max(MAX_COLUMNS),
    })
    .refine((data) => data.children.length === Number(data.layout), {
      message: "a section must hold as many columns as its layout says",
      path: ["children"],
    }),
});

export const sectionsSchema = z
  .array(sectionBlock)
  .min(1)
  .max(MAX_SECTIONS)
  // Two equal ids would share one editor reader and lose a section's content.
  .refine(
    (sections) => new Set(sections.map((section) => section.id)).size === sections.length,
    "section ids must be unique",
  )
  // The same 200 as a post, in total: it keeps a save under the request size
  // limit and the save-time target however the blocks are spread.
  .refine(
    (sections) =>
      sections.reduce((total, section) => total + section.data.children.flat().length, 0) <=
      MAX_PAGE_BLOCKS,
    `a page can hold at most ${MAX_PAGE_BLOCKS} blocks in total`,
  );

export type Section = z.infer<typeof sectionBlock>;

/** The id of the section a not-yet-resaved `v2` page is shown as. */
export const LEGACY_SECTION_ID = "legacy";

/** A `v2` page's flat blocks as the one section they load as. */
export function sectionsFromBlocks(blocks: Block[]): Section[] {
  return [
    {
      id: LEGACY_SECTION_ID,
      type: "section",
      data: { layout: "1", children: [blocks] },
    },
  ];
}

/** The unique media ids a set of blocks, or of sections, references, for the
 *  loader to resolve in one query rather than one per image. */
export function collectImageMediaIds(items: (Block | Section)[]): string[] {
  const ids = new Set<string>();
  const visit = (block: Block) => {
    if (block.type === "image") ids.add(block.data.mediaId);
  };
  for (const item of items) {
    if (item.type === "section") {
      for (const column of item.data.children) column.forEach(visit);
    } else visit(item);
  }
  return [...ids];
}
