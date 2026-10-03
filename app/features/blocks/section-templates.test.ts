import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDocument } from "./document.ts";
import { SECTION_TEMPLATES, sectionTemplate } from "./section-templates.ts";

const filledButton = { type: "button", attrs: { label: "", href: "", style: "filled" } };
const image = { type: "image", attrs: { mediaId: "" } };
const heading = (level: number) => ({ type: "heading", attrs: { level } });
const column = (...blocks: unknown[]) => ({ type: "column", content: blocks });

test("the templates are blank, hero, image-text and cta, in that order", () => {
  assert.deepEqual([...SECTION_TEMPLATES], ["blank", "hero", "image-text", "cta"]);
});

for (const kind of SECTION_TEMPLATES) {
  test(`the ${kind} template parses as a page document, unchanged`, () => {
    const document = { type: "doc", content: [sectionTemplate(kind, { mainHeading: true })] };
    assert.deepEqual(parseDocument(document, "page"), { ok: true, document });
  });
}

test("blank is one column holding one empty paragraph", () => {
  assert.deepEqual(sectionTemplate("blank", { mainHeading: false }), {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: [column({ type: "paragraph" })],
  });
});

test("hero is a text column and an image column, centred", () => {
  assert.deepEqual(sectionTemplate("hero", { mainHeading: true }), {
    type: "section",
    attrs: { align: "middle", background: "none" },
    content: [
      column(heading(1), { type: "paragraph" }, { type: "space" }, filledButton),
      column(image),
    ],
  });
});

test("image-text is an image column then a text column", () => {
  assert.deepEqual(sectionTemplate("image-text", { mainHeading: true }), {
    type: "section",
    attrs: { align: "top", background: "none" },
    content: [column(image), column(heading(2), { type: "paragraph" })],
  });
});

test("cta is one banded column with a heading, text and a button", () => {
  assert.deepEqual(sectionTemplate("cta", { mainHeading: true }), {
    type: "section",
    attrs: { align: "top", background: "band" },
    content: [column(heading(2), { type: "paragraph" }, filledButton)],
  });
});

test("the hero heading is level 1 with a main heading and level 2 without", () => {
  const level = (mainHeading: boolean) => {
    const block = sectionTemplate("hero", { mainHeading }).content[0]?.content[0];
    return block?.type === "heading" ? block.attrs.level : undefined;
  };
  assert.equal(level(true), 1);
  assert.equal(level(false), 2);
});

test("no other template's heading is level 1, even with a main heading", () => {
  for (const kind of ["image-text", "cta"] as const) {
    const headings = sectionTemplate(kind, { mainHeading: true }).content.flatMap((c) =>
      c.content.flatMap((b) => (b.type === "heading" ? [b.attrs.level] : [])),
    );
    assert.deepEqual(headings, [2], kind);
  }
});
