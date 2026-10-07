import assert from "node:assert/strict";
import { test } from "node:test";
import { brandSwatches, choiceAfterLogoChange, choiceColour } from "./brand-swatches.ts";

const GREEN = "#2f6b5a";
const GOLD = "#c9a25e";
const RUST = "#b4532a";

const kinds = (list: ReturnType<typeof brandSwatches>) => list.map((s) => `${s.kind}:${s.value}`);
const checkedOf = (list: ReturnType<typeof brandSwatches>) => list.filter((s) => s.checked);

test("with no logo the row is 18a1's: No colour, the saved colour, Other colour", () => {
  assert.deepEqual(kinds(brandSwatches(RUST, [], "saved", "#111111")), [
    "none:",
    `saved:${RUST}`,
    "other:#111111",
  ]);
});

test("with no logo and no saved colour the row is No colour and Other colour", () => {
  assert.deepEqual(kinds(brandSwatches("", [], "none", GREEN)), ["none:", `other:${GREEN}`]);
});

test("the logo's colours come after the saved colour, in their stored order, before Other", () => {
  assert.deepEqual(kinds(brandSwatches(RUST, [GREEN, GOLD], "saved", "#111111")), [
    "none:",
    `saved:${RUST}`,
    `logo:${GREEN}`,
    `logo:${GOLD}`,
    "other:#111111",
  ]);
});

test("a logo colour equal to the saved one is shown once, as the logo's", () => {
  const list = brandSwatches(GREEN, [GREEN, GOLD], "none", "#111111");
  assert.deepEqual(kinds(list), ["none:", `logo:${GREEN}`, `logo:${GOLD}`, "other:#111111"]);
});

test("none of the logo's colours is checked unless the choice says so", () => {
  for (const choice of ["none", "saved", "other"]) {
    const list = brandSwatches(RUST, [GREEN, GOLD], choice, "#111111");
    assert.equal(list.filter((s) => s.kind === "logo" && s.checked).length, 0);
    assert.equal(checkedOf(list).length, 1);
  }
});

test("a chosen logo colour is the one checked swatch", () => {
  const [only] = checkedOf(brandSwatches(RUST, [GREEN, GOLD], GOLD, "#111111"));
  assert.equal(only?.kind, "logo");
  assert.equal(only?.value, GOLD);
});

test("a saved choice lands on the logo swatch when that swatch stands for the saved colour", () => {
  const [only] = checkedOf(brandSwatches(GREEN, [GREEN], "saved", "#111111"));
  assert.equal(only?.kind, "logo");
});

test("choiceColour gives the colour each choice stands for", () => {
  assert.equal(choiceColour("none", RUST, "#111111"), "");
  assert.equal(choiceColour("saved", RUST, "#111111"), RUST);
  assert.equal(choiceColour("other", RUST, "#111111"), "#111111");
  assert.equal(choiceColour(GOLD, RUST, "#111111"), GOLD);
});

test("a chosen logo colour that is no longer offered stays chosen as Other colour", () => {
  assert.deepEqual(choiceAfterLogoChange(GREEN, RUST, [], "#111111"), {
    choice: "other",
    other: GREEN,
  });
  assert.deepEqual(choiceAfterLogoChange(GREEN, RUST, [GOLD], "#111111"), {
    choice: "other",
    other: GREEN,
  });
});

test("a chosen logo colour that is still offered, or equals the saved colour, stays as it is", () => {
  assert.deepEqual(choiceAfterLogoChange(GREEN, RUST, [GOLD, GREEN], "#111111"), {
    choice: GREEN,
    other: "#111111",
  });
  assert.deepEqual(choiceAfterLogoChange(GREEN, GREEN, [], "#111111"), {
    choice: "saved",
    other: "#111111",
  });
});

test("none, saved and other choices never move when the logo changes", () => {
  for (const choice of ["none", "saved", "other"]) {
    assert.deepEqual(choiceAfterLogoChange(choice, RUST, [GREEN], "#111111"), {
      choice,
      other: "#111111",
    });
  }
});
