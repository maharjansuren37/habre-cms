/**
 * CI has no Cloudflare R2 credentials, and must not have the development
 * bucket's (F-17). Tests that upload an image skip themselves when the run says
 * so: CI sets `E2E_SKIP_R2=1`, a laptop with a real `.env` does not, so all of
 * them still run locally. An explicit switch rather than detecting a missing
 * bucket, because a skip nobody chose is how coverage quietly disappears.
 */
export const skipWithoutStorage = process.env.E2E_SKIP_R2 === "1";

export const STORAGE_REASON = "needs real R2 storage (E2E_SKIP_R2=1)";
