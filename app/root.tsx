import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { env } from "#app/lib/env.server.ts";
import { isAllowedRequest } from "#app/lib/same-origin.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";

import type { Route } from "./+types/root";
import "./app.css";

// On the root route so every action, now and in later items, is covered
// without having to remember it.
export const middleware: Route.MiddlewareFunction[] = [
  function refuseCrossSiteRequests({ request }) {
    const appOrigin = new URL(env.APP_URL).origin;
    if (!isAllowedRequest(request.method, request.headers, appOrigin)) {
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
