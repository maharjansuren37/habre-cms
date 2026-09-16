import { createRequestListener } from "@remix-run/node-fetch-server";
import { createRequestHandler } from "react-router";
// Imported for its startup check: the server refuses to start misconfigured.
import "#app/lib/env.server.ts";

const handleRequest = createRequestHandler(() => import("virtual:react-router/server-build"));

// Built here rather than with `@react-router/node`'s createRequestListener, which
// is the same two calls but passes no options through - and `trustProxy` is the
// one we need. Caddy terminates HTTPS and proxies over plain http on 127.0.0.1,
// so without it the app reads its own origin as `http://` and React Router
// refuses every form post a browser makes from `https://` (F-21).
// Safe because nothing but Caddy can reach this: it listens on 127.0.0.1 and
// port 3000 is closed in both firewalls.
// The second argument the listener passes is the client address, not React
// Router's load context, so the handler is called with the request alone.
export const app = createRequestListener((request) => handleRequest(request), { trustProxy: true });
