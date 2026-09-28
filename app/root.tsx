import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { env } from "#app/lib/env.server.ts";
import { resolveHostRouting } from "#app/lib/host-routing.ts";
import { isAllowedRequest } from "#app/lib/same-origin.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";

import type { Route } from "./+types/root";
import "./app.css";

// On the root route so every action, now and in later items, is covered
// without having to remember it.
export const middleware: Route.MiddlewareFunction[] = [
  // Ahead of every other check (D22): an admin path on the wrong host, or the
  // wrong host entirely, is resolved before touching auth, CSRF or a loader.
  // `url`, not `request.url`: on a client-side navigation the request is for
  // `/admin.data`, which is not an admin path; `url` has the `.data` removed.
  function routeByHost({ request, url }) {
    const publicUrl = new URL(env.PUBLIC_URL);
    const adminUrl = new URL(env.ADMIN_URL);
    const decision = resolveHostRouting({
      method: request.method,
      pathname: url.pathname,
      search: url.search,
      requestHost: url.host,
      publicHost: publicUrl.host,
      adminHost: adminUrl.host,
      publicOrigin: publicUrl.origin,
      adminOrigin: adminUrl.origin,
    });
    if (decision.kind === "redirect") throw redirect(decision.to);
    if (decision.kind === "not-found") {
      // Logged, like the cross-site refusal below (F-70). A host matching
      // neither should be unreachable behind Caddy, so seeing one means the
      // network assumption behind D22 has broken.
      logSecurityEvent({
        event: "request_refused",
        reason: "wrong_host",
        method: request.method,
        path: url.pathname,
        host: url.host,
        ip: clientIp(request.headers),
      });
      throw data("Not Found", { status: 404 });
    }
  },
  function refuseCrossSiteRequests({ request }) {
    const adminOrigin = new URL(env.ADMIN_URL).origin;
    if (!isAllowedRequest(request.method, request.headers, adminOrigin)) {
      logSecurityEvent({
        event: "request_refused",
        reason: "cross_site",
        method: request.method,
        path: new URL(request.url).pathname,
        ip: clientIp(request.headers),
      });
      throw data("Cross-site request refused", { status: 403 });
    }
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
