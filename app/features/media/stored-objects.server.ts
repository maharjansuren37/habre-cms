import { socialKey, webpKey } from "./media-objects.ts";
import type { EncodedImage } from "./optimise-image.server.ts";

export type StoredObject = { key: string; bytes: Buffer; contentType: string };

export type ResizedObjects = {
  /** Every object to write: each WebP size ascending, then the social JPEG. */
  objects: StoredObject[];
  /** `storage_key`: the widest WebP. */
  widestKey: string;
  width: number;
  height: number;
  variantWidths: number[];
  /** `byte_size`: the sum of every object. */
  storedBytes: number;
};

/**
 * The objects, key and row fields of a resized upload (item 17b), shared by
 * the Media upload and `optimise-media` so both store the same shape.
 */
export function resizedObjects(
  directory: string,
  sizes: EncodedImage[],
  social: EncodedImage,
): ResizedObjects {
  const objects: StoredObject[] = [
    ...sizes.map((size) => ({
      key: webpKey(directory, size.width),
      bytes: size.bytes,
      contentType: "image/webp",
    })),
    { key: socialKey(directory), bytes: social.bytes, contentType: "image/jpeg" },
  ];
  const widest = sizes[sizes.length - 1];
  return {
    objects,
    widestKey: webpKey(directory, widest.width),
    width: widest.width,
    height: widest.height,
    variantWidths: sizes.map((size) => size.width),
    storedBytes: objects.reduce((sum, object) => sum + object.bytes.byteLength, 0),
  };
}
