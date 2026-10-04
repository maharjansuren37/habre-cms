// The pure parts of a site's storage limit (item 15d): fitting a file, wording
// the amounts, and the summary the Media screen shows. MB is 1,048,576 bytes,
// the same unit as the upload cap.

const MB = 1024 * 1024;
const GB = 1024 * MB;

export type StorageSummary = {
  usedText: string;
  limitText: string | null;
  value: number;
  max: number | null;
  isFull: boolean;
};

export function fitsStorage(used: number, fileBytes: number, limit: number | null): boolean {
  return limit === null || used + fileBytes <= limit;
}

// One wording, rounded either way: whole MB, then GB to one decimal with a
// trailing ".0" dropped.
function formatAmount(bytes: number, round: (value: number) => number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < MB) return "less than 1 MB";
  if (bytes < GB) return `${round(bytes / MB)} MB`;
  const tenths = round((bytes * 10) / GB);
  return tenths % 10 === 0 ? `${tenths / 10} GB` : `${Math.floor(tenths / 10)}.${tenths % 10} GB`;
}

// Usage rounds down, so it never reads as the whole limit before it is.
export function formatStorage(bytes: number): string {
  return formatAmount(bytes, Math.floor);
}

// The limit rounds up, so usage below it never reads as equal to it (F-249).
export function formatStorageLimit(bytes: number): string {
  return formatAmount(bytes, Math.ceil);
}

export function storageSummary(used: number, limit: number | null): StorageSummary {
  const isFull = limit !== null && used >= limit;
  return {
    // A full site rounds its usage up like the limit, so it never reads as
    // below the limit under the "used all of its storage" line (F-250).
    usedText: isFull ? formatStorageLimit(used) : formatStorage(used),
    limitText: limit === null ? null : formatStorageLimit(limit),
    value: used,
    max: limit,
    isFull,
  };
}
