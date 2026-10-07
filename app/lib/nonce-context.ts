import { createContext } from "react-router";

/**
 * This response's CSP nonce. `server/app.ts` makes one per request and hands
 * it to React Router as the load context; `entry.server.tsx` puts it in the
 * Content-Security-Policy header and the public layout's loader returns it so
 * the brand `<style>` can carry it (18a1).
 */
export const nonceContext = createContext<string>();
