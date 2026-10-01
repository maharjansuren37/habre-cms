import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadableEditorContent, isReadableSectionsContent } from "./editor-content.ts";

test("an empty list of blocks is readable - an empty post is a real thing", () => {
  assert.equal(isReadableEditorContent({ blocks: [] }), true);
  assert.equal(
    isReadableEditorContent({ blocks: [{ id: "a", type: "paragraph", data: {} }] }),
    true,
  );
});

test("nothing at all is not readable", () => {
  // Editor.js's save() resolves undefined when a tool throws inside it, and the
  // ref is undefined before the editor mounts (F-42).
  assert.equal(isReadableEditorContent(undefined), false);
  assert.equal(isReadableEditorContent(null), false);
});

test("an object without a list of blocks is not readable", () => {
  assert.equal(isReadableEditorContent({}), false);
  assert.equal(isReadableEditorContent({ blocks: "not a list" }), false);
  assert.equal(isReadableEditorContent([]), false);
});

test("sections content needs at least one section, each column readable", () => {
  const column = { blocks: [] };
  assert.equal(isReadableSectionsContent({ sections: [{ id: "a", columns: [column] }] }), true);
  assert.equal(isReadableSectionsContent({ sections: [] }), false);
  assert.equal(isReadableSectionsContent({ sections: [{ id: "a", columns: [undefined] }] }), false);
  assert.equal(isReadableSectionsContent({ blocks: [] }), false);
  assert.equal(isReadableSectionsContent(undefined), false);
});

test("a hero is readable when it hands over its four text fields", () => {
  const fields = { heading: "Hi", text: "", buttonLabel: "", buttonHref: "" };
  assert.equal(isReadableSectionsContent({ sections: [{ id: "h", kind: "hero", fields }] }), true);
  assert.equal(
    isReadableSectionsContent({
      sections: [
        { id: "a", columns: [{ blocks: [] }] },
        { id: "h", kind: "hero", fields },
      ],
    }),
    true,
  );
  assert.equal(
    isReadableSectionsContent({ sections: [{ id: "h", kind: "hero", fields: { heading: "Hi" } }] }),
    false,
  );
  assert.equal(isReadableSectionsContent({ sections: [{ id: "h", kind: "hero" }] }), false);
  assert.equal(
    isReadableSectionsContent({
      sections: [{ id: "h", kind: "hero", fields: { ...fields, text: 3 } }],
    }),
    false,
  );
  assert.equal(
    isReadableSectionsContent({
      sections: [{ id: "h", kind: "hero", fields, columns: [{ blocks: [] }] }],
    }),
    false,
  );
  assert.equal(
    isReadableSectionsContent({ sections: [{ id: "h", kind: "banner", fields }] }),
    false,
  );
});

test("a call to action's fields are readable, like a hero's", () => {
  const fields = { heading: "Join", text: "", buttonLabel: "Go", buttonHref: "/join" };
  assert.equal(isReadableSectionsContent({ sections: [{ id: "c", kind: "cta", fields }] }), true);
  assert.equal(
    isReadableSectionsContent({ sections: [{ id: "c", kind: "cta", fields: { heading: "x" } }] }),
    false,
  );
  assert.equal(
    isReadableSectionsContent({
      sections: [{ id: "c", kind: "cta", fields, columns: [{ blocks: [] }] }],
    }),
    false,
  );
});

test("an image and text section's fields need a media id string, which may be empty", () => {
  const fields = { heading: "Story", text: "", buttonLabel: "", buttonHref: "", mediaId: "" };
  const readable = (value: unknown) =>
    isReadableSectionsContent({ sections: [{ id: "i", kind: "image-text", fields: value }] });
  assert.equal(readable(fields), true);
  assert.equal(readable({ ...fields, mediaId: "6f1c7d52-3a0b-4f6e-9d1e-0a1b2c3d4e5f" }), true);
  assert.equal(readable({ heading: "Story", text: "", buttonLabel: "", buttonHref: "" }), false);
  assert.equal(readable({ ...fields, mediaId: 5 }), false);
});
