import { z } from "zod";

// The two origins the app is served from (item 16a). Kept apart from
// env.server.ts, which parses process.env when imported, so node --test can
// exercise these rules. env.server.ts spreads the fields.

// A trailing dot is refused: host-routing drops it from the request's host, so
// a configured one would never match (F-280).
function isBareOrigin(value: string): boolean {
  // z.url's own issue does not stop the refine running (F-281): a value that is
  // not a URL at all passes here and is reported by z.url, naming the variable.
  const url = URL.parse(value);
  if (!url) return true;
  return (
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password &&
    !url.hostname.endsWith(".")
  );
}

export const hostsEnvFields = {
  // The platform's origin (sign-in, signup, admin): checked against the Origin
  // of state-changing requests, and https here is what makes the session
  // cookie Secure. Email links append paths to it, so it must be a bare origin.
  PLATFORM_URL: z.url({ protocol: /^https?$/ }).refine(isBareOrigin, {
    message:
      "PLATFORM_URL must be an origin with no path, query, fragment, credentials or trailing dot",
  }),
  // The sites domain's origin. A site's origin is its scheme, `<address>.`,
  // then this host, so it must be a bare origin.
  SITES_URL: z.url({ protocol: /^https?$/ }).refine(isBareOrigin, {
    message:
      "SITES_URL must be an origin with no path, query, fragment, credentials or trailing dot",
  }),
};

export const hostsEnvSchema = z.object(hostsEnvFields);
