import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Block,
  collectImageMediaIds,
  fromEditorJs,
  fromEditorJsSections,
  sectionsFromBlocks,
  sectionsSchema,
  toEditorJs,
} from "./blocks.ts";
import { isPlainSection } from "./sections.ts";

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
  const result = fromEditorJs(editorBlock("quote", { text: "cannot be stored yet" }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /"quote"/);
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

test("a well-formed image block is accepted", () => {
  const mediaId = "550e8400-e29b-41d4-a716-446655440000";
  const result = fromEditorJs(editorBlock("image", { mediaId }));
  assert.deepEqual(result, {
    ok: true,
    blocks: [{ id: "abc123", type: "image", data: { mediaId } }],
  });
});

test("an image block with a non-uuid mediaId is refused", () => {
  const result = fromEditorJs(editorBlock("image", { mediaId: "not-a-uuid" }));
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /^Block 1 could not be saved/);
});

test("toEditorJs resolves a known image id and marks an unknown one missing", () => {
  const mediaId = "550e8400-e29b-41d4-a716-446655440000";
  const missingId = "660e8400-e29b-41d4-a716-446655440001";
  const blocks: Block[] = [
    { id: "a", type: "image", data: { mediaId } },
    { id: "b", type: "image", data: { mediaId: missingId } },
  ];
  const media = {
    url: "https://media.example/a.jpg",
    altText: "A photo",
    width: 800,
    height: 600,
  };
  assert.deepEqual(toEditorJs(blocks, { [mediaId]: media }), {
    blocks: [
      { id: "a", type: "image", data: { mediaId, ...media } },
      { id: "b", type: "image", data: { mediaId: missingId, missing: true } },
    ],
  });
});

test("collectImageMediaIds dedupes ids across several blocks", () => {
  const mediaId = "550e8400-e29b-41d4-a716-446655440000";
  const otherId = "660e8400-e29b-41d4-a716-446655440001";
  const blocks: Block[] = [
    { id: "a", type: "image", data: { mediaId } },
    { id: "b", type: "text", data: { text: [{ text: "hi" }] } },
    { id: "c", type: "image", data: { mediaId } },
    { id: "d", type: "image", data: { mediaId: otherId } },
  ];
  assert.deepEqual(collectImageMediaIds(blocks), [mediaId, otherId]);
});

test("a block id carrying a character the database cannot store is refused", () => {
  // The id goes into the same jsonb as the text, so it needs the same rule (F-49).
  const lone = `b${String.fromCharCode(0xd800)}1`;
  const result = fromEditorJs({
    blocks: [{ id: lone, type: "paragraph", data: { text: "Hello" } }],
  });
  assert.equal(result.ok, false);
});

const textLeaf = (id: string): Block => ({
  id,
  type: "text",
  data: { text: [{ text: "hi" }] },
});
const section = (id: string, column: unknown[], layout: string = "1") => ({
  id,
  type: "section",
  data: { layout, children: [column] },
});

test("duplicate section ids are refused", () => {
  const two = [section("s1", [textLeaf("a")]), section("s1", [textLeaf("b")])];
  assert.equal(sectionsSchema.safeParse(two).success, false);
});

test("a section id with a quote is refused", () => {
  assert.equal(sectionsSchema.safeParse([section('s"1', [textLeaf("a")])]).success, false);
});

test("a one-column plain section is valid", () => {
  assert.equal(sectionsSchema.safeParse([section("s1", [textLeaf("a")])]).success, true);
});

test("a section holds as many columns as its layout says, 1 to 3", () => {
  const columns = (count: number, layout: string) => ({
    id: "s1",
    type: "section",
    data: {
      layout,
      children: Array.from({ length: count }, (_, index) => [textLeaf(`a${index}`)]),
    },
  });
  for (const count of [1, 2, 3])
    assert.equal(sectionsSchema.safeParse([columns(count, String(count))]).success, true);
  assert.equal(sectionsSchema.safeParse([columns(1, "2")]).success, false);
  assert.equal(sectionsSchema.safeParse([columns(2, "1")]).success, false);
  assert.equal(sectionsSchema.safeParse([columns(4, "4")]).success, false);
  assert.equal(sectionsSchema.safeParse([columns(0, "1")]).success, false);
});

const editorColumn = (id: string) => ({
  blocks: [{ id, type: "paragraph", data: { text: "hi" } }],
});

test("the save parser derives the layout from the columns sent", () => {
  const result = fromEditorJsSections({
    sections: [
      { id: "s1", columns: [editorColumn("a1")] },
      { id: "s2", columns: [editorColumn("b1"), editorColumn("b2"), editorColumn("b3")] },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.sections
      .filter(isPlainSection)
      .map((each) => [each.data.layout, each.data.children.length]),
    [
      ["1", 1],
      ["3", 3],
    ],
  );
});

test("the save parser refuses no columns or four, and names the failing column", () => {
  const save = (columns: unknown[]) => fromEditorJsSections({ sections: [{ id: "s1", columns }] });
  assert.equal(save([]).ok, false);
  assert.equal(save([1, 2, 3, 4].map((n) => editorColumn(`a${n}`))).ok, false);
  const bad = save([editorColumn("a1"), { blocks: [{ id: "b1", type: "nonsense", data: {} }] }]);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.message, /Section 1, column 2/);
});

test("a page needs 1 to 30 sections", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => section(`s${index}`, []));
  assert.equal(sectionsSchema.safeParse(many(0)).success, false);
  assert.equal(sectionsSchema.safeParse(many(1)).success, true);
  assert.equal(sectionsSchema.safeParse(many(30)).success, true);
  assert.equal(sectionsSchema.safeParse(many(31)).success, false);
});

test("a page holds at most 200 blocks in total, across sections", () => {
  const leaves = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => textLeaf(`${prefix}${index}`));
  const page = (total: number) => [
    section("s1", leaves(100, "a")),
    section("s2", leaves(total - 100, "b")),
  ];
  assert.equal(sectionsSchema.safeParse(page(200)).success, true);
  assert.equal(sectionsSchema.safeParse(page(201)).success, false);
});

test("a section cannot contain a section", () => {
  assert.equal(
    sectionsSchema.safeParse([section("s1", [section("s2", [textLeaf("a")])])]).success,
    false,
  );
});

test("sectionsFromBlocks gives one section, even for no blocks", () => {
  assert.deepEqual(sectionsFromBlocks([]), [section("legacy", [])]);
  assert.deepEqual(sectionsFromBlocks([textLeaf("a")]), [section("legacy", [textLeaf("a")])]);
  assert.equal(sectionsSchema.safeParse(sectionsFromBlocks([])).success, true);
});

test("collectImageMediaIds finds images inside sections", () => {
  const mediaId = "7b1f3c2e-9d4a-4f6b-8a1e-2c5d6e7f8091";
  const image: Block = { id: "i", type: "image", data: { mediaId } };
  const sections = sectionsSchema.parse([
    section("s1", [textLeaf("a")]),
    section("s2", [image, image]),
  ]);
  assert.deepEqual(collectImageMediaIds(sections), [mediaId]);
});

test("collectImageMediaIds finds an image in the third column", () => {
  const mediaId = "7b1f3c2e-9d4a-4f6b-8a1e-2c5d6e7f8091";
  const image: Block = { id: "i", type: "image", data: { mediaId } };
  const sections = sectionsSchema.parse([
    {
      id: "s1",
      type: "section",
      data: { layout: "3", children: [[textLeaf("a")], [], [image]] },
    },
  ]);
  assert.deepEqual(collectImageMediaIds(sections), [mediaId]);
});

// ---- ready-made sections: hero (item 12a) ----

const hero = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "hero",
  data: { heading: "Welcome", text: "A line about us.", ...data },
});
const heroFields = (fields: Record<string, string> = {}) => ({
  heading: "Welcome",
  text: "A line about us.",
  buttonLabel: "",
  buttonHref: "",
  ...fields,
});
const saveHero = (fields: Record<string, string> = {}, before: unknown[] = []) =>
  fromEditorJsSections({
    sections: [...before, { id: "h1", kind: "hero", fields: heroFields(fields) }],
  });

test("a hero with and without a button is valid", () => {
  assert.equal(sectionsSchema.safeParse([hero("h1")]).success, true);
  assert.equal(
    sectionsSchema.safeParse([
      hero("h1", { button: { label: "Read more", href: "https://example.com/" } }),
    ]).success,
    true,
  );
  assert.equal(sectionsSchema.safeParse([hero("h1", { text: "" })]).success, true);
});

test("a stored hero is refused for an empty heading, over-long slots, a line break or a bad link", () => {
  const refused = (data: Record<string, unknown>) =>
    sectionsSchema.safeParse([hero("h1", data)]).success === false;
  assert.ok(refused({ heading: "" }));
  assert.ok(refused({ heading: "x".repeat(121) }));
  assert.ok(refused({ text: "x".repeat(401) }));
  assert.ok(refused({ text: "two\nlines" }));
  assert.ok(refused({ heading: "two\rlines" }));
  assert.ok(refused({ button: { label: "x".repeat(41), href: "/a" } }));
  assert.ok(refused({ button: { label: "Go", href: "javascript:alert(1)" } }));
  assert.ok(refused({ button: { label: "Go", href: "//evil.example" } }));
  assert.ok(refused({ button: { label: "", href: "/a" } }));
  assert.ok(refused({ extra: "x" }));
  assert.equal(sectionsSchema.safeParse([hero("h1", { heading: "x".repeat(120) })]).success, true);
});

test("section ids are unique across a hero and a plain section", () => {
  assert.equal(
    sectionsSchema.safeParse([hero("s1"), section("s1", [textLeaf("a")])]).success,
    false,
  );
});

test("heroes hold no blocks, so they add nothing to the 200-block total", () => {
  const page = (blocks: number) =>
    sectionsSchema.safeParse([
      hero("h1"),
      section(
        "s1",
        Array.from({ length: blocks }, (_, i) => textLeaf(`b${i}`)),
      ),
    ]).success;
  assert.equal(page(200), true);
  assert.equal(page(201), false);
});

test("the save parser builds a hero from its four fields, with or without a button", () => {
  const plain = saveHero();
  assert.deepEqual(plain, {
    ok: true,
    sections: [{ id: "h1", type: "hero", data: { heading: "Welcome", text: "A line about us." } }],
  });
  const withButton = saveHero({ buttonLabel: " Read more ", buttonHref: " /about " });
  assert.deepEqual(withButton, {
    ok: true,
    sections: [
      {
        id: "h1",
        type: "hero",
        data: {
          heading: "Welcome",
          text: "A line about us.",
          button: { label: "Read more", href: "/about" },
        },
      },
    ],
  });
});

test("the save parser collapses line breaks in a hero slot rather than refusing them", () => {
  const result = saveHero({ text: "one\n\ntwo   three" });
  assert.equal(
    result.ok && result.sections[0]?.data && "text" in result.sections[0].data
      ? result.sections[0].data.text
      : null,
    "one two three",
  );
});

test("a hero's refusals name the section and say what to do", () => {
  const message = (fields: Record<string, string>, before: unknown[] = []) => {
    const result = saveHero(fields, before);
    return result.ok ? "accepted" : result.message;
  };
  const one = [{ id: "s1", columns: [editorColumn("a1")] }];
  assert.equal(message({ heading: "  " }, one), "Section 2 (hero): the heading is required.");
  assert.match(
    message({ heading: "x".repeat(121) }),
    /^Section 1 \(hero\): the heading is longer than 120/,
  );
  assert.match(message({ text: "x".repeat(401) }), /the text is longer than 400/);
  assert.match(
    message({ buttonLabel: "x".repeat(41), buttonHref: "/a" }),
    /label is longer than 40/,
  );
  assert.match(message({ buttonLabel: "Go" }), /label but no link/);
  assert.match(message({ buttonHref: "/a" }), /link but no label/);
  assert.match(
    message({ buttonLabel: "Go", buttonHref: "javascript:alert(1)" }),
    /link cannot be used/,
  );
  assert.match(message({ buttonLabel: "Go", buttonHref: "//evil.example" }), /link cannot be used/);
});

test("a duplicate id across a hero and a plain section is refused by the save parser", () => {
  const result = fromEditorJsSections({
    sections: [
      { id: "same", columns: [editorColumn("a1")] },
      { id: "same", kind: "hero", fields: heroFields() },
    ],
  });
  assert.equal(result.ok, false);
});

test("the save parser refuses an unknown kind, a kind with columns, and missing fields", () => {
  const unreadable = "The editor sent content in a shape this version cannot read.";
  const refuse = (section: unknown) => fromEditorJsSections({ sections: [section] });
  assert.deepEqual(refuse({ id: "x", kind: "banner", fields: heroFields() }), {
    ok: false,
    message: unreadable,
  });
  assert.deepEqual(refuse({ id: "x", kind: "hero", fields: heroFields(), columns: [] }), {
    ok: false,
    message: unreadable,
  });
  assert.deepEqual(refuse({ id: "x", kind: "hero", fields: { heading: "Hi" } }), {
    ok: false,
    message: unreadable,
  });
  assert.deepEqual(refuse({ id: "x", kind: "hero" }), { ok: false, message: unreadable });
  assert.deepEqual(refuse({ id: "x" }), { ok: false, message: unreadable });
});

test("mixed pages keep their order", () => {
  const result = fromEditorJsSections({
    sections: [
      { id: "s1", columns: [editorColumn("a1")] },
      { id: "h1", kind: "hero", fields: heroFields() },
      { id: "s2", columns: [editorColumn("b1")] },
    ],
  });
  assert.equal(
    result.ok && result.sections.map((each) => each.type).join(),
    "section,hero,section",
  );
});

test("collectImageMediaIds passes over a hero", () => {
  const sections = sectionsSchema.parse([hero("h1"), section("s1", [textLeaf("a")])]);
  assert.deepEqual(collectImageMediaIds(sections), []);
});

// ---- ready-made sections: call to action (item 12b) ----

const cta = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "cta",
  data: {
    heading: "Join us",
    text: "Come along.",
    button: { label: "Sign up", href: "https://example.com/" },
    ...data,
  },
});
const ctaFields = (fields: Record<string, string> = {}) => ({
  heading: "Join us",
  text: "Come along.",
  buttonLabel: "Sign up",
  buttonHref: "/join",
  ...fields,
});
const saveCta = (fields: Record<string, string> = {}, before: unknown[] = []) =>
  fromEditorJsSections({
    sections: [...before, { id: "c1", kind: "cta", fields: ctaFields(fields) }],
  });
const ctaMessage = (fields: Record<string, string>, before: unknown[] = []) => {
  const result = saveCta(fields, before);
  return result.ok ? "accepted" : result.message;
};

test("a call to action is valid only with a button", () => {
  assert.equal(sectionsSchema.safeParse([cta("c1")]).success, true);
  assert.equal(sectionsSchema.safeParse([cta("c1", { text: "" })]).success, true);
  assert.equal(sectionsSchema.safeParse([cta("c1", { button: undefined })]).success, false);
  assert.equal(sectionsSchema.safeParse([cta("c1", { heading: "" })]).success, false);
});

test("the save parser builds a call to action from its four fields", () => {
  const result = saveCta();
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.sections[0], {
    id: "c1",
    type: "cta",
    data: { heading: "Join us", text: "Come along.", button: { label: "Sign up", href: "/join" } },
  });
});

test("a call to action's refusals name the section", () => {
  const one = [{ id: "s1", columns: [editorColumn("a1")] }];
  assert.equal(
    ctaMessage({ heading: " " }, one),
    "Section 2 (call to action): the heading is required.",
  );
  assert.match(ctaMessage({ heading: "x".repeat(121) }), /^Section 1 \(call to action\): .*120/);
  assert.match(ctaMessage({ text: "x".repeat(401) }), /the text is longer than 400/);
  const needs = "Section 1 (call to action): the button needs a label and a link.";
  assert.equal(ctaMessage({ buttonLabel: "", buttonHref: "" }), needs);
  assert.equal(ctaMessage({ buttonHref: "" }), needs);
  assert.equal(ctaMessage({ buttonLabel: "" }), needs);
  assert.match(ctaMessage({ buttonHref: "javascript:alert(1)" }), /link cannot be used/);
  assert.match(ctaMessage({ buttonHref: "//evil.example" }), /link cannot be used/);
});

test("a line break in a call to action slot becomes a space", () => {
  const result = saveCta({ text: "one\n\ntwo" });
  assert.equal(
    result.ok && result.sections[0]?.type === "cta" && result.sections[0].data.text,
    "one two",
  );
});

test("ids are unique across a call to action and a hero, and 31 sections are refused", () => {
  const same = fromEditorJsSections({
    sections: [
      { id: "same", kind: "hero", fields: heroFields() },
      { id: "same", kind: "cta", fields: ctaFields() },
    ],
  });
  assert.equal(same.ok, false);
  const many = fromEditorJsSections({
    sections: Array.from({ length: 31 }, (_, i) => ({
      id: `c${i}`,
      kind: "cta",
      fields: ctaFields(),
    })),
  });
  assert.equal(many.ok, false);
});

test("a call to action with columns is refused; plain, hero and cta lists keep their order", () => {
  const refused = fromEditorJsSections({
    sections: [{ id: "x", kind: "cta", fields: ctaFields(), columns: [] }],
  });
  assert.equal(refused.ok, false);
  const result = fromEditorJsSections({
    sections: [
      { id: "s1", columns: [editorColumn("a1")] },
      { id: "c1", kind: "cta", fields: ctaFields() },
      { id: "h1", kind: "hero", fields: heroFields() },
    ],
  });
  assert.equal(result.ok && result.sections.map((each) => each.type).join(), "section,cta,hero");
});

test("collectImageMediaIds passes over a call to action", () => {
  const sections = sectionsSchema.parse([cta("c1"), section("s1", [textLeaf("a")])]);
  assert.deepEqual(collectImageMediaIds(sections), []);
});
