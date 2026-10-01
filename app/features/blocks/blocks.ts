import { z } from "zod";
import {
  isSafeHref,
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
      sections: z.array(
        z.object({
          id: blockId,
          columns: z.array(z.unknown()).optional(),
          kind: z.string().optional(),
          fields: z.unknown().optional(),
        }),
      ),
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
    if (section.kind !== undefined) {
      // The kind is named by the client, but everything stored is built here.
      if (!isSlotKind(section.kind) || section.columns !== undefined)
        return { ok: false, message: UNREADABLE_SHAPE };
      const ready = slotSectionFromFields(
        section.kind,
        section.id,
        section.fields,
        `Section ${index + 1} (${SLOT_KIND_LABELS[section.kind]})`,
      );
      if (!ready.ok) return ready;
      sections.push(ready.section);
      continue;
    }
    if (section.columns === undefined) return { ok: false, message: UNREADABLE_SHAPE };
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

/** The ready-made kinds, by their wire name and the label messages use. */
const SLOT_KIND_LABELS = {
  hero: "hero",
  cta: "call to action",
  "image-text": "image and text",
} as const;
type SlotKind = keyof typeof SLOT_KIND_LABELS;
const isSlotKind = (kind: string | undefined): kind is SlotKind =>
  kind !== undefined && Object.hasOwn(SLOT_KIND_LABELS, kind);

const heroFieldsSchema = z.object({
  // Only an image and text section reads it; the other kinds ignore it.
  mediaId: z.string().optional(),
  heading: z.string(),
  text: z.string(),
  buttonLabel: z.string(),
  buttonHref: z.string(),
});

/** A form field's text: line breaks and runs of whitespace become one space, the
 *  ends are trimmed - a hero slot is a single line of text. */
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * A ready-made section (hero, call to action or image and text) from the
 * editor's fields, or the sentence the writer reads. On a hero or an image and
 * text an empty label and an empty link together mean "no button"; a call to
 * action must have one, and an image and text must have an image. Exactly one of the
 * two is refused rather than guessed at. `name` says which section
 * ("Section 2 (hero)").
 */
function slotSectionFromFields(
  type: SlotKind,
  id: string,
  input: unknown,
  name: string,
): { ok: true; section: unknown } | { ok: false; message: string } {
  const parsed = heroFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: UNREADABLE_SHAPE };
  const heading = tidy(parsed.data.heading);
  const text = tidy(parsed.data.text);
  const label = tidy(parsed.data.buttonLabel);
  const href = parsed.data.buttonHref.trim();

  const refuse = (message: string) => ({ ok: false, message: `${name}: ${message}` }) as const;
  const mediaId = (parsed.data.mediaId ?? "").trim();
  if (type === "image-text" && !z.uuid().safeParse(mediaId).success)
    return refuse("choose an image.");
  if (heading.length === 0) return refuse("the heading is required.");
  if (heading.length > HERO_HEADING_MAX)
    return refuse(`the heading is longer than ${HERO_HEADING_MAX} characters. Shorten it.`);
  if (text.length > HERO_TEXT_MAX)
    return refuse(`the text is longer than ${HERO_TEXT_MAX} characters. Shorten it.`);
  if (label.length > HERO_LABEL_MAX)
    return refuse(`the button label is longer than ${HERO_LABEL_MAX} characters. Shorten it.`);
  if (type === "cta" && (label.length === 0 || href.length === 0))
    return refuse("the button needs a label and a link.");
  if (label.length === 0 && href.length > 0)
    return refuse("the button has a link but no label. Add a label, or clear the link.");
  if (label.length > 0 && href.length === 0)
    return refuse("the button has a label but no link. Add a link, or clear the label.");
  if (href.length > 0 && !isSafeHref(href))
    return refuse(
      "the button link cannot be used. Links must start with https://, http://, mailto:, # or a single /.",
    );
  for (const value of [heading, text, label])
    if (!isStorableText(value)) return refuse("a character in it cannot be saved. Remove it.");

  return {
    ok: true,
    section: {
      id,
      type,
      data: {
        ...(type === "image-text" ? { mediaId } : {}),
        heading,
        text,
        ...(label ? { button: { label, href } } : {}),
      },
    },
  };
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
const sectionId = blockId.regex(
  /^[A-Za-z0-9_-]+$/,
  "section ids may only use letters, digits, _ and -",
);

const plainSectionBlock = z.object({
  // Letters, digits, `_` and `-`: the editor builds a selector from it, and
  // `crypto.randomUUID()` already fits.
  id: sectionId,
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

export const HERO_HEADING_MAX = 120;
export const HERO_TEXT_MAX = 400;
export const HERO_LABEL_MAX = 40;

/** A slot's text: stored as typed, one line, nothing the database cannot hold. */
const slot = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine(isStorableText, "a character that cannot be stored")
    .refine((value) => !/[\r\n]/.test(value), "a line break");

/**
 * A ready-made hero (item 12a): a heading, a line of text and an optional
 * button, as plain strings - the slots are form fields, so there are no marks
 * to store. The button's link passes the same allowlist as a link in text.
 */
const heroBlock = z.object({
  id: sectionId,
  type: z.literal("hero"),
  data: z.strictObject({
    heading: slot(1, HERO_HEADING_MAX),
    text: slot(0, HERO_TEXT_MAX),
    button: z
      .strictObject({
        label: slot(1, HERO_LABEL_MAX),
        href: z.string().refine(isSafeHref, "a link address that cannot be used"),
      })
      .optional(),
  }),
});

/**
 * A ready-made call to action (item 12b): the hero's slots, but the button is
 * always there - a call to action with nothing to click is a hero.
 */
const ctaBlock = z.object({
  id: sectionId,
  type: z.literal("cta"),
  data: z.strictObject({
    heading: slot(1, HERO_HEADING_MAX),
    text: slot(0, HERO_TEXT_MAX),
    button: z.strictObject({
      label: slot(1, HERO_LABEL_MAX),
      href: z.string().refine(isSafeHref, "a link address that cannot be used"),
    }),
  }),
});

/**
 * A ready-made image and text (item 12c): the hero's slots plus one picture,
 * stored as a media id only - url, alt text and size are resolved at render, as
 * for an image block.
 */
const imageTextBlock = z.object({
  id: sectionId,
  type: z.literal("image-text"),
  data: z.strictObject({
    mediaId: z.uuid(),
    heading: slot(1, HERO_HEADING_MAX),
    text: slot(0, HERO_TEXT_MAX),
    button: z
      .strictObject({
        label: slot(1, HERO_LABEL_MAX),
        href: z.string().refine(isSafeHref, "a link address that cannot be used"),
      })
      .optional(),
  }),
});

/** Every kind of section a page can hold, told apart by `type`. */
const sectionBlock = z.discriminatedUnion("type", [
  plainSectionBlock,
  heroBlock,
  ctaBlock,
  imageTextBlock,
]);

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
  // limit and the save-time target however the blocks are spread. Only plain
  // sections hold blocks.
  .refine(
    (sections) =>
      sections.reduce(
        (total, section) =>
          total + (section.type === "section" ? section.data.children.flat().length : 0),
        0,
      ) <= MAX_PAGE_BLOCKS,
    `a page can hold at most ${MAX_PAGE_BLOCKS} blocks in total`,
  );

export type PlainSection = z.infer<typeof plainSectionBlock>;
export type HeroSection = z.infer<typeof heroBlock>;
export type CtaSection = z.infer<typeof ctaBlock>;
export type ImageTextSection = z.infer<typeof imageTextBlock>;
export type Section = z.infer<typeof sectionBlock>;

/** The id of the section a not-yet-resaved `v2` page is shown as. */
export const LEGACY_SECTION_ID = "legacy";

/** A `v2` page's flat blocks as the one section they load as. */
export function sectionsFromBlocks(blocks: Block[]): PlainSection[] {
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
    } else if (item.type === "image-text") ids.add(item.data.mediaId);
    else if (item.type !== "hero" && item.type !== "cta") visit(item);
  }
  return [...ids];
}
