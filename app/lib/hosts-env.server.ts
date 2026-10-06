import { z } from "zod";

// The two origins the app is served from (item 16a). Kept apart from
// env.server.ts, which parses process.env when imported, so node --test can
// exercise these rules. env.server.ts spreads the fields.

// z.url has already accepted the string, so new URL cannot throw here.
function isBareOrigin(value: string): boolean {
  const url = new URL(value);
  return url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
}

export const hostsEnvFields = {
  // The platform's origin (sign-in, signup, admin): checked against the Origin
  // of state-changing requests, and https here is what makes the session
  // cookie Secure.
  PLATFORM_URL: z.url({ protocol: /^https?$/ }),
  // The sites domain's origin. A site's origin is its scheme, `<address>.`,
  // then this host, so it must be a bare origin.
  SITES_URL: z.url({ protocol: /^https?$/ }).refine(isBareOrigin, {
    message: "SITES_URL must be an origin with no path, query, fragment or credentials",
  }),
};

export const hostsEnvSchema = z.object(hostsEnvFields);
