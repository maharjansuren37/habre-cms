import sharp, { type Sharp } from "sharp";
import { variantWidths } from "./variant-widths.ts";

/**
 * The most pixels an upload may decode to. sharp's own default (268 MP) would
 * need over 1 GB on the 954 MB server; 40 MP covers phones and most cameras.
 * A default, not a product limit - raise it with the server (D174).
 */
export const MAX_INPUT_PIXELS = 40_000_000;

const WEBP_QUALITY = 80;
const JPEG_QUALITY = 80;
const SOCIAL_WIDTH = 1200;

export type EncodedImage = { width: number; height: number; bytes: Buffer };

export type OptimisedImage =
  | { kind: "resized"; sizes: EncodedImage[]; social: EncodedImage }
  | { kind: "as-uploaded" }
  | { kind: "unreadable" }
  | { kind: "too-large" };

// No cache: this process decodes a few large images, never the same one twice.
sharp.cache(false);

// One resize at a time in the process, so memory use stays bounded.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Turns an upload into its stored objects: WebP at each width from
 * `variantWidths` (ascending) and a social JPEG, all upright, in sRGB, with
 * every kind of metadata dropped. An animated GIF is left alone.
 */
export function optimiseImage(bytes: Buffer): Promise<OptimisedImage> {
  const run = queue.then(() => optimise(bytes));
  queue = run.catch(() => undefined);
  return run;
}

async function optimise(bytes: Buffer): Promise<OptimisedImage> {
  try {
    // Reading the header decodes no pixels, so this refuses a huge image cheaply.
    const info = await sharp(bytes, { animated: true }).metadata();
    const { width, height } = info.autoOrient;
    if (!width || !height) return { kind: "unreadable" };
    // Before the cap: an animated GIF's height is every frame stacked, and it is never decoded.
    if (info.format === "gif" && (info.pages ?? 1) > 1) return { kind: "as-uploaded" };
    if (width * height > MAX_INPUT_PIXELS) return { kind: "too-large" };

    const sizes: EncodedImage[] = [];
    for (const target of variantWidths(width)) {
      const { data, info: out } = await upright(bytes)
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      sizes.push({ width: out.width, height: out.height, bytes: data });
    }

    const { data, info: out } = await upright(bytes)
      .flatten({ background: "#ffffff" })
      .resize({ width: Math.min(SOCIAL_WIDTH, width), withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: false })
      .toBuffer({ resolveWithObject: true });
    return {
      kind: "resized",
      sizes,
      social: { width: out.width, height: out.height, bytes: data },
    };
  } catch (error) {
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      return { kind: "too-large" };
    }
    return { kind: "unreadable" };
  }
}

/**
 * Upright (by the camera's orientation) and in sRGB. sharp writes no metadata
 * unless asked, so EXIF, GPS, XMP, IPTC and the ICC profile are all dropped.
 */
function upright(bytes: Buffer): Sharp {
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient().toColourspace("srgb");
}
