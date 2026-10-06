/** Ports of the three web servers `playwright.config.ts` starts, in one place (F-23). */
export const PORT = 3100;
// A second server started as if it were behind Caddy: its PLATFORM_URL is https,
// so a request must carry X-Forwarded-Proto: https to look same-origin (F-21).
export const PROXIED_PORT = 3101;
// A third server with genuinely different SITES_URL/PLATFORM_URL hosts on one
// port (D22's own answer to "browser tests need two local hostnames") - the
// only way to exercise app/lib/host-routing.ts's redirects and 404s for real.
export const HOST_SPLIT_PORT = 3102;
