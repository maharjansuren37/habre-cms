import assert from "node:assert/strict";
import { test } from "node:test";
import { addressSuggestions, normalizeAddress, siteAddressSchema } from "./site-address.ts";

function message(value: string) {
  const result = siteAddressSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message;
}

test("an address is trimmed and lowercased", () => {
  assert.equal(normalizeAddress("  Lena-Novak "), "lena-novak");
  assert.equal(siteAddressSchema.parse("  Lena-Novak "), "lena-novak");
});

test("a valid address passes", () => {
  for (const a of ["abc", "lena-novak", "a1b2", "a".repeat(63)]) {
    assert.equal(message(a), null, a);
  }
});

test("an address under 3 characters is refused", () => {
  assert.match(message("ab") ?? "", /at least 3/);
  assert.match(message("") ?? "", /at least 3/);
});

test("an address over 63 characters is refused", () => {
  assert.match(message("a".repeat(64)) ?? "", /at most 63/);
});

test("characters other than letters, digits and dashes are refused", () => {
  for (const a of ["len a", "lena_novak", "lena.novak", "léna"]) {
    assert.match(message(a) ?? "", /Use only letters, numbers and dashes/, a);
  }
});

test("a leading or trailing dash is refused", () => {
  assert.match(message("-lena") ?? "", /can't start or end with a dash/);
  assert.match(message("lena-") ?? "", /can't start or end with a dash/);
});

test("an address starting xn-- is refused", () => {
  assert.match(message("xn--abc") ?? "", /can't start with xn--/);
});

test("a reserved address is refused", () => {
  for (const a of ["www", "admin", "signup", "WWW"]) {
    assert.match(message(a) ?? "", /is reserved/, a);
  }
});

test("suggestions start with the name joined, then -site, -web and -2 to -9", () => {
  assert.deepEqual(addressSuggestions("lena", "Lena Novak"), [
    "lenanovak",
    "lena-site",
    "lena-web",
    ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `lena-${n}`),
  ]);
});

test("suggestions drop the address itself and duplicates", () => {
  const list = addressSuggestions("lenanovak", "Lena Novak");
  assert.equal(list.includes("lenanovak"), false);
  assert.equal(list[0], "lenanovak-site");
  assert.equal(new Set(list).size, list.length);
});

test("suggestions drop reserved and invalid candidates", () => {
  assert.equal(addressSuggestions("lena", "WWW").includes("www"), false);
  assert.equal(addressSuggestions("lena", "Al").includes("al"), false);
  assert.equal(addressSuggestions("lena", "!!!")[0], "lena-site");
});

test("accents in a name are folded to plain letters", () => {
  assert.equal(addressSuggestions("lena", "Léna Nóvak")[0], "lenanovak");
});

test("a 61-character address drops -site and -web but keeps -2", () => {
  const list = addressSuggestions("a".repeat(61), "");
  assert.equal(list.includes(`${"a".repeat(61)}-site`), false);
  assert.equal(list.includes(`${"a".repeat(61)}-web`), false);
  assert.equal(list[0], `${"a".repeat(61)}-2`);
});
