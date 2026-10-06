import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDocumentForm } from "./entry-form-input.ts";

const document = (paragraph: Record<string, unknown>) => ({
  type: "doc",
  content: [
    {
      type: "section",
      attrs: { align: "top", background: "none" },
      content: [{ type: "column", content: [paragraph] }],
    },
  ],
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test("a v4 submission saves the schema's output, not the submitted JSON", () => {
  const submitted = document({
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Hi",
        marks: [{ type: "link", attrs: { href: "/about", target: "_blank", rel: "noopener" } }],
      },
    ],
  });
  const result = parseDocumentForm(
    form({
      title: " About ",
      seoTitle: "  About Habre ",
      seoDescription: " Who we are. ",
      blocks: JSON.stringify(submitted),
    }),
    "page",
  );
  assert.deepEqual(result, {
    ok: true,
    title: "About",
    seoTitle: "About Habre",
    seoDescription: "Who we are.",
    document: document({
      type: "paragraph",
      content: [{ type: "text", text: "Hi", marks: [{ type: "link", attrs: { href: "/about" } }] }],
    }),
  });
});

test("a v4 submission without the blocks field never came from the editor", () => {
  const result = parseDocumentForm(form({ title: "About" }), "post");
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /had not finished loading/);
});

test("a v4 submission refused by the schema reads its sentence", () => {
  const withMainHeading = document({
    type: "heading",
    attrs: { level: 1 },
    content: [{ type: "text", text: "Big" }],
  });
  const result = parseDocumentForm(
    form({ title: "Post", blocks: JSON.stringify(withMainHeading) }),
    "post",
  );
  assert.deepEqual(result, {
    ok: false,
    message: "A post's title is its main heading - use Heading or smaller.",
  });
});

test("a v4 submission without a title is refused before its document is read", () => {
  const result = parseDocumentForm(
    form({ title: "  ", blocks: JSON.stringify(document({ type: "paragraph" })) }),
    "page",
  );
  assert.deepEqual(result, { ok: false, message: "Give it a title before saving." });
});

const emptyDoc = JSON.stringify(document({ type: "paragraph" }));

test("a 301-character description is refused, and the message names the field", () => {
  const result = parseDocumentForm(
    form({ title: "A", seoTitle: "", seoDescription: "a".repeat(301), blocks: emptyDoc }),
    "post",
  );
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /Description/);
});

test("a 201-character search title is refused, and the message names the field", () => {
  const result = parseDocumentForm(
    form({ title: "A", seoTitle: "a".repeat(201), seoDescription: "", blocks: emptyDoc }),
    "post",
  );
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.message : "", /Title in search results/);
});

test("a submission without the search fields is refused, never read as empty", () => {
  for (const missing of ["seoTitle", "seoDescription"]) {
    const fields: Record<string, string> = {
      title: "A",
      seoTitle: "x",
      seoDescription: "y",
      blocks: emptyDoc,
    };
    delete fields[missing];
    const result = parseDocumentForm(form(fields), "post");
    assert.equal(result.ok, false, missing);
    assert.match(!result.ok ? result.message : "", /Reload and try again/);
  }
});
