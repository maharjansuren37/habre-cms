import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionsSchema } from "./blocks.ts";
import { nonEmptySections, resizeColumns } from "./sections.ts";

const textLeaf = (id: string) => ({ id, type: "text", data: { text: [{ text: "hi" }] } });
const section = (id: string, column: unknown[]) => ({
  id,
  type: "section",
  data: { layout: "1", children: [column] },
});

test("nonEmptySections drops sections with no blocks, keeping order", () => {
  const sections = sectionsSchema.parse([
    section("s1", [textLeaf("a")]),
    section("s2", []),
    section("s3", [textLeaf("b")]),
  ]);
  assert.deepEqual(
    nonEmptySections(sections).map((each) => each.id),
    ["s1", "s3"],
  );
});

test("resizeColumns grows with empty columns on the right", () => {
  assert.deepEqual(resizeColumns([["a"]], 3), [["a"], [], []]);
});

test("resizeColumns shrinks by merging removed columns onto the last kept, in order", () => {
  assert.deepEqual(resizeColumns([["a"], ["b"], ["c", "d"]], 1), [["a", "b", "c", "d"]]);
  assert.deepEqual(resizeColumns([["a"], ["b"], ["c"]], 2), [["a"], ["b", "c"]]);
});

test("resizeColumns at the same count changes nothing and does not alias", () => {
  const before = [["a"], ["b"]];
  const after = resizeColumns(before, 2);
  assert.deepEqual(after, before);
  assert.notEqual(after[0], before[0]);
});

test("resizeColumns never changes the number of items", () => {
  const columns = [["a", "b"], [], ["c"]];
  for (const count of [1, 2, 3]) assert.equal(resizeColumns(columns, count).flat().length, 3);
});

test("resizeColumns refuses fewer than one column", () => {
  assert.throws(() => resizeColumns([["a"]], 0), /at least one column/);
});

test("nonEmptySections keeps a hero, which is never empty", () => {
  const sections = sectionsSchema.parse([
    { id: "h1", type: "hero", data: { heading: "Hi", text: "" } },
    section("s1", []),
  ]);
  assert.deepEqual(
    nonEmptySections(sections).map((each) => each.id),
    ["h1"],
  );
});
