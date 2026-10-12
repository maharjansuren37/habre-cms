import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  brandCustomProperties,
  brandDarkCustomProperties,
  contrastRatio,
  DARK_SITE_SURFACE,
  deriveBrandShades,
  LIGHT_SITE_SURFACE,
  parseBrandColor,
} from "./brand-colours.ts";

const CHARSET = /^[a-z0-9#:;-]*$/;

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// A hex for an OKLCH colour, with chroma reduced until it fits sRGB (test helper, independent
// of the module under test).
function oklchHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const enc = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const at = (c: number) => {
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  let lo = 0;
  let hi = C;
  const ok = (c: number) => at(c).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  if (ok(C)) lo = C;
  else {
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
  }
  const [r, g, b] = at(lo).map((v) =>
    Math.round(Math.min(1, Math.max(0, enc(Math.max(0, v)))) * 255),
  );
  return toHex(r, g, b);
}

function pairs(hex: string) {
  const { bg, surface, sunken } = LIGHT_SITE_SURFACE;
  const s = deriveBrandShades(hex, LIGHT_SITE_SURFACE);
  return {
    s,
    list: [
      ["primary on bg", contrastRatio(s.primary, bg)],
      ["primary on surface", contrastRatio(s.primary, surface)],
      ["primary on sunken", contrastRatio(s.primary, sunken)],
      ["primary on subtle", contrastRatio(s.primary, s.primarySubtle)],
      ["on-primary on primary", contrastRatio(s.onPrimary, s.primary)],
      ["on-primary on hover", contrastRatio(s.onPrimary, s.primaryHover)],
    ] as const,
  };
}

function assertPairsHold(hex: string) {
  const { s, list } = pairs(hex);
  for (const [name, ratio] of list) {
    assert.ok(ratio >= 4.5, `${hex}: ${name} is ${ratio.toFixed(2)}`);
  }
  for (const v of Object.values(s)) assert.match(v, /^#[0-9a-f]{6}$/);
  assert.match(brandCustomProperties(hex), CHARSET);
}

test("the example eucalyptus colour comes back unchanged at 6.23:1 on the background", () => {
  const { s } = pairs("#2f6b5a");
  assert.equal(s.primary, "#2f6b5a");
  assert.equal(s.focusRing, "#2f6b5a");
  assert.equal(contrastRatio(s.primary, LIGHT_SITE_SURFACE.bg).toFixed(2), "6.23");
});

test("the example colour's hover, text and subtle shades are the mock-up's", () => {
  const { s } = pairs("#2f6b5a");
  assert.equal(s.onPrimary, "#ffffff");
  assert.equal(s.primaryHover, "#185747");
  assert.equal(s.primarySubtle, "#e4f9f2");
});

test("gold is darkened so its primary reads at 4.5:1 on its subtle shade", () => {
  const { s, list } = pairs("#c9a25e");
  assert.notEqual(s.primary, "#c9a25e");
  assert.ok(list[2][1] >= 4.5);
});

test("every hue and lightness in the grid meets all five pairs", () => {
  for (let h = 0; h < 360; h += 10) {
    for (let i = 0; i < 10; i++) {
      const L = 0.05 + i * 0.1;
      for (const C of [0.1, 0.2]) assertPairsHold(oklchHex(L, C, h));
    }
  }
});

test("a light green that already passed on white still reads at 4.5:1 on a band section", () => {
  // F-312's reproduction: #69c369 once derived #24822a, 4.48:1 on surface-sunken.
  const { s } = pairs("#69c369");
  assert.ok(contrastRatio(s.primary, LIGHT_SITE_SURFACE.sunken) >= 4.5);
});

test("pure white, black and yellow meet all five pairs", () => {
  for (const hex of ["#ffffff", "#000000", "#ffff00"]) assertPairsHold(hex);
});

test("parsing accepts only exactly #rrggbb and lowercases it", () => {
  assert.equal(parseBrandColor("#fff"), "");
  assert.equal(parseBrandColor("red"), "");
  assert.equal(parseBrandColor("#2f6b5a;}"), "");
  assert.equal(parseBrandColor("#2F6B5A"), "#2f6b5a");
  assert.equal(parseBrandColor(""), "");
});

test("no colour gives no declarations", () => {
  assert.equal(brandCustomProperties(""), "");
  assert.equal(brandCustomProperties("red"), "");
});

test("the declarations text holds only safe characters, even for hostile input", () => {
  for (const v of ["#2f6b5a;}", "#2f6b5a</style>", "url(x)", "#2F6B5A", "#c9a25e"]) {
    assert.match(brandCustomProperties(v), CHARSET);
  }
  assert.equal(
    brandCustomProperties("#2F6B5A"),
    "--color-primary:#2f6b5a;--color-primary-hover:#185747;--color-on-primary:#ffffff;--color-primary-subtle:#e4f9f2;--color-focus-ring:#2f6b5a;",
  );
});

test("the light surface matches the site scope's bg, surface and sunken in app.css", () => {
  const css = readFileSync(path.join(import.meta.dirname, "../../app.css"), "utf8");
  const token = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`))?.[1];
  const scope = css.slice(css.indexOf('[data-surface="site"] {'));
  const role = (name: string) =>
    scope.match(new RegExp(`${name}:\\s*var\\((--[a-z0-9-]+)\\)`))?.[1];
  assert.equal(token(role("--color-bg") ?? ""), LIGHT_SITE_SURFACE.bg);
  assert.equal(token(role("--color-surface") ?? ""), LIGHT_SITE_SURFACE.surface);
  assert.equal(token(role("--color-surface-sunken") ?? ""), LIGHT_SITE_SURFACE.sunken);
});

test("the dark surface matches the dark site scope's bg, surface and sunken in app.css", () => {
  const css = readFileSync(path.join(import.meta.dirname, "../../app.css"), "utf8");
  const token = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`))?.[1];
  const scope = css.slice(css.indexOf('[data-surface="site"][data-dark="auto"] {'));
  const role = (name: string) =>
    scope.match(new RegExp(`${name}:\\s*var\\((--[a-z0-9-]+)\\)`))?.[1];
  assert.equal(token(role("--color-bg") ?? ""), DARK_SITE_SURFACE.bg);
  assert.equal(token(role("--color-surface") ?? ""), DARK_SITE_SURFACE.surface);
  assert.equal(token(role("--color-surface-sunken") ?? ""), DARK_SITE_SURFACE.sunken);
});

test("on the dark surface every pair still holds, for dark, light and mid colours alike", () => {
  const { bg, surface, sunken } = DARK_SITE_SURFACE;
  for (const hex of ["#000000", "#ffffff", "#ffff00", "#2f6b5a", "#1a237e", "#c9a25e", "#8b0000"]) {
    const s = deriveBrandShades(hex, DARK_SITE_SURFACE);
    for (const [name, against] of [
      ["bg", bg],
      ["surface", surface],
      ["sunken", sunken],
      ["subtle", s.primarySubtle],
    ] as const) {
      assert.ok(contrastRatio(s.primary, against) >= 4.5, `${hex} primary on ${name}`);
    }
    assert.ok(contrastRatio(s.onPrimary, s.primary) >= 4.5, `${hex} on-primary`);
    assert.ok(contrastRatio(s.onPrimary, s.primaryHover) >= 4.5, `${hex} on-primary hover`);
  }
});

test("a light brand colour keeps its own hue on the dark surface", () => {
  assert.equal(deriveBrandShades("#c9a25e", DARK_SITE_SURFACE).primary, "#c9a25e");
});

test("the dark declarations are safe text, and empty for no colour", () => {
  assert.equal(brandDarkCustomProperties(""), "");
  assert.equal(brandDarkCustomProperties("red"), "");
  assert.match(brandDarkCustomProperties("#2F6B5A"), CHARSET);
  assert.match(brandDarkCustomProperties("#2F6B5A"), /^--color-primary:#[0-9a-f]{6};/);
});
