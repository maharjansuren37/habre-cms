import { env } from "#app/lib/env.server.ts";
import { createContactTokens } from "./contact-token-core.server.ts";

// Bound to JWT_SECRET. The core takes the secret so unit tests need no
// environment; this file is what routes import.
const tokens = createContactTokens(env.JWT_SECRET);

export const issueContactToken = tokens.issueContactToken;
export const checkContactToken = tokens.checkContactToken;
export type { ContactTokenCheck } from "./contact-token-core.server.ts";
