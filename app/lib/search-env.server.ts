import { z } from "zod";

// The search-engine switch. Kept apart from env.server.ts, which parses
// process.env when imported, so node --test can exercise it.

export const searchEnvFields = {
  // off: robots.txt disallows everything on every host and every response carries
  // X-Robots-Tag: noindex, nofollow. A blank variable counts as unset (on).
  SEARCH_INDEXING: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["on", "off"]).default("on"),
  ),
};
