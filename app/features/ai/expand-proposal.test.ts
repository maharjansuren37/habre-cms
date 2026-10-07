import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SECTIONS, parseDocument } from "../blocks/document.ts";
import { blocksOf, findMainHeading, MAX_DOCUMENT_BLOCKS } from "../blocks/document-nodes.ts";
import { expandProposal } from "./expand-proposal.ts";
import { proposalSchema } from "./proposal.ts";
import { type Draft, validProposal } from "./test-proposal.ts";

const slugs = { p1: "home", p2: "about" };

function parsed(input: unknown) {
  const result = proposalSchema.safeParse(input);
  assert.ok(result.success, "the proposal must parse");
  return result.data;
}

test("every section kind expands to a document parseDocument accepts, unchanged", () => {
  const documents = expandProposal(parsed(validProposal()), slugs);
  assert.deepEqual(Object.keys(documents), ["p1", "p2"]);
  for (const document of Object.values(documents)) {
    assert.deepEqual(parseDocument(document, "page"), { ok: true, document });
  }
});

test("a page has one section per proposed section, in order", () => {
  const home = expandProposal(parsed(validProposal()), slugs).p1;
  assert.deepEqual(
    home?.content.map((s) => [s.attrs.align, s.attrs.background, s.content.length]),
    [
      ["middle", "none", 2],
      ["top", "none", 2],
      ["top", "band", 1],
      ["top", "none", 1],
    ],
  );
});

test("the hero fills its heading, body and button, and leaves the image empty", () => {
  const home = expandProposal(parsed(validProposal()), slugs).p1;
  const [text, imageColumn] = home?.content[0]?.content ?? [];
  assert.deepEqual(text?.content, [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Welcome" }] },
    { type: "paragraph", content: [{ type: "text", text: "We make bread." }] },
    { type: "space" },
    { type: "button", attrs: { label: "Visit", href: "/about", style: "filled" } },
  ]);
  assert.deepEqual(imageColumn?.content, [{ type: "image", attrs: { mediaId: "" } }]);
});

test("a button with no target links to the home page", () => {
  const p = validProposal() as Draft;
  delete p.pages[0].sections[0].buttonTarget;
  const home = expandProposal(parsed(p), slugs).p1;
  const button = home?.content[0]?.content[0]?.content[3];
  assert.deepEqual(button, {
    type: "button",
    attrs: { label: "Visit", href: "/", style: "filled" },
  });
});

test("a hero with no button label keeps the template's empty button, which is never drawn", () => {
  const p = validProposal() as Draft;
  p.pages[0].sections[0] = {
    kind: "hero",
    heading: "Hi",
    body: "There",
    buttonLabel: null,
    buttonTarget: "p2",
  };
  const home = expandProposal(parsed(p), slugs).p1;
  assert.deepEqual(home?.content[0]?.content[0]?.content[3], {
    type: "button",
    attrs: { label: "", href: "", style: "filled" },
  });
});

test("image-text puts the heading and body in the second column and leaves the image empty", () => {
  const home = expandProposal(parsed(validProposal()), slugs).p1;
  const [imageColumn, text] = home?.content[1]?.content ?? [];
  assert.deepEqual(imageColumn?.content, [{ type: "image", attrs: { mediaId: "" } }]);
  assert.deepEqual(text?.content, [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our story" }] },
    { type: "paragraph", content: [{ type: "text", text: "Since 1999." }] },
  ]);
});

test("cta fills heading, body and button, with the band background", () => {
  const home = expandProposal(parsed(validProposal()), slugs).p1;
  assert.deepEqual(home?.content[2]?.content[0]?.content, [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Talk to us" }] },
    { type: "paragraph", content: [{ type: "text", text: "We reply fast." }] },
    { type: "button", attrs: { label: "Contact", href: "/", style: "filled" } },
  ]);
});

test("text is the blank template with a level-2 heading and one paragraph per paragraph", () => {
  const home = expandProposal(parsed(validProposal()), slugs).p1;
  assert.deepEqual(home?.content[3]?.content[0]?.content, [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Details" }] },
    { type: "paragraph", content: [{ type: "text", text: "One." }] },
    { type: "paragraph", content: [{ type: "text", text: "Two." }] },
  ]);
});

test("the first hero on each page is its main heading; no other heading is level 1", () => {
  const p = validProposal() as Draft;
  p.pages[1].sections = [
    { kind: "text", heading: "Before", paragraphs: ["x"] },
    { kind: "hero", heading: "About hero", body: "b" },
    { kind: "hero", heading: "Second hero", body: "b" },
  ];
  const documents = expandProposal(parsed(p), slugs);
  assert.equal(findMainHeading(documents.p1 as never)?.content?.[0]?.text, "Welcome");
  assert.equal(findMainHeading(documents.p2 as never)?.content?.[0]?.text, "About hero");
  for (const document of Object.values(documents)) {
    const levels = blocksOf(document as never).flatMap((b) =>
      b.type === "heading" ? [b.attrs.level] : [],
    );
    assert.equal(levels.filter((l) => l === 1).length, 1);
  }
});

test("a page with no hero has no level-1 heading, so the page's title is its main heading", () => {
  const p = validProposal() as Draft;
  p.pages[0].sections = [{ kind: "text", heading: "T", paragraphs: ["x"] }];
  const home = expandProposal(parsed(p), slugs).p1;
  assert.equal(findMainHeading(home as never), undefined);
});

test("a page with no slug in the map is refused, naming the key", () => {
  assert.throws(() => expandProposal(parsed(validProposal()), { p1: "home" }), /p2/);
});

test("the largest allowed proposal expands within the section and block limits", () => {
  const big = {
    siteDescription: "Big.",
    brandColor: null,
    pages: Array.from({ length: 6 }, (_, i) => ({
      key: `p${i + 1}`,
      title: `Page ${i + 1}`,
      seoTitle: "T",
      seoDescription: "D",
      sections: ["hero", "hero", "image-text", "cta", "text", "text", "cta", "hero"].map((kind) =>
        kind === "text"
          ? { kind, heading: "H", paragraphs: ["a", "b", "c"] }
          : { kind, heading: "H", body: "B", buttonLabel: "Go", buttonTarget: "p6" },
      ),
    })),
    navigation: ["p1", "p2", "p3", "p4", "p5", "p6"],
  };
  const slugMap = Object.fromEntries(big.pages.map((p) => [p.key, `s-${p.key}`]));
  const documents = expandProposal(parsed(big), slugMap);
  assert.equal(Object.keys(documents).length, 6);
  for (const document of Object.values(documents)) {
    assert.ok(document.content.length <= MAX_SECTIONS);
    assert.ok(blocksOf(document).length <= MAX_DOCUMENT_BLOCKS);
    assert.deepEqual(parseDocument(document, "page"), { ok: true, document });
  }
});
