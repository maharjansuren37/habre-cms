import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import type { loader as publicLayoutLoader } from "#app/features/public-site/layout.tsx";
import { findSiteByDomain, findSiteBySubdomain } from "#app/features/sites/find-site.server.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import { areaForPath } from "#app/lib/content-security-policy.ts";
import { env } from "#app/lib/env.server.ts";
import { classifyHost } from "#app/lib/host-routing.ts";
import { isAllowedRequest } from "#app/lib/same-origin.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { mainHost, mainOrigin } from "#app/lib/site-origin.ts";

import type { Route } from "./+types/root";
import "./app.css";

// The body of the 404 root middleware throws for a public path on the
// platform host, which Layout reads to leave the site look off (F-276).
const PLATFORM_NOT_FOUND = "Not Found on the platform";

// On the root route so every action, now and in later items, is covered
// without having to remember it.
export const middleware: Route.MiddlewareFunction[] = [
  // Ahead of every other check (item 16a, D153): the host decides whether this
  // is the platform or a site, and which site, before touching auth, CSRF or a
  // loader. A site's request gets `siteContext`; the platform's does not.
  // `url`, not `request.url`: on a client-side navigation the request is for
  // `/admin.data`, which is not an admin path; `url` has the `.data` removed.
  async function routeByHost({ request, url, context }) {
    const decision = classifyHost({
      method: request.method,
      pathname: url.pathname,
      search: url.search,
      requestHost: url.host,
      platformOrigin: new URL(env.PLATFORM_URL).origin,
      sitesOrigin: new URL(env.SITES_URL).origin,
    });
    if (decision.kind === "allow") return;
    if (decision.kind === "redirect") throw redirect(decision.to);

    // Logged, like the cross-site refusal below (F-70), but only a host outside
    // both domains: the wildcard sends every guessed name here, and an unknown
    // address under the sites domain is a normal 404.
    const refuse = (foreignHost: boolean, platformHost = false): never => {
      if (foreignHost) {
        logSecurityEvent({
          event: "request_refused",
          reason: "wrong_host",
          method: request.method,
          path: url.pathname,
          host: url.host,
          ip: clientIp(request.headers),
        });
      }
      // The marker tells Layout this 404 is the platform's (F-276).
      throw data(platformHost ? PLATFORM_NOT_FOUND : "Not Found", { status: 404 });
    };
    if (decision.kind === "not-found") {
      return refuse(decision.foreignHost, decision.platformHost);
    }

    const site =
      decision.kind === "subdomain"
        ? await findSiteBySubdomain(decision.label)
        : await findSiteByDomain(decision.host);
    // A domain that is not in site_domains is a host nothing here serves.
    if (!site) return refuse(decision.kind === "domain");

    // One main address per site (D173): any other host of it sends a reader
    // and a crawler there. Hosts compare without the scheme, which is Caddy's.
    const main = mainHost(site, env.SITES_URL);
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.host.toLowerCase() !== main
    ) {
      throw redirect(`${mainOrigin(site, env.SITES_URL)}${url.pathname}${url.search}`, 301);
    }
    context.set(siteContext, { ...site, mainOrigin: mainOrigin(site, env.SITES_URL) });
  },
  function refuseCrossSiteRequests({ request, url }) {
    const platformOrigin = new URL(env.PLATFORM_URL).origin;
    if (!isAllowedRequest(request.method, request.headers, platformOrigin)) {
      logSecurityEvent({
        event: "request_refused",
        reason: "cross_site",
        method: request.method,
        path: url.pathname,
        ip: clientIp(request.headers),
      });
      throw data("Cross-site request refused", { status: 403 });
    }
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // useLocation, not a loader: Layout also wraps the root ErrorBoundary.
  const { pathname } = useLocation();
  // A public path's 404 on the platform host is the platform's own page, not a
  // site's (F-276). Middleware refuses it before any loader runs, so the
  // marker on the error is the only thing that knows the host.
  const error = useRouteError();
  const onPlatform = isRouteErrorResponse(error) && error.data === PLATFORM_NOT_FOUND;
  const siteLook = areaForPath(pathname) === "public" && !onPlatform;
  // The public layout's loader runs beside a child's 404, so its data is here
  // for the public 404 too. Admin, platform and error pages outside a site stay `en`.
  const publicData = useRouteLoaderData<typeof publicLayoutLoader>("features/public-site/layout");
  const lang = siteLook ? (publicData?.language ?? "en") : "en";
  return (
    <html lang={lang} data-surface={siteLook ? "site" : undefined}>
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
