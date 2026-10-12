import { storageUpgradeSentence, type UpgradeHint } from "#app/features/plans/upgrade-hint.ts";

/**
 * The most pixels an upload may decode to. sharp's own default (268 MP) would
 * need over 1 GB on the 954 MB server; 40 MP covers phones and most cameras.
 * A default, not a product limit - raise it with the server (D174).
 */
export const MAX_INPUT_PIXELS = 40_000_000;

export const UNREADABLE_MESSAGE =
  "This image could not be read. Try saving it again as a JPEG or PNG.";

export function tooLargeMessage(maxPixels: number): string {
  return `This image is larger than ${maxPixels / 1_000_000} megapixels. Resize it and try again.`;
}

/** The storage refusal; `limit` is formatStorageLimit's text, `hint` says how to get more (F-408). */
export function storageRefusalMessage(limit: string, hint: UpgradeHint): string {
  return `This image would take your site past its ${limit} of storage. Delete images you no longer use, then try again.${storageUpgradeSentence(hint)}`;
}
