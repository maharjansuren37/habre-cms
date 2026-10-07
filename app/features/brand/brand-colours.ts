// Brand colour shades (D167, D171). Pure, so it runs on the server and in the browser.
// The stored colour is only ever `''` (no colour) or `#rrggbb`; every colour that reaches a
// page is derived here and re-printed as `#rrggbb`, never the stored string.

export type BrandSurface = { bg: string; surface: string; sunken: string };
export type BrandShades = {
  primary: string;
  primaryHover: string;
  onPrimary: string;
  primarySubtle: string;
  focusRing: string;
};

// The light site scope's --color-bg (neutral-0), --color-surface (neutral-50) and
// --color-surface-sunken (neutral-100, a band section's background, F-312) in app/app.css.
// Keep them in step; the tests read these values. Item 20 passes a dark set.
export const LIGHT_SITE_SURFACE: BrandSurface = {
  bg: "#ffffff",
  surface: "#fafafa",
  sunken: "#f5f5f5",
};

const AA = 4.5;
const WHITE = "#ffffff";
const NEAR_BLACK = "#0a0a0a";
const HEX = /^#[0-9a-fA-F]{6}$/;

/** `#rrggbb` (either case) as lowercase, or `''` - "no colour" - for anything else. */
export function parseBrandColor(value: string): string {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : "";
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
}

const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToHex(rgb: Rgb): string {
  const part = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${rgb.map(part).join("")}`;
}

/** WCAG relative luminance of a `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(decode) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Oklch = { l: number; c: number; h: number };

function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(decode) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lab = {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
  return { l: lab.l, c: Math.hypot(lab.a, lab.b), h: Math.atan2(lab.b, lab.a) };
}

function linearRgb({ l: L, c, h }: Oklch): Rgb {
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
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** OKLCH to `#rrggbb`; chroma is reduced at fixed lightness and hue until it fits sRGB. */
function oklchToHex(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  let rgb = linearRgb({ ...color, l });
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(linearRgb({ l, c: mid, h: color.h }))) lo = mid;
      else hi = mid;
    }
    rgb = linearRgb({ l, c: lo, h: color.h });
  }
  return rgbToHex(rgb.map((v) => encode(Math.max(0, v))) as Rgb);
}

// The rule, fitted to design.md's example #2f6b5a (OKLCH 0.4826 / 0.0688 / 172.2):
//   hover  = primary's lightness minus 0.07, same chroma and hue  -> #185747
//   subtle = lightness 0.965, 35% of the chroma, same hue     -> #e4f9f2
// Primary keeps its own colour when every pair already holds; otherwise its lightness is
// lowered in steps of 0.005 (chroma clamped into sRGB) until they do. Lowering always ends:
// black passes. On-primary is white, or near-black if white fails on primary or hover.
function shadesFor(primary: string, surface: BrandSurface): BrandShades & { ok: boolean } {
  const { l, c, h } = hexToOklch(primary);
  const primaryHover = oklchToHex({ l: l - 0.07, c, h });
  const primarySubtle = oklchToHex({ l: 0.965, c: c * 0.35, h });
  const onPrimary = [WHITE, NEAR_BLACK].find(
    (on) => contrastRatio(on, primary) >= AA && contrastRatio(on, primaryHover) >= AA,
  );
  const ok =
    onPrimary !== undefined &&
    contrastRatio(primary, surface.bg) >= AA &&
    contrastRatio(primary, surface.surface) >= AA &&
    contrastRatio(primary, surface.sunken) >= AA &&
    contrastRatio(primary, primarySubtle) >= AA;
  return {
    primary,
    primaryHover,
    onPrimary: onPrimary ?? WHITE,
    primarySubtle,
    focusRing: primary,
    ok,
  };
}

/**
 * The five brand roles from one `#rrggbb`, each `#rrggbb`: primary at least 4.5:1 on the
 * surface's bg, its surface, its sunken surface (a band section) and subtle; on-primary at
 * least 4.5:1 on primary and hover.
 * Input that is not `#rrggbb` is treated as black.
 */
export function deriveBrandShades(hex: string, surface: BrandSurface): BrandShades {
  const start = parseBrandColor(hex) || "#000000";
  let candidate = shadesFor(start, surface);
  if (!candidate.ok) {
    const { l, c, h } = hexToOklch(start);
    for (let step = 1; step <= 200 && !candidate.ok; step++) {
      candidate = shadesFor(oklchToHex({ l: l - step * 0.005, c, h }), surface);
    }
  }
  const { ok: _ok, ...shades } = candidate;
  return shades;
}

/**
 * The declarations for a site's brand, built only from derived hex values; `''` for no colour.
 * Parses again so a stored string is never interpolated.
 */
export function brandCustomProperties(brand: string): string {
  const colour = parseBrandColor(brand);
  if (colour === "") return "";
  const s = deriveBrandShades(colour, LIGHT_SITE_SURFACE);
  return `--color-primary:${s.primary};--color-primary-hover:${s.primaryHover};--color-on-primary:${s.onPrimary};--color-primary-subtle:${s.primarySubtle};--color-focus-ring:${s.focusRing};`;
}
