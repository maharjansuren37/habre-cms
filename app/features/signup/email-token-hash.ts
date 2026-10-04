import { createHash } from "node:crypto";

/** SHA-256 hex: the only form of an emailed token that is stored. */
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
