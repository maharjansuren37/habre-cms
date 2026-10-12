import assert from "node:assert/strict";
import { test } from "node:test";
import { LEGAL_DOCUMENTS } from "./legal-documents.ts";

const KEYS = ["terms", "privacy"] as const;

function allStrings(key: (typeof KEYS)[number]): string[] {
  const document = LEGAL_DOCUMENTS[key];
  return [
    document.title,
    document.updated,
    ...document.intro,
    ...document.sections.flatMap((section) => [
      section.id,
      section.heading,
      ...section.paragraphs,
      ...(section.list ?? []),
    ]),
  ];
}

test("both documents exist, each with an intro and at least one section", () => {
  for (const key of KEYS) {
    const document = LEGAL_DOCUMENTS[key];
    assert.ok(document, key);
    assert.ok(document.intro.length > 0, key);
    assert.ok(document.sections.length > 0, key);
  }
});

test("each document's updated date is a real calendar date", () => {
  for (const key of KEYS) {
    const { updated } = LEGAL_DOCUMENTS[key];
    assert.match(updated, /^\d{4}-\d{2}-\d{2}$/, key);
    assert.equal(new Date(`${updated}T00:00:00Z`).toISOString().slice(0, 10), updated, key);
  }
});

test("section ids are unique and kebab-case in each document", () => {
  for (const key of KEYS) {
    const ids = LEGAL_DOCUMENTS[key].sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, key);
    for (const id of ids) assert.match(id, /^[a-z]+(-[a-z]+)*$/, `${key}: ${id}`);
  }
});

test("no string in either document is empty, and no section has an empty list", () => {
  for (const key of KEYS) {
    for (const value of allStrings(key)) assert.ok(value.trim().length > 0, key);
    for (const section of LEGAL_DOCUMENTS[key].sections) {
      assert.ok(section.paragraphs.length > 0 || (section.list?.length ?? 0) > 0, section.id);
      if (section.list) assert.ok(section.list.length > 0, section.id);
    }
  }
});

test("the privacy policy names every service that handles personal data", () => {
  const text = allStrings("privacy").join("\n");
  for (const name of [
    "OpenRouter",
    "Anthropic",
    "OpenAI",
    "Resend",
    "Cloudflare",
    "Stripe",
    "Oracle Cloud",
  ]) {
    assert.ok(text.includes(name), name);
  }
});
