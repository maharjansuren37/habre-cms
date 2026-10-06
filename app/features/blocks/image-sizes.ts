/**
 * The `sizes` attribute for an image in a section of 1-3 columns (item 17b):
 * how wide the browser will draw it, so it can pick a `srcset` candidate
 * before the page's CSS has laid anything out.
 *
 * Everything is `rem` and `vw` - a `ch` in `sizes` resolves against the
 * browser's default font, not the article's. The figures come from the public
 * site's tokens (`app/app.css`, `post.module.css`, `page-body.module.css`,
 * `content.module.css`):
 *
 * - The reading column is `--size-measure` = 68ch at `--text-lg` (19px) in
 *   Inter. Measured in Chromium on 2026-10-07 (published page, 1280 px
 *   window): 816 px wide = 51rem. (The article's max-width is that plus
 *   `--space-5` * 2 of padding: 51rem + 3rem = 54rem.)
 * - Below 54rem of viewport the column is the viewport less the two gutters:
 *   100vw - 3rem.
 * - The columns stack when the document's own width is under 40rem - a
 *   container query on that same column. The column is 100vw - 3rem, so that
 *   is a viewport under 43rem.
 * - Side by side, N columns share the width less (N - 1) gaps of `--space-6`
 *   = 2rem: (W - 2(N-1)rem) / N. At 51rem: 2 columns 24.5rem, 3 columns
 *   (51 - 4) / 3 = 15.67rem. Between 43rem and 54rem: W = 100vw - 3rem.
 *
 * A section's own padding (the band background) is not counted; it only makes
 * the estimate a little wide.
 */
const READING_COLUMN_REM = 51;
const GUTTERS_REM = 3;
const GAP_REM = 2;
const STACKED_BELOW_VIEWPORT_REM = 40 + GUTTERS_REM;
const FULL_COLUMN_FROM_VIEWPORT_REM = READING_COLUMN_REM + GUTTERS_REM;

export function imageSizes(columns: number): string {
  const narrow = `(max-width: ${FULL_COLUMN_FROM_VIEWPORT_REM}rem)`;
  if (columns <= 1) {
    return `${narrow} calc(100vw - ${GUTTERS_REM}rem), ${READING_COLUMN_REM}rem`;
  }
  const gaps = GAP_REM * (columns - 1);
  const wide = Math.round(((READING_COLUMN_REM - gaps) / columns) * 100) / 100;
  return [
    `(max-width: ${STACKED_BELOW_VIEWPORT_REM}rem) calc(100vw - ${GUTTERS_REM}rem)`,
    `${narrow} calc((100vw - ${GUTTERS_REM + gaps}rem) / ${columns})`,
    `${wide}rem`,
  ].join(", ");
}
