/** The longer side an SVG logo is drawn to when it becomes a PNG (D167). */
export const LOGO_LONGER_SIDE = 1200;

export type Size = { width: number; height: number };

/** A plain number or one in px; anything else (%, em, auto) is not a size we can use. */
function pixels(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
  const number = match ? Number(match[1]) : 0;
  return number > 0 ? number : null;
}

function attribute(tag: string, name: string): string | undefined {
  return tag
    .match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
    ?.slice(1)
    .find(Boolean);
}

/**
 * The shape an SVG asks for, read from its root tag's text alone (never put into the page):
 * `width` and `height` when both are plain pixels, else the `viewBox`'s. Null when it gives
 * neither, and the caller falls back to what the browser measured.
 */
export function svgShape(svgText: string): Size | null {
  const tag = svgText.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const width = pixels(attribute(tag, "width"));
  const height = pixels(attribute(tag, "height"));
  if (width && height) return { width, height };
  const box = attribute(tag, "viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) return { width: box[2], height: box[3] };
  return null;
}

/** The shape scaled so its longer side is exactly `LOGO_LONGER_SIDE`, ratio kept. */
export function fitLongerSide(shape: Size): Size {
  const scale = LOGO_LONGER_SIDE / Math.max(shape.width, shape.height);
  return {
    width: Math.max(1, Math.round(shape.width * scale)),
    height: Math.max(1, Math.round(shape.height * scale)),
  };
}
