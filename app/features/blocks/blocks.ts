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
      blocks.push({
        id: block.id,
        type,
        data: {
          // Editor.js says ordered/unordered; this project says number/bullet.
          style: list.style === "ordered" ? "number" : "bullet",
          items: (list.items ?? [])
            .map((item) => toPlainText(String(item)))
            .filter((item) => item !== ""),
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
            items: block.data.items,
          },
        };
      }
      return {
        id: block.id,
        type: block.type === "heading" ? "header" : "paragraph",
        data: block.data,
      };
    }),
  };
}
