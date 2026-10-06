import { buildMediaUrl } from "./media-url.ts";

/** What a media row's objects are worked out from. */
export type MediaObjectRow = { storageKey: string; variantWidths: number[] | null };

export type MediaSources = {
  /** The image shown at its natural size: the widest stored size up to 1600. */
  src: string;
  /** Every size with its `w` descriptor, or null when there is only one object. */
  srcset: string | null;
  /** The small fixed size for grids and pickers. */
  thumbnail: string;
  /** The share image: the social JPEG, or the one object for an unresized row. */
  social: string;
};

// The widest size `src` may be (D174): a page rarely needs more than this at
// its natural size, and the full set stays in `srcset`.
const MAX_SRC_WIDTH = 1600;
const THUMBNAIL_WIDTH = 480;

/**
 * Item 17b's layout. A resized upload owns a directory,
 * `sites/<siteId>/<uuid>/`, holding `<width>.webp` for each size and
 * `social.jpg`. `storage_key` is the widest WebP, so the directory is the key
 * up to its last slash. `null` (not yet optimised) and `[]` (stored as
 * uploaded) rows keep the one flat object under `storage_key`.
 */
export function webpKey(directory: string, width: number): string {
  return `${directory}${width}.webp`;
}

export function socialKey(directory: string): string {
  return `${directory}social.jpg`;
}

function isResized(row: MediaObjectRow): row is { storageKey: string; variantWidths: number[] } {
  return row.variantWidths !== null && row.variantWidths.length > 0;
}

function directoryOf(storageKey: string): string {
  return storageKey.slice(0, storageKey.lastIndexOf("/") + 1);
}

/** Every R2 key the row owns - what deleting the row must remove. */
export function mediaObjectKeys(row: MediaObjectRow): string[] {
  if (!isResized(row)) return [row.storageKey];
  const directory = directoryOf(row.storageKey);
  return [...row.variantWidths.map((width) => webpKey(directory, width)), socialKey(directory)];
}

/** The only place, besides `buildMediaUrl`, where a row's keys become URLs. */
export function mediaSources(publicUrl: string, row: MediaObjectRow): MediaSources {
  if (!isResized(row)) {
    const url = buildMediaUrl(publicUrl, row.storageKey);
    return { src: url, srcset: null, thumbnail: url, social: url };
  }
  const directory = directoryOf(row.storageKey);
  const widths = [...row.variantWidths].sort((a, b) => a - b);
  const url = (width: number) => buildMediaUrl(publicUrl, webpKey(directory, width));
  const srcWidth = widths.findLast((width) => width <= MAX_SRC_WIDTH) ?? widths[0];
  const thumbnailWidth = widths.includes(THUMBNAIL_WIDTH) ? THUMBNAIL_WIDTH : widths[0];
  return {
    src: url(srcWidth),
    srcset: widths.map((width) => `${url(width)} ${width}w`).join(", "),
    thumbnail: url(thumbnailWidth),
    social: buildMediaUrl(publicUrl, socialKey(directory)),
  };
}
