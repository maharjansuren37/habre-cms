// The colours of a logo (D167), counted from its pixels. Pure, so it runs on the server (sharp
// hands it a 64px raw copy at upload) and in the browser.
//
// The rule, with the values tuned in item 18a2:
//   - skip pixels under 50% alpha (ALPHA_MIN) and near-white ones (OKLCH L > 0.95, WHITE_L);
//   - group the rest by OKLab distance: each pixel joins the nearest group whose running OKLab
//     centre is within 0.08 (GROUP_DISTANCE), else it starts a group;
//   - keep groups holding at least 5% of the counted pixels (GROUP_SHARE), and drop a halo: a
//     group whose average lies within 12 of 255 (HALO_TOLERANCE) of the sRGB segment (strictly
//     between its ends) from another kept colour to white, or between two others - the
//     anti-aliased edge where a shape meets its background, even when it is the largest group.
//     A second tone of the same hue is off that segment, so it stays a colour of its own
//     (F-317, F-323). The cost (F-324): a deliberate tint of a kept colour, a grey beside
//     black, or a mix of two kept colours is dropped as a halo at any share;
//   - a group's colour is the average of its pixels in sRGB, so a flat colour comes back exactly;
//   - at most three (MAX_COLOURS): the most used first by pixel count, a tie going to the
//     higher chroma; the cut keeps the three most used.
// colourWord bands, by OKLCH hue in degrees: red 355-40, orange 40-80, yellow 80-125, green
// 125-176, teal 176-225, blue 225-285, purple 285-325, pink 325-355. Chroma under 0.04 is grey,
// lightness under 0.25 black; a dark orange or yellow (L under 0.6) is brown, a light red
// (L over 0.78) pink.

import { hexToOklch, srgbToOklab } from "./brand-colours.ts";

const ALPHA_MIN = 128;
const WHITE_L = 0.95;
const GROUP_DISTANCE = 0.08;
const GROUP_SHARE = 0.05;
const HALO_TOLERANCE = 12;
const MAX_COLOURS = 3;

type Group = { l: number; a: number; b: number; n: number; r: number; g: number; bl: number };
type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const average = (group: Group): Rgb => [group.r / group.n, group.g / group.n, group.bl / group.n];

/** Whether `point` lies within HALO_TOLERANCE of the segment between `from` and `to`, strictly
 *  between them - a blend of the two, as an anti-aliased edge is. */
function isBlend(point: Rgb, from: Rgb, to: Rgb): boolean {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  if (length2 === 0) return false;
  const t =
    ((point[0] - from[0]) * d[0] + (point[1] - from[1]) * d[1] + (point[2] - from[2]) * d[2]) /
    length2;
  if (t <= 0 || t >= 1) return false;
  return (
    Math.hypot(
      point[0] - (from[0] + t * d[0]),
      point[1] - (from[1] + t * d[1]),
      point[2] - (from[2] + t * d[2]),
    ) < HALO_TOLERANCE
  );
}

/** Up to three `#rrggbb` (lowercase) from `width * height * 4` RGBA bytes, most used first. */
export function paletteFromPixels(rgba: Uint8Array, width: number, height: number): string[] {
  const groups: Group[] = [];
  let counted = 0;
  for (let i = 0; i < width * height; i++) {
    const [r, g, b, alpha] = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]] as [
      number,
      number,
      number,
      number,
    ];
    if (alpha < ALPHA_MIN) continue;
    const lab = srgbToOklab(r / 255, g / 255, b / 255);
    if (lab.l > WHITE_L) continue;
    counted++;
    let nearest: Group | undefined;
    let best = GROUP_DISTANCE;
    for (const group of groups) {
      const distance = Math.hypot(lab.l - group.l, lab.a - group.a, lab.b - group.b);
      if (distance < best) {
        best = distance;
        nearest = group;
      }
    }
    if (!nearest) {
      groups.push({ ...lab, n: 1, r, g, bl: b });
      continue;
    }
    const n = nearest.n + 1;
    nearest.l += (lab.l - nearest.l) / n;
    nearest.a += (lab.a - nearest.a) / n;
    nearest.b += (lab.b - nearest.b) / n;
    nearest.r += r;
    nearest.g += g;
    nearest.bl += b;
    nearest.n = n;
  }

  const candidates = groups.filter((g) => g.n >= counted * GROUP_SHARE);
  const kept = candidates.filter((group) => {
    const colour = average(group);
    const others = candidates.filter((g) => g !== group).map(average);
    return !others.some(
      (a, i) => isBlend(colour, a, WHITE) || others.slice(i + 1).some((b) => isBlend(colour, a, b)),
    );
  });

  return kept
    .map((group) => ({
      n: group.n,
      chroma: Math.hypot(group.a, group.b),
      hex: `#${[group.r, group.g, group.bl]
        .map((sum) =>
          Math.round(sum / group.n)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`,
    }))
    .sort((x, y) => y.n - x.n || y.chroma - x.chroma)
    .slice(0, MAX_COLOURS)
    .map((colour) => colour.hex);
}

/** A plain word for a `#rrggbb`: red, orange, yellow, green, teal, blue, purple, pink, brown, grey or black. */
export function colourWord(hex: string): string {
  const { l, c, h } = hexToOklch(hex);
  if (l < 0.25) return "black";
  if (c < 0.04) return "grey";
  const degrees = ((h * 180) / Math.PI + 360) % 360;
  if (degrees >= 355 || degrees < 40) return l > 0.78 ? "pink" : "red";
  if (degrees < 80) return l < 0.6 ? "brown" : "orange";
  if (degrees < 125) return l < 0.6 ? "brown" : "yellow";
  if (degrees < 176) return "green";
  if (degrees < 225) return "teal";
  if (degrees < 285) return "blue";
  if (degrees < 325) return "purple";
  return "pink";
}
