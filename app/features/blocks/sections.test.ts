import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionsSchema } from "./blocks.ts";
import { nonEmptySections } from "./sections.ts";

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
