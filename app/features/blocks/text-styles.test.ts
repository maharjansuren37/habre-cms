import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "@tiptap/pm/model";
import {
  changesProHeadings,
  countProHeadings,
  isProHeadingShortcut,
  isStyleLocked,
  menuHeadingLevels,
  schemaHeadingLevels,
} from "./text-styles.ts";

test("Simple's menu stops at Small heading and Pro's adds Heading 5 and 6", () => {
  assert.deepEqual(menuHeadingLevels("simple"), [2, 3, 4]);
  assert.deepEqual(menuHeadingLevels("pro"), [2, 3, 4, 5, 6]);
});

test("only a level 5 or 6 heading on a Simple site is locked", () => {
  assert.equal(isStyleLocked("simple", 5), true);
  assert.equal(isStyleLocked("simple", 6), true);
  assert.equal(isStyleLocked("simple", 4), false);
  assert.equal(isStyleLocked("simple", 0), false);
  assert.equal(isStyleLocked("pro", 5), false);
  assert.equal(isStyleLocked("pro", 6), false);
});

test("the schema accepts levels up to 6 at every site level, and a post has no level 1", () => {
  assert.deepEqual(schemaHeadingLevels("page"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(schemaHeadingLevels("post"), [2, 3, 4, 5, 6]);
});

test("five or six hashes are Pro's heading shortcut, nothing else is", () => {
  assert.equal(isProHeadingShortcut("#####"), true);
  assert.equal(isProHeadingShortcut("######"), true);
  assert.equal(isProHeadingShortcut("####"), false);
  assert.equal(isProHeadingShortcut("#######"), false);
  assert.equal(isProHeadingShortcut("a #####"), false);
});

test("an edit that makes or unmakes a Heading 5 or 6, with no block going away, is a Pro-only one", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "text*" },
      heading: { group: "block", content: "text*", attrs: { level: { default: 2 } } },
      text: {},
    },
  });
  const heading = (level: number) => schema.node("heading", { level }, [schema.text("x")]);
  const paragraph = schema.node("paragraph", null, [schema.text("x")]);
  const doc = (...blocks: ReturnType<typeof heading>[]) => schema.node("doc", null, blocks);
  const none = doc(paragraph, heading(4));
  const one = doc(heading(5), paragraph);
  const two = doc(heading(5), heading(6));

  assert.equal(countProHeadings(none), 0);
  assert.equal(countProHeadings(two), 2);
  // Adding one: Ctrl+Alt+5 on a paragraph, a paste.
  assert.equal(changesProHeadings(none, one), true);
  assert.equal(changesProHeadings(one, two), true);
  // Unmaking one in place: Ctrl+Alt+N on the heading.
  assert.equal(changesProHeadings(one, doc(paragraph, paragraph)), true);
  // One Pro style turned into the other: Ctrl+Alt+6 on a Heading 5.
  assert.equal(changesProHeadings(one, doc(heading(6), paragraph)), true);
  // Splitting one with Enter makes a second of the same level, and a block with it.
  assert.equal(changesProHeadings(one, doc(heading(5), heading(5), paragraph)), false);
  // Typing in it, moving it, or removing the block: not a change of style.
  assert.equal(changesProHeadings(one, one), false);
  assert.equal(changesProHeadings(one, doc(paragraph, heading(5))), false);
  assert.equal(changesProHeadings(two, doc(heading(5))), false);
  assert.equal(changesProHeadings(one, doc(paragraph)), false);
});
