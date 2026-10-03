import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "@tiptap/pm/model";
import { emptyTextHint } from "./empty-text-hint.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "section+" },
    section: { content: "column{1,3}" },
    column: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    heading: { group: "block", content: "text*", attrs: { level: { default: 2 } } },
    bulletList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph" },
    blockquote: { group: "block", content: "paragraph+" },
    space: { group: "block", atom: true },
    text: {},
  },
});

const p = (text = "") => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const h = (level: number, text = "") =>
  schema.nodes.heading.create({ level }, text ? schema.text(text) : null);
const column = (...blocks: ReturnType<typeof p>[]) => schema.nodes.column.create(null, blocks);
const item = (paragraph: ReturnType<typeof p>) => schema.nodes.listItem.create(null, paragraph);
const list = (paragraph: ReturnType<typeof p>) =>
  schema.nodes.bulletList.create(null, item(paragraph));
const quote = (paragraph: ReturnType<typeof p>) => schema.nodes.blockquote.create(null, paragraph);

const beside = column(p(), p("Other"));
const alone = column(p());

for (const [level, name] of [
  [1, "Main heading"],
  [2, "Heading"],
  [3, "Subheading"],
  [4, "Small heading"],
] as const) {
  test(`an empty level ${level} heading says "${name}" with or without the cursor`, () => {
    const parent = column(h(level), p("Other"));
    assert.equal(emptyTextHint(h(level), parent, false, "page"), name);
    assert.equal(emptyTextHint(h(level), parent, true, "page"), name);
  });
}

test("an empty heading says its name on a post too", () => {
  assert.equal(emptyTextHint(h(2), column(h(2), p("x")), false, "post"), "Heading");
});

test("an empty paragraph beside other blocks says Text when the cursor is elsewhere", () => {
  assert.equal(emptyTextHint(p(), beside, false, "page"), "Text");
  assert.equal(emptyTextHint(p(), beside, false, "post"), "Text");
});

test("an empty paragraph beside other blocks keeps the entry's placeholder with the cursor", () => {
  assert.equal(emptyTextHint(p(), beside, true, "page"), "Write your page…");
  assert.equal(emptyTextHint(p(), beside, true, "post"), "Write your post…");
});

test("an empty paragraph alone in its column has the placeholder with the cursor only", () => {
  assert.equal(emptyTextHint(p(), alone, true, "page"), "Write your page…");
  assert.equal(emptyTextHint(p(), alone, true, "post"), "Write your post…");
  assert.equal(emptyTextHint(p(), alone, false, "page"), "");
});

test("an empty paragraph in a list item or a quote has no hint, with or without the cursor", () => {
  const inList = list(p()).firstChild as ReturnType<typeof item>;
  const inQuote = quote(p());
  assert.equal(emptyTextHint(p(), inList, true, "page"), "");
  assert.equal(emptyTextHint(p(), inList, false, "page"), "");
  assert.equal(emptyTextHint(p(), inQuote, true, "post"), "");
  assert.equal(emptyTextHint(p(), inQuote, false, "post"), "");
});

test("nodes that are not text blocks have no hint", () => {
  assert.equal(emptyTextHint(beside, schema.nodes.section.create(null, beside), true, "page"), "");
  assert.equal(emptyTextHint(schema.nodes.space.create(), beside, false, "page"), "");
});
