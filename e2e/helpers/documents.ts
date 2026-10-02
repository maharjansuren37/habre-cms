// The browser-test project cannot import from `app/`, so the shape is local;
// the app's own parser (`parseDocument`) is what proves it is valid.
export type TestNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TestNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
export type Document = TestNode;
type Block = TestNode;
type TextNode = TestNode;

/**
 * Test-only: a v4 document of one section, one column and one paragraph per
 * string. With no strings it is the empty document a new entry starts with.
 */
export function textDocument(...paragraphs: string[]): Document {
  return {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [
          {
            type: "column",
            content:
              paragraphs.length === 0
                ? [{ type: "paragraph" }]
                : paragraphs.map((text) => ({
                    type: "paragraph",
                    content: [{ type: "text", text }],
                  })),
          },
        ],
      },
    ],
  };
}

/** Test-only: a v4 document of one section and one column holding these blocks. */
export function inSection(...blocks: Block[]): Document {
  return {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [{ type: "column", content: blocks }],
      },
    ],
  };
}

/** Test-only: a list item holding one paragraph of these text nodes. */
export function listItem(text: TextNode[]) {
  return { type: "listItem", content: [{ type: "paragraph", content: text }] };
}

/** Test-only: an image block pointing at a media row. */
export function imageBlock(mediaId: string): Block {
  return { type: "image", attrs: { mediaId } };
}

/** Test-only: a button block, filled unless said otherwise (as `parseDocument` stores it). */
export function buttonBlock(
  label: string,
  href: string,
  style: "filled" | "outline" = "filled",
): Block {
  return { type: "button", attrs: { label, href, style } };
}

/** Test-only: the Line block. */
export function lineBlock(): Block {
  return { type: "horizontalRule" };
}

/** Test-only: the Space block. */
export function spaceBlock(): Block {
  return { type: "space" };
}
