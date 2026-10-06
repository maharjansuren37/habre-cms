/** The WebP widths a resized upload is stored at, widest last (D174). */
const STANDARD_WIDTHS = [480, 960, 1600, 2400] as const;

/**
 * Which widths to make from an original that is `originalWidth` px wide (after
 * orientation): every standard size narrower than the original, plus the
 * original's own width when it is under the widest standard size - so nothing
 * is ever upscaled, and a small upload still has its full-size copy.
 */
export function variantWidths(originalWidth: number): number[] {
  const widths: number[] = STANDARD_WIDTHS.filter((width) => width < originalWidth);
  const widest = STANDARD_WIDTHS[STANDARD_WIDTHS.length - 1];
  if (originalWidth <= widest) widths.push(originalWidth);
  return widths;
}
