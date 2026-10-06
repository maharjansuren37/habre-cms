/** Ports of the three web servers `playwright.config.ts` starts, in one place (F-23). */
export const PORT = 3100;
// A second server started as if it were behind Caddy: its PLATFORM_URL is https,
// so a request must carry X-Forwarded-Proto: https to look same-origin (F-21).
export const PROXIED_PORT = 3101;
// A third server with signup and email off (SIGNUP_MODE=off, no SMTP_URL). The
// name is from item 16a's predecessor, when it was the host-split server.
export const HOST_SPLIT_PORT = 3102;
