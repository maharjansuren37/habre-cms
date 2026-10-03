import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDocument,
  findMainHeading,
  isEmptyBlock,
  isEmptySection,
  isRenderedBlock,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_BUTTON_LABEL_LENGTH,
  MAX_DOCUMENT_BLOCKS,
  parseDocument,
} from "./document.ts";

const text = (value: string, marks?: unknown[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const paragraph = (value?: string) =>
  value === undefined ? { type: "paragraph" } : { type: "paragraph", content: [text(value)] };
const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const column = (...blocks: unknown[]) => ({ type: "column", content: blocks });
const section = (...columns: unknown[]) => ({ type: "section", content: columns });
const doc = (...sections: unknown[]) => ({ type: "doc", content: sections });
const oneBlock = (block: unknown) => doc(section(column(block)));

function refused(input: unknown, type: "post" | "page" = "page"): string {
  const result = parseDocument(input, type);
  assert.equal(result.ok, false);
  return result.ok ? "" : result.message;
}

test("the empty document parses to one section of one column with one empty paragraph", () => {
  const result = parseDocument(emptyDocument(), "page");
  assert.deepEqual(result, {
    ok: true,
    document: {
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { align: "top", background: "none" },
          content: [{ type: "column", content: [{ type: "paragraph" }] }],
        },
      ],
    },
  });
});

test("every node and mark is accepted", () => {
  const input = doc(
    {
      type: "section",
      attrs: { align: "middle", background: "band" },
      content: [
        column(
          paragraph("Hello"),
          heading(2, "Big"),
          heading(6, "Tiny"),
          {
            type: "bulletList",
            content: [{ type: "listItem", content: [paragraph("one")] }],
          },
          {
            type: "orderedList",
            content: [{ type: "listItem", content: [paragraph("one")] }],
          },
          { type: "blockquote", content: [paragraph("quoted"), paragraph("more")] },
          {
            type: "paragraph",
            content: [
              text("a", [{ type: "bold" }]),
              text("b", [{ type: "italic" }]),
              text("c", [{ type: "link", attrs: { href: "https://example.com" } }]),
            ],
          },
        ),
        column(paragraph("second")),
      ],
    },
    section(column(paragraph("x"))),
  );
  const result = parseDocument(input, "post");
  assert.equal(result.ok, true);
  if (result.ok)
    assert.deepEqual(result.document.content[0]?.attrs, { align: "middle", background: "band" });
});

test("section attrs default to top and none", () => {
  const result = parseDocument(doc(section(column(paragraph("x")))), "page");
  assert.equal(result.ok && result.document.content[0]?.attrs.align, "top");
  assert.equal(result.ok && result.document.content[0]?.attrs.background, "none");
});

test("an unknown node is refused", () => {
  assert.equal(
    refused(oneBlock({ type: "table" })),
    "The editor sent something it cannot save yet.",
  );
});

test("an unknown mark is refused", () => {
  const block = { type: "paragraph", content: [text("x", [{ type: "underline" }])] };
  assert.equal(refused(oneBlock(block)), "The editor sent formatting it cannot save yet.");
});

test("a nested list is refused", () => {
  const nested = {
    type: "bulletList",
    content: [
      {
        type: "listItem",
        content: [
          paragraph("a"),
          { type: "bulletList", content: [{ type: "listItem", content: [paragraph("b")] }] },
        ],
      },
    ],
  };
  assert.equal(refused(oneBlock(nested)), "Lists cannot hold other lists yet.");
});

test("a hard break is refused", () => {
  const block = { type: "paragraph", content: [text("a"), { type: "hardBreak" }, text("b")] };
  assert.equal(
    refused(oneBlock(block)),
    "Line breaks inside a paragraph cannot be saved. Start a new paragraph instead.",
  );
});

test("31 sections are refused", () => {
  const sections = Array.from({ length: 31 }, () => section(column(paragraph("x"))));
  assert.equal(refused(doc(...sections)), "You can have at most 30 sections.");
});

test("30 sections are accepted", () => {
  const sections = Array.from({ length: 30 }, () => section(column(paragraph("x"))));
  assert.equal(parseDocument(doc(...sections), "page").ok, true);
});

test("a document with no sections is refused", () => {
  assert.equal(refused(doc()), "There must be at least one section.");
});

test("4 columns are refused", () => {
  const four = section(...Array.from({ length: 4 }, () => column(paragraph("x"))));
  assert.equal(refused(doc(four)), "A section can have at most 3 columns.");
});

test("a section with no columns is refused", () => {
  assert.equal(refused(doc(section())), "A section needs at least one column.");
});

test("201 blocks are refused and 200 are accepted", () => {
  const blocks = (count: number) =>
    doc(section(column(...Array.from({ length: count }, () => paragraph("x")))));
  assert.equal(refused(blocks(201)), "You can have at most 200 blocks.");
  assert.equal(parseDocument(blocks(200), "page").ok, true);
});

test("an empty column is refused", () => {
  assert.equal(refused(doc(section(column()))), "A column cannot be empty.");
});

test("text over 20,000 characters in one block is refused", () => {
  const long = "a".repeat(MAX_BLOCK_TEXT_LENGTH + 1);
  assert.equal(refused(oneBlock(paragraph(long))), "A block can hold at most 20,000 characters.");
  assert.equal(parseDocument(oneBlock(paragraph(long.slice(1))), "page").ok, true);
});

test("more than 2,000 pieces of text in one block are refused", () => {
  const pieces = Array.from({ length: 2_001 }, (_, i) =>
    text("a", [i % 2 ? { type: "bold" } : { type: "italic" }]),
  );
  assert.equal(
    refused(oneBlock({ type: "paragraph", content: pieces })),
    "A block has too many pieces of formatted text. Remove some formatting.",
  );
});

test("an unsafe link is refused", () => {
  const block = {
    type: "paragraph",
    content: [text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])],
  };
  assert.equal(
    refused(oneBlock(block)),
    "A link address cannot be used. Use a web address, an email link or a page on this site.",
  );
});

test("a link over 2,048 characters is refused", () => {
  const href = `https://example.com/${"a".repeat(2_048)}`;
  const block = { type: "paragraph", content: [text("x", [{ type: "link", attrs: { href } }])] };
  assert.equal(refused(oneBlock(block)), "A link address can be at most 2,048 characters.");
});

test("a NUL character in text is refused", () => {
  assert.equal(
    refused(oneBlock(paragraph("a\u0000b"))),
    "The text holds a character that cannot be saved.",
  );
});

test("a level-1 heading is refused in a post", () => {
  assert.equal(
    refused(oneBlock(heading(1, "Title")), "post"),
    "A post's title is its main heading - use Heading or smaller.",
  );
});

test("a page accepts one level-1 heading and refuses a second", () => {
  assert.equal(parseDocument(oneBlock(heading(1, "Title")), "page").ok, true);
  const two = doc(section(column(heading(1, "A"), heading(1, "B"))));
  assert.equal(
    refused(two),
    "A page can have only one main heading - use Heading or smaller for the others.",
  );
});

test("unknown keys and extra attrs are dropped from the output", () => {
  const input = doc({
    type: "section",
    extra: 1,
    content: [
      column(
        {
          type: "orderedList",
          attrs: { start: 3, type: null },
          content: [{ type: "listItem", content: [paragraph("a")] }],
        },
        {
          type: "paragraph",
          junk: true,
          content: [
            text("x", [
              {
                type: "link",
                attrs: { href: "https://a.com", target: "_blank", rel: "noopener", class: "c" },
              },
            ]),
          ],
        },
      ),
    ],
  });
  const result = parseDocument(input, "page");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const [list, para] = result.document.content[0]?.content[0]?.content ?? [];
  assert.deepEqual(list, {
    type: "orderedList",
    content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("a")] }] }],
  });
  assert.deepEqual(para, {
    type: "paragraph",
    content: [text("x", [{ type: "link", attrs: { href: "https://a.com" } }])],
  });
  assert.equal("extra" in (result.document.content[0] ?? {}), false);
});

test("input that is not a document is refused", () => {
  assert.equal(refused(null), "The editor sent content in a shape this version cannot read.");
  assert.equal(
    refused({ type: "paragraph" }),
    "The editor sent content in a shape this version cannot read.",
  );
});

test("findMainHeading returns the first level-1 heading that has text", () => {
  const result = parseDocument(
    doc(section(column(paragraph("x"), heading(1, "Welcome"), heading(2, "Sub")))),
    "page",
  );
  assert.equal(result.ok && findMainHeading(result.document)?.content?.[0]?.text, "Welcome");
});

test("findMainHeading ignores an empty level-1 heading and returns nothing without one", () => {
  const empty = { type: "heading", attrs: { level: 1 } };
  const withEmpty = parseDocument(doc(section(column(empty, heading(2, "Sub")))), "page");
  assert.equal(withEmpty.ok && findMainHeading(withEmpty.document), undefined);
});

function parsedSection(input: unknown) {
  const result = parseDocument(doc(input), "page");
  if (!result.ok) throw new Error(result.message);
  const [first] = result.document.content;
  if (!first) throw new Error("no section");
  return first;
}

function parsedBlock(block: unknown) {
  const [first] = parsedSection(section(column(block))).content[0]?.content ?? [];
  if (!first) throw new Error("no block");
  return first;
}

test("isEmptyBlock is true for a paragraph or heading with no text, and for whitespace only", () => {
  assert.equal(isEmptyBlock(parsedBlock({ type: "paragraph" })), true);
  assert.equal(isEmptyBlock(parsedBlock({ type: "paragraph", content: [text("  ")] })), true);
  assert.equal(isEmptyBlock(parsedBlock({ type: "heading", attrs: { level: 2 } })), true);
  assert.equal(isEmptyBlock(parsedBlock(paragraph("hi"))), false);
});

test("isEmptyBlock looks inside lists and quotes", () => {
  const list = (p: unknown) => ({
    type: "bulletList",
    content: [{ type: "listItem", content: [p] }],
  });
  assert.equal(isEmptyBlock(parsedBlock(list({ type: "paragraph" }))), true);
  assert.equal(isEmptyBlock(parsedBlock(list(paragraph("a")))), false);
  assert.equal(
    isEmptyBlock(parsedBlock({ type: "blockquote", content: [{ type: "paragraph" }] })),
    true,
  );
});

test("isEmptySection is true only when every block in every column is empty", () => {
  const empty = section(column(paragraph()), column(paragraph()));
  const mixed = section(column(paragraph()), column(paragraph("x")));
  assert.equal(isEmptySection(parsedSection(empty)), true);
  assert.equal(isEmptySection(parsedSection(mixed)), false);
});

test("a list item holding two paragraphs is refused with a plain sentence", () => {
  const item = { type: "listItem", content: [paragraph("a"), paragraph("b")] };
  assert.equal(
    refused(oneBlock({ type: "bulletList", content: [item] })),
    "The editor sent content in a shape this version cannot read.",
  );
});

test("a deeply nested document is refused rather than throwing", () => {
  let deep: unknown = paragraph("a");
  for (let i = 0; i < 20_000; i++) deep = { type: "blockquote", content: [deep] };
  assert.equal(
    refused(oneBlock(deep)),
    "The editor sent content in a shape this version cannot read.",
  );
});

function storedText(input: unknown) {
  const result = parseDocument(input, "page");
  assert.equal(result.ok, true);
  if (!result.ok) return undefined;
  const column = result.document.content[0]?.content[0];
  const block = column?.content[0];
  return block?.type === "paragraph" ? block : undefined;
}

test("a text node keeps one mark of each kind, the first link winning", () => {
  const marks = [
    { type: "bold" },
    { type: "link", attrs: { href: "/first" } },
    { type: "bold" },
    { type: "italic" },
    { type: "link", attrs: { href: "/second" } },
    ...Array.from({ length: 1000 }, () => ({ type: "italic" })),
  ];
  assert.deepEqual(storedText(oneBlock({ type: "paragraph", content: [text("a", marks)] })), {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "a",
        marks: [{ type: "bold" }, { type: "link", attrs: { href: "/first" } }, { type: "italic" }],
      },
    ],
  });
});

test("empty content and empty marks are stored as absent", () => {
  assert.deepEqual(storedText(oneBlock({ type: "paragraph", content: [] })), { type: "paragraph" });
  assert.deepEqual(storedText(oneBlock({ type: "paragraph", content: [text("a", [])] })), {
    type: "paragraph",
    content: [{ type: "text", text: "a" }],
  });
});

const MEDIA_ID = "0b0f6a52-3c1e-4f0e-9a43-6a8f3c1d2e55";
const image = (attrs: unknown = { mediaId: MEDIA_ID }) => ({ type: "image", attrs });
const button = (attrs: Record<string, unknown> = {}) => ({
  type: "button",
  attrs: { label: "Buy", href: "/shop", style: "outline", ...attrs },
});

function storedBlock(block: unknown) {
  const result = parseDocument(oneBlock(block), "page");
  assert.equal(result.ok, true);
  return result.ok ? result.document.content[0]?.content[0]?.content[0] : undefined;
}

test("an image, a button, a line and a space are accepted and stored exactly", () => {
  assert.deepEqual(storedBlock(image()), image());
  assert.deepEqual(storedBlock(button()), button());
  assert.deepEqual(storedBlock({ type: "horizontalRule" }), { type: "horizontalRule" });
  assert.deepEqual(storedBlock({ type: "space" }), { type: "space" });
});

test("an image without a valid media id is refused", () => {
  const sentence = "An image needs a file from Media.";
  assert.equal(refused(oneBlock(image({}))), sentence);
  assert.equal(refused(oneBlock(image({ mediaId: "not-a-uuid" }))), sentence);
  assert.equal(refused(oneBlock({ type: "image" })), sentence);
});

test("an image with no file chosen (an empty media id) is accepted and stored exactly", () => {
  assert.deepEqual(storedBlock(image({ mediaId: "" })), image({ mediaId: "" }));
});

test("a button label over 80 characters is refused", () => {
  assert.equal(MAX_BUTTON_LABEL_LENGTH, 80);
  assert.equal(storedBlock(button({ label: "a".repeat(80) })) !== undefined, true);
  assert.equal(
    refused(oneBlock(button({ label: "a".repeat(81) }))),
    "A button's text can be at most 80 characters.",
  );
});

test("a button label with an unstorable character is refused", () => {
  assert.equal(
    refused(oneBlock(button({ label: "a\u0000b" }))),
    "The text holds a character that cannot be saved.",
  );
});

test("a button address that is not safe is refused", () => {
  assert.equal(
    refused(oneBlock(button({ href: "javascript:alert(1)" }))),
    "A link address cannot be used. Use a web address, an email link or a page on this site.",
  );
});

test("a button address over 2,048 characters is refused", () => {
  assert.equal(
    refused(oneBlock(button({ href: `https://example.com/${"a".repeat(2_048)}` }))),
    "A link address can be at most 2,048 characters.",
  );
});

test("a button style other than filled or outline is refused", () => {
  assert.equal(
    refused(oneBlock(button({ style: "ghost" }))),
    "A button's style must be Filled or Outline.",
  );
});

test("a button may have an empty label and an empty address", () => {
  const stored = storedBlock(button({ label: "", href: "" }));
  assert.deepEqual(stored, button({ label: "", href: "" }));
});

test("a button without a style is stored as filled", () => {
  const stored = storedBlock({ type: "button", attrs: { label: "Go", href: "#top" } });
  assert.deepEqual(stored, {
    type: "button",
    attrs: { label: "Go", href: "#top", style: "filled" },
  });
});

test("extra attrs and content on an image, button, line and space are dropped", () => {
  assert.deepEqual(storedBlock(image({ mediaId: MEDIA_ID, src: "x" })), image());
  assert.deepEqual(storedBlock(button({ extra: 1 })), button());
  assert.deepEqual(storedBlock({ type: "horizontalRule", attrs: { x: 1 } }), {
    type: "horizontalRule",
  });
  assert.deepEqual(storedBlock({ type: "space", attrs: {} }), { type: "space" });
  assert.deepEqual(storedBlock({ ...image(), content: [text("x")], extra: 1 }), image());
  assert.deepEqual(storedBlock({ type: "space", content: [text("x")] }), { type: "space" });
});

test("200 mixed blocks are accepted and 201 are refused", () => {
  const kinds = [
    () => paragraph("p"),
    () => image(),
    () => button(),
    () => ({ type: "horizontalRule" }),
    () => ({ type: "space" }),
  ];
  const blocks = (count: number) =>
    Array.from({ length: count }, (_, index) => kinds[index % kinds.length]?.());
  const inColumns = (count: number) => {
    const all = blocks(count);
    return doc(
      section(column(...all.slice(0, 100))),
      section(column(...all.slice(100, 200))),
      ...(all.length > 200 ? [section(column(...all.slice(200)))] : []),
    );
  };
  assert.equal(parseDocument(inColumns(MAX_DOCUMENT_BLOCKS), "page").ok, true);
  assert.equal(
    refused(inColumns(MAX_DOCUMENT_BLOCKS + 1)),
    `You can have at most ${MAX_DOCUMENT_BLOCKS} blocks.`,
  );
});

test("isRenderedBlock is false for what draws nothing", () => {
  const media = { [MEDIA_ID]: {} };
  assert.equal(isRenderedBlock({ type: "space" }, media), false);
  assert.equal(isRenderedBlock({ type: "image", attrs: { mediaId: MEDIA_ID } }, {}), false);
  assert.equal(
    isRenderedBlock({ type: "button", attrs: { label: " ", href: "/a", style: "filled" } }, media),
    false,
  );
  assert.equal(
    isRenderedBlock({ type: "button", attrs: { label: "Go", href: "", style: "filled" } }, media),
    false,
  );
  assert.equal(isRenderedBlock({ type: "paragraph" }, media), false);
});

test("isRenderedBlock is true for what draws something", () => {
  const media = { [MEDIA_ID]: {} };
  assert.equal(isRenderedBlock({ type: "horizontalRule" }, media), true);
  assert.equal(isRenderedBlock({ type: "image", attrs: { mediaId: MEDIA_ID } }, media), true);
  assert.equal(
    isRenderedBlock({ type: "button", attrs: { label: "Go", href: "/a", style: "filled" } }, media),
    true,
  );
  assert.equal(
    isRenderedBlock({ type: "paragraph", content: [{ type: "text", text: "x" }] }, media),
    true,
  );
});
