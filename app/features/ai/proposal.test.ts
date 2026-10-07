import assert from "node:assert/strict";
import { test } from "node:test";
import { proposalSchema } from "./proposal.ts";
import { type Draft, section, validProposal } from "./test-proposal.ts";

/** The first issue's path, or the string "ok" when the input parses. */
function firstPath(input: unknown): string {
  const result = proposalSchema.safeParse(input);
  return result.success ? "ok" : (result.error.issues[0]?.path.join(".") ?? "");
}

function edit(change: (p: Draft) => void): unknown {
  const p = validProposal();
  change(p);
  return p;
}

test("a valid proposal parses", () => {
  assert.equal(firstPath(validProposal()), "ok");
});

test("null button slots parse and are dropped, as strict structured output sends them", () => {
  const p = edit((p) => {
    p.pages[0].sections[0] = { ...section("hero"), buttonLabel: null, buttonTarget: null };
    p.pages[0].sections[2] = { ...section("cta"), buttonTarget: null };
  });
  const result = proposalSchema.safeParse(p);
  assert.ok(result.success);
  const [hero, , cta] = result.data.pages[0].sections;
  assert.deepEqual(hero, { kind: "hero", heading: "Welcome", body: "We make bread." });
  assert.equal(Object.hasOwn(cta, "buttonTarget"), false);
});

test("a null brand colour parses", () => {
  assert.equal(firstPath(edit((p) => (p.brandColor = null))), "ok");
});

const overBound: [string, (p: Draft) => void, string][] = [
  ["an empty site description", (p) => (p.siteDescription = ""), "siteDescription"],
  ["a site description over 300", (p) => (p.siteDescription = "a".repeat(301)), "siteDescription"],
  ["no pages", (p) => (p.pages = []), "pages"],
  ["a title over 80", (p) => (p.pages[0].title = "a".repeat(81)), "pages.0.title"],
  ["an empty title", (p) => (p.pages[0].title = ""), "pages.0.title"],
  ["an SEO title over 70", (p) => (p.pages[0].seoTitle = "a".repeat(71)), "pages.0.seoTitle"],
  [
    "an SEO description over 300",
    (p) => (p.pages[0].seoDescription = "a".repeat(301)),
    "pages.0.seoDescription",
  ],
  ["no sections", (p) => (p.pages[0].sections = []), "pages.0.sections"],
  [
    "nine sections",
    (p) => (p.pages[0].sections = Array.from({ length: 9 }, () => section("text"))),
    "pages.0.sections",
  ],
  [
    "a heading over 120",
    (p) => (p.pages[0].sections[0].heading = "a".repeat(121)),
    "pages.0.sections.0.heading",
  ],
  [
    "a body over 1200",
    (p) => (p.pages[0].sections[1].body = "a".repeat(1201)),
    "pages.0.sections.1.body",
  ],
  [
    "a button label over 40",
    (p) => (p.pages[0].sections[0].buttonLabel = "a".repeat(41)),
    "pages.0.sections.0.buttonLabel",
  ],
  [
    "a cta with no button label",
    (p) => delete p.pages[0].sections[2].buttonLabel,
    "pages.0.sections.2.buttonLabel",
  ],
  [
    "no paragraphs in a text section",
    (p) => (p.pages[0].sections[3].paragraphs = []),
    "pages.0.sections.3.paragraphs",
  ],
  [
    "four paragraphs in a text section",
    (p) => (p.pages[0].sections[3].paragraphs = ["a", "b", "c", "d"]),
    "pages.0.sections.3.paragraphs",
  ],
  [
    "a paragraph over 1200",
    (p) => (p.pages[0].sections[3].paragraphs = ["a".repeat(1201)]),
    "pages.0.sections.3.paragraphs.0",
  ],
  ["an empty navigation", (p) => (p.navigation = []), "navigation"],
  [
    "a whitespace-only heading",
    (p) => (p.pages[0].sections[0].heading = "   "),
    "pages.0.sections.0.heading",
  ],
];
for (const [name, change, path] of overBound) {
  test(`${name} is refused at ${path}`, () => {
    assert.equal(firstPath(edit(change)), path);
  });
}

test("an unknown section kind is refused at the kind", () => {
  const p = edit((p) => (p.pages[0].sections[0] = { kind: "video", heading: "x", body: "y" }));
  assert.equal(firstPath(p), "pages.0.sections.0.kind");
});

test("a button pointing at a page that is not in the proposal is refused at buttonTarget", () => {
  const p = edit((p) => (p.pages[0].sections[0].buttonTarget = "p9"));
  assert.equal(firstPath(p), "pages.0.sections.0.buttonTarget");
});

test("a navigation entry that is not a page is refused", () => {
  assert.equal(firstPath(edit((p) => (p.navigation = ["p1", "p9"]))), "navigation.1");
});

test("a repeated navigation entry is refused", () => {
  assert.equal(firstPath(edit((p) => (p.navigation = ["p1", "p1"]))), "navigation.1");
});

test("a repeated page key is refused", () => {
  assert.equal(firstPath(edit((p) => (p.pages[1].key = "p1"))), "pages.1.key");
});

test("a page key outside p1 to p6 is refused", () => {
  assert.equal(firstPath(edit((p) => (p.pages[1].key = "about"))), "pages.1.key");
});

for (const colour of ["#AA5500", "#a50", "aa5500", "#aa55001", "#aa550g", " #aa5500", "red"]) {
  test(`the colour ${JSON.stringify(colour)} is refused`, () => {
    assert.equal(firstPath(edit((p) => (p.brandColor = colour))), "brandColor");
  });
}

for (const [name, bad] of [
  ["a NUL", "a\u0000b"],
  ["a newline", "a\nb"],
  ["a tab", "a\tb"],
  ["an escape", "a\u001bb"],
  ["a DEL", "a\u007fb"],
  ["a C1 control", "a\u0085b"],
  ["a lone surrogate", "a\ud800b"],
] as const) {
  test(`${name} in a slot is refused`, () => {
    assert.equal(
      firstPath(edit((p) => (p.pages[0].sections[3].paragraphs[1] = bad))),
      "pages.0.sections.3.paragraphs.1",
    );
    assert.equal(firstPath(edit((p) => (p.pages[0].title = bad))), "pages.0.title");
    assert.equal(firstPath(edit((p) => (p.siteDescription = bad))), "siteDescription");
  });
}

test("seven pages are refused as too many, at pages", () => {
  const p = edit((p) => {
    p.pages = Array.from({ length: 7 }, (_, i) => ({ ...p.pages[1], key: `p${i + 1}` }));
  });
  const result = proposalSchema.safeParse(p);
  assert.ok(!result.success);
  assert.ok(result.error.issues.some((i) => i.code === "too_big" && i.path.join(".") === "pages"));
});
