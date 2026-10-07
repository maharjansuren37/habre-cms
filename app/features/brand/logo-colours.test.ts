import assert from "node:assert/strict";
import { test } from "node:test";
import { colourWord, paletteFromPixels } from "./logo-colours.ts";

type Rgba = [number, number, number, number];

function hex(value: string, alpha = 255): Rgba {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    alpha,
  ];
}

/** A 100x100 image whose pixels are filled in order from `parts` (share of 10000 pixels). */
function image(parts: [Rgba, number][]): Uint8Array {
  const out = new Uint8Array(10000 * 4);
  let at = 0;
  for (const [colour, count] of parts) {
    for (let i = 0; i < count; i++) out.set(colour, at++ * 4);
  }
  return out;
}

function withinOneStep(actual: string | undefined, expected: string) {
  assert.ok(actual, `expected ${expected}, got nothing`);
  for (const i of [1, 3, 5]) {
    const a = Number.parseInt(actual.slice(i, i + 2), 16);
    const e = Number.parseInt(expected.slice(i, i + 2), 16);
    assert.ok(Math.abs(a - e) <= 1, `${actual} is not within one step of ${expected}`);
  }
}

const WHITE = hex("#ffffff");
const GREEN = hex("#2f6b5a");
const GOLD = hex("#c9a25e");

test("the mock's logo on white gives its green and its gold, most-used first", () => {
  const colours = paletteFromPixels(
    image([
      [WHITE, 6000],
      [GREEN, 2500],
      [GOLD, 1500],
    ]),
    100,
    100,
  );
  assert.equal(colours.length, 2);
  // The green covers more pixels, so it comes first.
  withinOneStep(colours[0], "#2f6b5a");
  withinOneStep(colours[1], "#c9a25e");
});

test("every colour is lowercase #rrggbb", () => {
  const colours = paletteFromPixels(
    image([
      [WHITE, 6000],
      [GREEN, 2500],
      [GOLD, 1500],
    ]),
    100,
    100,
  );
  for (const colour of colours) assert.match(colour, /^#[0-9a-f]{6}$/);
});

test("a fully transparent image gives no colours", () => {
  assert.deepEqual(paletteFromPixels(image([[hex("#ff0000", 0), 10000]]), 100, 100), []);
});

test("a white-only image gives no colours", () => {
  assert.deepEqual(paletteFromPixels(image([[WHITE, 10000]]), 100, 100), []);
});

test("pixels under half transparent are skipped", () => {
  const colours = paletteFromPixels(
    image([
      [hex("#ff0000", 100), 5000],
      [GREEN, 5000],
    ]),
    100,
    100,
  );
  assert.equal(colours.length, 1);
  withinOneStep(colours[0], "#2f6b5a");
});

test("a 2% speck of another colour is left out", () => {
  const colours = paletteFromPixels(
    image([
      [WHITE, 4000],
      [GREEN, 3000],
      [GOLD, 2800],
      [hex("#e02020"), 200],
    ]),
    100,
    100,
  );
  assert.equal(colours.length, 2);
  assert.ok(!colours.some((c) => colourWord(c) === "red"));
});

test("four strong colours give the three most used, most-used first", () => {
  const colours = paletteFromPixels(
    image([
      [hex("#d01010"), 3000],
      [hex("#1010d0"), 2500],
      [hex("#10a010"), 2000],
      [hex("#d0a010"), 1500],
    ]),
    100,
    100,
  );
  assert.equal(colours.length, 3);
  withinOneStep(colours[0], "#d01010");
  withinOneStep(colours[1], "#1010d0");
  withinOneStep(colours[2], "#10a010");
});

test("two close tones of one hue, 55/45, both come back (F-317)", () => {
  for (const [first, second] of [
    ["#2f6b5a", "#4a9c80"],
    ["#ff6b00", "#ffb000"],
  ] as const) {
    const colours = paletteFromPixels(
      image([
        [hex(first), 5500],
        [hex(second), 4500],
      ]),
      100,
      100,
    );
    assert.deepEqual(colours, [first, second]);
  }
});

test("the blended edge between a logo and a dark background is not a colour of its own", () => {
  // #71613c sits halfway between the background #1a1a1a and the gold #c9a25e.
  const colours = paletteFromPixels(
    image([
      [hex("#1a1a1a"), 5500],
      [hex("#c9a25e"), 3500],
      [hex("#71613c"), 1000],
    ]),
    100,
    100,
  );
  assert.deepEqual(colours, ["#1a1a1a", "#c9a25e"]);
});

test("an image of one flat colour comes back exactly", () => {
  assert.deepEqual(paletteFromPixels(image([[GREEN, 10000]]), 100, 100), ["#2f6b5a"]);
});

const WORDS: [string, string[]][] = [
  ["red", ["#e02020", "#c01818"]],
  ["orange", ["#ff8000", "#f08020"]],
  ["yellow", ["#ffe000", "#c9a25e"]],
  ["green", ["#2f6b5a", "#20a040", "#40c060"]],
  ["teal", ["#008080", "#20b0b8"]],
  ["blue", ["#1e50d0", "#4090ff"]],
  ["purple", ["#7030a0", "#9060d0"]],
  ["pink", ["#ffc0cb", "#e0409a"]],
  ["brown", ["#8b4513", "#6b4a30"]],
  ["grey", ["#808080", "#a0a4a8"]],
  ["black", ["#111111", "#000000", "#101820"]],
];

for (const [word, hexes] of WORDS) {
  test(`colourWord names ${hexes.join(", ")} ${word}`, () => {
    for (const value of hexes) assert.equal(colourWord(value), word, value);
  });
}

test("an edge group that is the largest is still dropped as a halo (F-323)", () => {
  const colours = paletteFromPixels(
    image([
      [GREEN, 2000],
      [hex("#99b6ae"), 3000],
      [WHITE, 5000],
    ]),
    100,
    100,
  );
  assert.deepEqual(colours, ["#2f6b5a"]);
});
