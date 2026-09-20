import assert from "node:assert/strict";
import { test } from "node:test";
import { type Block, fromEditorJs, toEditorJs } from "./blocks.ts";

const editorBlock = (type: string, data: unknown, id = "abc123") => ({
  blocks: [{ id, type, data }],
});

test("a paragraph becomes a text block", () => {
  const result = fromEditorJs(editorBlock("paragraph", { text: "Hello there" }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "text", data: { text: [{ text: "Hello there" }] } }],
  });
});

test("formatting the editor sends is stored as runs, never as markup", () => {
  const result = fromEditorJs(
    editorBlock("paragraph", { text: "<b>bold</b> &amp; <i>italic</i><u>under</u>" }),
  );
  assert.deepEqual(result, {
    ok: true,
    blocks: [
      {
        id: "abc123",
        type: "text",
        data: {
          text: [
            { text: "bold", bold: true },
            { text: " & " },
            { text: "italic", italic: true },
            { text: "under" },
          ],
        },
      },
    ],
  });
});

test("a link to an unsafe address is refused, and the message names the block", () => {
  const result = fromEditorJs({
    blocks: [
      { id: "a", type: "paragraph", data: { text: "fine" } },
      { id: "b", type: "header", data: { text: '<a href="javascript:alert(1)">x</a>', level: 2 } },
    ],
  });
  assert.deepEqual(result, {
    ok: false,
    message:
      "Block 2 has a link to an address that cannot be used. Links must start with https://, http://, mailto:, # or a single /.",
  });
});

test("each refusal tells the writer what happened and what to do", () => {
  const message = (text: string) => {
    const result = fromEditorJs(editorBlock("paragraph", { text }));
    return result.ok ? "saved" : result.message;
  };
  // Starts with "/", so a message listing "/" alone would read as wrong (F-45).
  assert.equal(
    message('<a href="//example.com">x</a>'),
    "Block 1 has a link to an address that cannot be used. Links must start with https://, http://, mailto:, # or a single /.",
  );
  assert.equal(
    message(`<a href="https://example.com/${"x".repeat(2_048)}">x</a>`),
    "Block 1 has a link address longer than 2,048 characters. Shorten the link, then save.",
  );
  assert.equal(
    message("<b>a</b>b".repeat(1_001)),
    "Block 1 has too much formatting to save. Remove some bold, italic or links, or split it into smaller blocks.",
  );
  assert.equal(
    message("a".repeat(20_001)),
    "Block 1 could not be saved: it is longer than 20,000 characters. Split it into smaller blocks.",
  );
});

test("a header becomes a heading block, keeping its level", () => {
  const result = fromEditorJs(editorBlock("header", { text: "Section", level: 3 }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "heading", data: { text: [{ text: "Section" }], level: 3 } }],
  });
});

test("a heading level the theme cannot render is refused", () => {
  const result = fromEditorJs(editorBlock("header", { text: "Too big", level: 1 }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /^Block 1 could not be saved/);
});

test("an ordered list becomes a number list, an unordered one a bullet list", () => {
  // The shape @editorjs/list 2.0.9 actually saves (F-32): objects, not strings.
  const listItem = (content: string) => ({ content, meta: {}, items: [] });
  const ordered = fromEditorJs(
    editorBlock("list", { style: "ordered", items: [listItem("one"), listItem("two")] }),
  );
  const unordered = fromEditorJs(
    editorBlock("list", { style: "unordered", items: [listItem("one")] }),
  );
  assert.deepEqual(ordered, {
    ok: true,
    blocks: [
      {
        id: "abc123",
        type: "list",
        data: { style: "number", items: [[{ text: "one" }], [{ text: "two" }]] },
      },
    ],
  });
  assert.deepEqual(unordered, {
    ok: true,
    blocks: [{ id: "abc123", type: "list", data: { style: "bullet", items: [[{ text: "one" }]] } }],
  });
});

test("a list with nothing in it is refused rather than stored empty", () => {
  const result = fromEditorJs(editorBlock("list", { style: "unordered", items: [] }));
  assert.equal(result.ok, false);
});

test("a nested list is flattened rather than losing the nested words", () => {
  const result = fromEditorJs(
    editorBlock("list", {
      style: "unordered",
      items: [{ content: "parent", meta: {}, items: [{ content: "child", meta: {}, items: [] }] }],
    }),
  );
  assert.deepEqual(result, {
    ok: true,
    blocks: [
      {
        id: "abc123",
        type: "list",
        data: { style: "bullet", items: [[{ text: "parent" }], [{ text: "child" }]] },
      },
    ],
  });
});

test("a list item keeps its formatting, and an empty item is dropped", () => {
  const result = fromEditorJs(
    editorBlock("list", {
      style: "unordered",
      items: [
        { content: "<b>bold</b> item", meta: {}, items: [] },
        { content: "<br>", meta: {}, items: [] },
      ],
    }),
  );
  assert.deepEqual(result, {
    ok: true,
    blocks: [
      {
        id: "abc123",
        type: "list",
        data: { style: "bullet", items: [[{ text: "bold", bold: true }, { text: " item" }]] },
      },
    ],
  });
});

test("a checklist is refused by name rather than stored as a bullet list", () => {
  const result = fromEditorJs(
    editorBlock("list", {
      style: "checklist",
      items: [{ content: "todo", meta: { checked: true }, items: [] }],
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /checklist/);
});

test("a saved list loads back into the shape the list tool reads", () => {
  const blocks: Block[] = [
    {
      id: "c",
      type: "list",
      data: { style: "bullet", items: [[{ text: "one" }], [{ text: "two" }]] },
    },
  ];
  assert.deepEqual(toEditorJs(blocks), {
    blocks: [
      {
        id: "c",
        type: "list",
        data: {
          style: "unordered",
          items: [
            { content: "one", meta: {}, items: [] },
            { content: "two", meta: {}, items: [] },
          ],
        },
      },
    ],
  });
});

test("a block type this version cannot store is refused, and the message names it", () => {
  const result = fromEditorJs(editorBlock("image", { file: { url: "https://example.org/a.png" } }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /"image"/);
});

test("the message names which block failed, not just that one did", () => {
  const result = fromEditorJs({
    blocks: [
      { id: "a", type: "paragraph", data: { text: "fine" } },
      { id: "b", type: "paragraph", data: { text: "also fine" } },
      { id: "c", type: "checklist", data: {} },
    ],
  });
  assert.match(result.ok === false ? result.message : "", /^Block 3 /);
});

test("content that is not the editor's shape at all is refused", () => {
  assert.equal(fromEditorJs({ nonsense: true }).ok, false);
  assert.equal(fromEditorJs(null).ok, false);
});

test("saved blocks load back into the shape the editor expects", () => {
  const blocks: Block[] = [
    { id: "a", type: "text", data: { text: [{ text: "Hello" }] } },
    { id: "b", type: "heading", data: { text: [{ text: "Section" }], level: 2 } },
    { id: "c", type: "list", data: { style: "number", items: [[{ text: "one" }]] } },
  ];
  assert.deepEqual(toEditorJs(blocks), {
    blocks: [
      { id: "a", type: "paragraph", data: { text: "Hello" } },
      { id: "b", type: "header", data: { text: "Section", level: 2 } },
      {
        id: "c",
        type: "list",
        data: { style: "ordered", items: [{ content: "one", meta: {}, items: [] }] },
      },
    ],
  });
});

test("a block survives a round trip through the editor's shape and back", () => {
  const blocks: Block[] = [
    { id: "a", type: "text", data: { text: [{ text: "Hello" }, { text: " there", bold: true }] } },
    {
      id: "b",
      type: "heading",
      data: { text: [{ text: "Section", italic: true, href: "/about?a=1&b=2" }], level: 3 },
    },
    {
      id: "c",
      type: "list",
      data: { style: "bullet", items: [[{ text: "one" }], [{ text: "two", bold: true }]] },
    },
    { id: "d", type: "text", data: { text: [] } },
  ];
  const back = fromEditorJs(toEditorJs(blocks));
  assert.deepEqual(back, { ok: true, blocks });
});

test("line breaks and runs of whitespace collapse to single spaces", () => {
  const result = fromEditorJs(editorBlock("paragraph", { text: "one<br>two   three\n\nfour" }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "text", data: { text: [{ text: "one two three four" }] } }],
  });
});

test("text that looks like markup loads into the editor as visible characters", () => {
  // Editor.js renders with innerHTML (F-33); an unescaped run would execute.
  const blocks: Block[] = [
    { id: "a", type: "text", data: { text: [{ text: "<script>alert(1)</script>" }] } },
    {
      id: "b",
      type: "list",
      data: { style: "bullet", items: [[{ text: "<img src=x onerror=alert(1)>" }]] },
    },
  ];
  assert.deepEqual(toEditorJs(blocks), {
    blocks: [
      { id: "a", type: "paragraph", data: { text: "&lt;script&gt;alert(1)&lt;/script&gt;" } },
      {
        id: "b",
        type: "list",
        data: {
          style: "unordered",
          items: [{ content: "&lt;img src=x onerror=alert(1)&gt;", meta: {}, items: [] }],
        },
      },
    ],
  });
});

test("a deeply nested list is refused rather than exhausting the stack", () => {
  // Unbounded recursion here threw RangeError and answered 500 (F-41).
  let items: unknown = [{ content: "deepest", meta: {}, items: [] }];
  for (let depth = 0; depth < 5000; depth++) {
    items = [{ content: `level ${depth}`, meta: {}, items }];
  }
  const result = fromEditorJs(editorBlock("list", { style: "unordered", items }));
  // Either outcome is fine; throwing is not.
  assert.equal(typeof result.ok, "boolean");
});

test("a checklist refusal tells the writer how to get unstuck", () => {
  const result = fromEditorJs(
    editorBlock("list", {
      style: "checklist",
      items: [{ content: "todo", meta: { checked: true }, items: [] }],
    }),
  );
  assert.match(result.ok === false ? result.message : "", /Open that block's settings/);
});

test("a null item is refused rather than throwing on a property read", () => {
  // typeof null === "object", so this read `.content` off null and threw a
  // TypeError to the action, which has no catch - an 82-byte body gave a 500.
  const result = fromEditorJs(editorBlock("list", { style: "unordered", items: [null] }));
  assert.equal(result.ok, false);
});

test("a very wide nested list is bounded rather than exhausting the stack", () => {
  const wide = Array.from({ length: 150_000 }, (_, index) => ({
    content: `item ${index}`,
    meta: {},
    items: [],
  }));
  const result = fromEditorJs(
    editorBlock("list", {
      style: "unordered",
      items: [{ content: "parent", meta: {}, items: wide }],
    }),
  );
  // Refused by the schema's 500-item cap, and crucially without throwing.
  assert.equal(result.ok, false);
});

test("items that are not an array are refused rather than read one character at a time", () => {
  const result = fromEditorJs(editorBlock("list", { style: "unordered", items: "nonsense" }));
  assert.equal(result.ok, false);
});

test("the item cap stops the mapper walking a huge list, not just refusing it", () => {
  // The cap bounds work rather than correctness: Zod refuses past 500 either
  // way, so this asserts what was actually read rather than the result.
  let highestRead = -1;
  const items = Array.from({ length: 2000 }, (_, index) => ({
    meta: {},
    items: [],
    get content() {
      highestRead = Math.max(highestRead, index);
      return `item ${index}`;
    },
  }));
  fromEditorJs(editorBlock("list", { style: "unordered", items }));
  assert.ok(highestRead <= 501, `read up to item ${highestRead}, expected to stop around 500`);
});

test("a block id carrying a character the database cannot store is refused", () => {
  // The id goes into the same jsonb as the text, so it needs the same rule (F-49).
  const lone = `b${String.fromCharCode(0xd800)}1`;
  const result = fromEditorJs({
    blocks: [{ id: lone, type: "paragraph", data: { text: "Hello" } }],
  });
  assert.equal(result.ok, false);
});
