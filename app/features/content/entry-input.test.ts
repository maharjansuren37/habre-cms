import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEntryForm } from "./entry-form-input.ts";
import { entryInputSchema } from "./entry-input.ts";

const blocks = [{ id: "a", type: "text" as const, data: { text: [{ text: "Hello" }] } }];

test("a title is trimmed before it is stored", () => {
  const result = entryInputSchema.parse({ title: "  Hello  ", blocks });
  assert.equal(result.title, "Hello");
});

test("a post with no title is refused, and the message says what to do", () => {
  const result = entryInputSchema.safeParse({ title: "   ", blocks });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].message, "Give it a title before saving.");
});

test("a title longer than the column allows is refused", () => {
  const result = entryInputSchema.safeParse({ title: "a".repeat(201), blocks });
  assert.equal(result.success, false);
  assert.match(result.error?.issues[0].message ?? "", /200 characters/);
});

test("more blocks than one post should hold are refused", () => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    id: `b${index}`,
    type: "text" as const,
    data: { text: [{ text: "x" }] },
  }));
  assert.equal(entryInputSchema.safeParse({ title: "Fine", blocks: many }).success, false);
  assert.equal(entryInputSchema.safeParse({ title: "Fine", blocks }).success, true);
});

test("a post with no blocks at all is allowed - an empty draft is a real thing", () => {
  assert.equal(entryInputSchema.safeParse({ title: "Just a title", blocks: [] }).success, true);
});

test("a submission with no blocks field is refused, not read as an empty post", () => {
  // A native submit carries no blocks part, which used to wipe a saved body (F-34).
  const withoutBlocks = new FormData();
  withoutBlocks.set("title", "Still has a body");
  const missing = parseEntryForm(withoutBlocks, "post");
  assert.equal(missing.ok, false);
  assert.match(missing.ok === false ? missing.message : "", /had not finished loading/);

  // An empty post is still legal when the editor actually sent one.
  const withEmptyBlocks = new FormData();
  withEmptyBlocks.set("title", "Just a title");
  withEmptyBlocks.set("blocks", JSON.stringify({ blocks: [] }));
  assert.equal(parseEntryForm(withEmptyBlocks, "post").ok, true);
});

test("a title carrying a character the database cannot store is refused, not left to the insert", () => {
  // PostgreSQL rejects U+0000 in a text column, so this used to answer 500 (F-47).
  const result = entryInputSchema.safeParse({ title: "Hello\u0000there", blocks });
  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues[0].message,
    "The title has a character that cannot be stored. Remove it and save again.",
  );
});

const paragraph = (id: string, text: string) => ({ id, type: "paragraph", data: { text } });
const pageForm = (sections: unknown) => {
  const form = new FormData();
  form.set("title", "A page");
  form.set("blocks", JSON.stringify({ sections }));
  return form;
};
const sectionOf = (id: string, editorBlocks: unknown[]) => ({
  id,
  columns: [{ blocks: editorBlocks }],
});

test("a page's sections are stored in the order sent, keeping their ids", () => {
  const result = parseEntryForm(
    pageForm([
      sectionOf("s-one", [paragraph("a", "One")]),
      sectionOf("s-two", [paragraph("b", "Two"), paragraph("c", "Three")]),
    ]),
    "page",
  );
  assert.equal(result.ok, true);
  if (!result.ok || !("sections" in result)) return assert.fail("expected sections");
  assert.deepEqual(
    result.sections.map((each) => [each.id, each.data.layout, each.data.children[0].length]),
    [
      ["s-one", "1", 1],
      ["s-two", "1", 2],
    ],
  );
});

test("a bad link names the section and the block it is in", () => {
  const result = parseEntryForm(
    pageForm([
      sectionOf("s1", [paragraph("a", "fine")]),
      sectionOf("s2", [
        paragraph("b", "fine"),
        paragraph("c", '<a href="javascript:alert(1)">x</a>'),
      ]),
    ]),
    "page",
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /^Section 2, block 2 has a link/);
});

test("a page refuses the flat shape a post sends, and a post refuses sections", () => {
  const flat = new FormData();
  flat.set("title", "A page");
  flat.set("blocks", JSON.stringify({ blocks: [paragraph("a", "One")] }));
  const asPage = parseEntryForm(flat, "page");
  assert.equal(asPage.ok, false);
  assert.match(asPage.ok ? "" : asPage.message, /older version of the site/);

  const asPost = parseEntryForm(pageForm([sectionOf("s1", [])]), "post");
  assert.equal(asPost.ok, false);
});

test("a section must have exactly one column, and a page 1 to 30 sections", () => {
  const twoColumns = { id: "s1", columns: [{ blocks: [] }, { blocks: [] }] };
  const noColumns = { id: "s1", columns: [] };
  assert.equal(parseEntryForm(pageForm([twoColumns]), "page").ok, false);
  assert.equal(parseEntryForm(pageForm([noColumns]), "page").ok, false);
  assert.equal(parseEntryForm(pageForm([]), "page").ok, false);
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => sectionOf(`s${index}`, []));
  assert.equal(parseEntryForm(pageForm(many(30)), "page").ok, true);
  assert.equal(parseEntryForm(pageForm(many(31)), "page").ok, false);
});

test("a page with more than 200 blocks across its sections is refused with a sentence", () => {
  const blocksIn = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => paragraph(`${prefix}${index}`, "x"));
  const result = parseEntryForm(
    pageForm([sectionOf("s1", blocksIn(120, "a")), sectionOf("s2", blocksIn(81, "b"))]),
    "page",
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /at most 200 blocks in total/);
});
