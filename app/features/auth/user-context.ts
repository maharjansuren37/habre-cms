import { createContext } from "react-router";
import type { SessionUser } from "./session-check.ts";

/**
 * The logged-in user, set by `requireUser` on every admin request. No default:
 * reading it outside the protected layout throws instead of returning nobody.
 */
export const userContext = createContext<SessionUser>();
