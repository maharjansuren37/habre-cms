import { z } from "zod";

/**
 * The stored shape of post and page content: an ordered list of blocks, each
 * `{ id, type, data }`. Defined once and used by the editor, the save action and
 * (from item 4) the public renderer.
 *
 * **Text is plain text in this format version.** Item 2b introduces `v2`, where
 * `text` becomes a list of runs carrying bold, italic and links, and migrates
 * existing rows. Nothing here ever holds HTML: the editor's markup is stripped
 * on the way in, and the renderer escapes on the way out.
 */
export const BLOCKS_FORMAT = "v1";

// Editor.js generates ids; the cap is a bound on anything a client can send.
const blockId = z.string().min(1).max(64);
// 20,000 characters is far longer than a paragraph anyone writes and short
// enough that 200 of them stay a sane request body.
const plainText = z.string().max(20_000);

const textBlock = z.object({
  id: blockId,
  type: z.literal("text"),
  data: z.object({ text: plainText }),
});

// Levels 2 and 3 only: the page's own <h1> is the entry title, so a heading
// block can never be one.
const headingBlock = z.object({
  id: blockId,
  type: z.literal("heading"),
  data: z.object({ text: plainText, level: z.union([z.literal(2), z.literal(3)]) }),
});

const listBlock = z.object({
  id: blockId,
  type: z.literal("list"),
  data: z.object({
    style: z.enum(["bullet", "number"]),
    items: z.array(plainText).min(1).max(500),
  }),
});

export const blockSchema = z.discriminatedUnion("type", [textBlock, headingBlock, listBlock]);
export const blocksSchema = z.array(blockSchema).max(200);

export type Block = z.infer<typeof blockSchema>;

/** What Editor.js calls each block type, and what this project calls it. */
const EDITOR_JS_TYPES = { paragraph: "text", header: "heading", list: "list" } as const;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Editor.js returns HTML fragments (`<b>hi</b>`, `&amp;`) even with its inline
 * toolbar off - a paste carries markup in. In `v1` that markup is dropped rather
 * than stored, because storing HTML is what D5 rules out.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

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

function flattenListItems(items: readonly unknown[], depth = 0): string[] {
  if (depth > MAX_LIST_DEPTH) return [];
  const flat: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      flat.push(toPlainText(item));
      continue;
    }
    const listItem = item as { content?: unknown; items?: unknown[] };
    flat.push(toPlainText(String(listItem.content ?? "")));
    if (Array.isArray(listItem.items)) flat.push(...flattenListItems(listItem.items, depth + 1));
  }
  return flat.filter((text) => text !== "");
}

export type FromEditorJs = { ok: true; blocks: Block[] } | { ok: false; message: string };

/**
 * Turns what the editor submits into stored blocks. Every failure names the
 * block that caused it, because the editor shows this message to a person who
 * has to find it among their own writing.
 */
export function fromEditorJs(input: unknown): FromEditorJs {
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
        message: `Block ${index + 1} is a "${block.type}", which cannot be saved yet.`,
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
              ? `Block ${index + 1} is a checklist, which cannot be saved yet. Open that block's settings and choose Unordered or Ordered, then save.`
              : `Block ${index + 1} is a "${list.style}" list, which cannot be saved yet.`,
        };
      }
      blocks.push({
        id: block.id,
        type,
        data: {
          style: list.style === "ordered" ? "number" : "bullet",
          items: flattenListItems(list.items ?? []),
        },
      });
      continue;
    }
    const data = block.data as { text?: unknown; level?: unknown };
    blocks.push({
      id: block.id,
      type,
      data:
        type === "heading"
          ? { text: toPlainText(String(data.text ?? "")), level: data.level }
          : { text: toPlainText(String(data.text ?? "")) },
    });
  }

  const validated = blocksSchema.safeParse(blocks);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    const position = typeof issue?.path[0] === "number" ? issue.path[0] + 1 : 1;
    return {
      ok: false,
      message: `Block ${position} could not be saved: ${issue?.message ?? "invalid content"}.`,
    };
  }
  return { ok: true, blocks: validated.data };
}

/**
 * Editor.js sanitizes on save and on paste, **never on render**: its paragraph
 * tool assigns `innerHTML` directly. Stored text is plain text, so anything that
 * looks like markup in it is a writer's literal words - and handing them to that
 * sink unescaped executes them (F-33). Escaping here keeps `<img …>` as five
 * visible characters instead of an element.
 */
function escapeForEditor(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The inverse, for loading a saved entry back into the editor. */
export function toEditorJs(blocks: Block[]): {
  blocks: { id: string; type: string; data: unknown }[];
} {
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
              content: escapeForEditor(content),
              meta: {},
              items: [],
            })),
          },
        };
      }
      return {
        id: block.id,
        type: block.type === "heading" ? "header" : "paragraph",
        data: { ...block.data, text: escapeForEditor(block.data.text) },
      };
    }),
  };
}
