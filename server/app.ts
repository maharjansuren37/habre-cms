import { randomBytes } from "node:crypto";
import { createRequestListener } from "@remix-run/node-fetch-server";
import { createRequestHandler, RouterContextProvider } from "react-router";
// Imported for its startup check: the server refuses to start misconfigured.
import "#app/lib/env.server.ts";
import { failInterruptedRuns } from "#app/features/ai/runs.server.ts";
import { startOwnDomainChecker } from "#app/features/own-domain/own-domain-checker.server.ts";
import { nonceContext } from "#app/lib/nonce-context.ts";

// Runs a restart interrupted are marked failed, once when this module loads. In
// production that is once per process; in development Vite reloads this module on
// edits, so it can run again, which is harmless. Not awaited: never on the request
// path, and a database problem is logged rather than stopping startup.
void failInterruptedRuns();

// Re-checks waiting own domains by itself (item 21c). One timer per process, kept
// across Vite's dev reloads, and not started over http (SITES_URL), where own
// domains are not served. Not awaited, and a failed tick is logged, not thrown.
void startOwnDomainChecker();

const handleRequest = createRequestHandler(() => import("virtual:react-router/server-build"));

// Built here rather than with `@react-router/node`'s createRequestListener, which
// is the same two calls but passes no options through - and `trustProxy` is the
// one we need. Caddy terminates HTTPS and proxies over plain http on 127.0.0.1,
// so without it the app reads its own origin as `http://` and React Router
// refuses every form post a browser makes from `https://` (F-21).
// Safe because nothing but Caddy can reach this: it listens on 127.0.0.1 and
// port 3000 is closed in both firewalls.
// The second argument the listener passes is the client address, not React
// Router's load context, so the load context is built here: a provider holding
// this request's CSP nonce, which React Router hands to middleware and loaders
// as `context` and to `entry.server.tsx`'s handleRequest as `loadContext`.
export const app = createRequestListener(
  (request) => {
    const loadContext = new RouterContextProvider();
    // One per response, never reused: it is what lets React Router's own inline
    // scripts and the brand `<style>` past the Content-Security-Policy (F-100).
    loadContext.set(nonceContext, randomBytes(16).toString("base64"));
    return handleRequest(request, loadContext);
  },
  { trustProxy: true },
);
