import assert from "node:assert/strict";
import { test } from "node:test";
import {
  brandColorSchema,
  contactNotifyEmailSchema,
  homePageIdSchema,
  isSettingsFormBodyAllowed,
  languageSchema,
  logoMediaIdSchema,
  siteDescriptionSchema,
  siteTitleSchema,
  stylePresetSchema,
} from "./settings-input.ts";

test("site title rejects an empty string", () => {
  const result = siteTitleSchema.safeParse("");
  assert.equal(result.success, false);
});

test("site title rejects more than 200 characters", () => {
  const result = siteTitleSchema.safeParse("a".repeat(201));
  assert.equal(result.success, false);
});

test("site title trims surrounding whitespace", () => {
  const result = siteTitleSchema.safeParse("  My Site  ");
  assert.equal(result.success, true);
  assert.equal(result.data, "My Site");
});

test("logo media id accepts a real UUID", () => {
  const result = logoMediaIdSchema.safeParse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  assert.equal(result.success, true);
});

test("logo media id accepts null", () => {
  const result = logoMediaIdSchema.safeParse(null);
  assert.equal(result.success, true);
});

test("logo media id rejects a non-UUID string", () => {
  const result = logoMediaIdSchema.safeParse("not-a-uuid");
  assert.equal(result.success, false);
});

test("home page id parses an empty string (No home page) to null", () => {
  const result = homePageIdSchema.safeParse("");
  assert.deepEqual(result, { success: true, data: null });
});

test("home page id passes a real UUID through unchanged", () => {
  const result = homePageIdSchema.safeParse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  assert.deepEqual(result, { success: true, data: "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
});

test("home page id rejects a malformed id", () => {
  const result = homePageIdSchema.safeParse("not-a-uuid");
  assert.equal(result.success, false);
});

const withLength = (value: string) => new Headers({ "Content-Length": value });

test("settings body size accepts exactly 16 KB", () => {
  assert.equal(isSettingsFormBodyAllowed(withLength("16384")), true);
});

test("settings body size refuses 16 KB plus one byte", () => {
  assert.equal(isSettingsFormBodyAllowed(withLength("16385")), false);
});

test("settings body size refuses a missing Content-Length", () => {
  assert.equal(isSettingsFormBodyAllowed(new Headers()), false);
});

test("settings body size refuses a non-numeric Content-Length", () => {
  assert.equal(isSettingsFormBodyAllowed(withLength("lots")), false);
});

test("site description accepts exactly 300 characters", () => {
  assert.equal(siteDescriptionSchema.safeParse("a".repeat(300)).success, true);
});

test("site description rejects 301 characters, saying so", () => {
  const result = siteDescriptionSchema.safeParse("a".repeat(301));
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Site description can be up to 300 characters.");
});

test("site description is trimmed, and may be empty", () => {
  assert.equal(siteDescriptionSchema.parse("  About us  "), "About us");
  assert.equal(siteDescriptionSchema.parse("   "), "");
});

test("site description rejects a character that cannot be stored", () => {
  assert.equal(siteDescriptionSchema.safeParse("bad\u0000text").success, false);
});

test("language accepts a listed tag", () => {
  assert.equal(languageSchema.safeParse("ne").success, true);
});

test("language rejects a tag that is not in the list", () => {
  const result = languageSchema.safeParse("xx-evil");
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Choose a language from the list.");
  assert.equal(languageSchema.safeParse("ar").success, false);
});

test("brand colour accepts no colour and a #rrggbb colour, lowercased", () => {
  assert.equal(brandColorSchema.parse(""), "");
  assert.equal(brandColorSchema.parse("#2f6b5a"), "#2f6b5a");
  assert.equal(brandColorSchema.parse("#2F6B5A"), "#2f6b5a");
});

test("brand colour refuses anything that is not exactly #rrggbb", () => {
  for (const bad of ["#2f6b5a;}", "#fff", "red", "2f6b5a", " #2f6b5a", "#2f6b5a ", "#gggggg"]) {
    assert.equal(brandColorSchema.safeParse(bad).success, false, bad);
  }
});

test("style preset accepts the three presets only", () => {
  for (const ok of ["classic", "modern", "friendly"]) {
    assert.equal(stylePresetSchema.parse(ok), ok);
  }
  for (const bad of ["ornate", "", "Classic"]) {
    assert.equal(stylePresetSchema.safeParse(bad).success, false, bad);
  }
});

test("contact notify email accepts blank as no address", () => {
  assert.deepEqual(contactNotifyEmailSchema.safeParse("   "), { success: true, data: "" });
});

test("contact notify email trims a valid address", () => {
  assert.deepEqual(contactNotifyEmailSchema.safeParse("  lena@example.org "), {
    success: true,
    data: "lena@example.org",
  });
});

test("contact notify email rejects an address with no @", () => {
  const result = contactNotifyEmailSchema.safeParse("lena.example.org");
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Enter a valid email address, or leave it blank.");
});

test("contact notify email rejects 255 characters", () => {
  const result = contactNotifyEmailSchema.safeParse(`${"a".repeat(243)}@example.org`);
  assert.equal(result.success, false);
});
