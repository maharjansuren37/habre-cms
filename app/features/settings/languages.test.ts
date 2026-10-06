import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LANGUAGE, isLanguageTag, LANGUAGES, languageOrDefault } from "./languages.ts";

// Right-to-left languages need dir="rtl" and a checked layout - not offered (item 17).
const RIGHT_TO_LEFT = ["ar", "he", "iw", "fa", "ur", "yi", "ps", "sd", "ug", "dv", "ckb", "ku"];

test("English is the default and is in the list", () => {
  assert.equal(DEFAULT_LANGUAGE, "en");
  assert.ok(LANGUAGES.some((language) => language.tag === "en"));
});

test("Nepali is in the list, named Nepali", () => {
  assert.equal(LANGUAGES.find((language) => language.tag === "ne")?.name, "Nepali");
});

test("the list is sorted by name", () => {
  const names = LANGUAGES.map((language) => language.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "en")),
  );
});

test("every tag has a real name and matches the database's format check", () => {
  assert.ok(LANGUAGES.length > 0);
  for (const { tag, name } of LANGUAGES) {
    assert.match(tag, /^[a-z]{2,3}(-[A-Z]{2})?$/);
    assert.notEqual(name, tag);
  }
});

test("no tag appears twice and no right-to-left language is offered", () => {
  const tags = LANGUAGES.map((language) => language.tag);
  assert.equal(new Set(tags).size, tags.length);
  for (const tag of RIGHT_TO_LEFT) assert.ok(!tags.includes(tag), tag);
});

test("isLanguageTag accepts a listed tag and nothing else", () => {
  assert.equal(isLanguageTag("ne"), true);
  assert.equal(isLanguageTag("xx-evil"), false);
  assert.equal(isLanguageTag("ar"), false);
  assert.equal(isLanguageTag(""), false);
});

test("languageOrDefault keeps a listed tag and turns anything else into English", () => {
  assert.equal(languageOrDefault("ne"), "ne");
  assert.equal(languageOrDefault("en-GB"), "en");
  assert.equal(languageOrDefault(""), "en");
});
