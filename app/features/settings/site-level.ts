export type SiteLevel = "simple" | "pro";

/** A stored level is never trusted: anything but `pro` reads as Simple (D172). */
export function readSiteLevel(value: unknown): SiteLevel {
  return value === "pro" ? "pro" : "simple";
}
