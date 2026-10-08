import { isRouteErrorResponse, Outlet } from "react-router";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { brandCustomProperties } from "#app/features/brand/brand-colours.ts";
import { listPageSlugs } from "#app/features/content/entries.server.ts";
import publicLayoutStyles from "#app/features/public-site/layout.module.css";
import { Chrome, type NavLink } from "#app/features/public-site/layout.tsx";
import { getSiteSettings } from "#app/features/settings/settings.server.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { nonceContext } from "#app/lib/nonce-context.ts";
import { siteOrigin } from "#app/lib/site-origin.ts";
import type { Route } from "./+types/preview-layout";
import styles from "./preview.module.css";
import { previewHref } from "./preview-href.ts";

// Admins only, like /start: a signed-out visitor goes to sign in, an editor or
// author gets Not Found.
export const middleware: Route.MiddlewareFunction[] = [requireUser, requireRole(["admin"])];

// A child's own `meta` replaces this; it only titles the error page, which
// React Router cuts `matches` off for (as the public layout's does, F-116).
export function meta({ error }: Route.MetaArgs) {
  if (!error) return [];
  return [{ title: "Preview - Page not found" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const [settings, pages, { subdomain }] = await Promise.all([
    getSiteSettings(siteId, env.R2_PUBLIC_URL),
    listPageSlugs(siteId),
    findMemberSite(siteId),
  ]);
  const origin = siteOrigin(subdomain, env.SITES_URL);
  const slugById = new Map(pages.map((page) => [page.id, page.slug]));
  const homeSlug = settings.homePageId ? (slugById.get(settings.homePageId) ?? null) : null;
  const links = {
    pageSlugs: new Set(pages.map((page) => page.slug)),
    homeSlug,
    siteOrigin: origin,
  };
  // The saved menu over every page, drafts included: a page the person has not
  // published yet is exactly what they are here to see.
  const navLinks: NavLink[] = settings.navigation.flatMap((item) => {
    if ("url" in item) return [{ label: item.label, href: previewHref(item.url, links) }];
    const slug = slugById.get(item.pageId);
    return slug ? [{ label: item.label, href: previewHref(`/${slug}`, links) }] : [];
  });
  return {
    settings: { siteTitle: settings.siteTitle, logoUrl: settings.logoUrl },
    language: settings.language,
    stylePreset: settings.stylePreset,
    // Derived declarations only, never the stored string (D171); the nonce is
    // the one in this response's CSP header.
    brandCss: brandCustomProperties(settings.brandColor),
    nonce: context.get(nonceContext),
    navLinks,
    pageSlugs: [...links.pageSlugs],
    homeSlug,
    siteOrigin: origin,
  };
}

function PreviewBar() {
  return (
    <aside aria-label="Preview" lang="en" className={styles.bar}>
      <div className={styles.barInner}>
        <p className={styles.text}>Preview - nobody else can see this until you publish.</p>
        {/* Plain <a>: the admin reloads with its own look and policy. */}
        <a className={styles.back} href="/admin">
          Back to Home
        </a>
      </div>
    </aside>
  );
}

export default function PreviewLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PreviewBar />
      <Chrome
        settings={loaderData.settings}
        navLinks={loaderData.navLinks}
        homeHref="/admin/preview"
      >
        <Outlet />
      </Chrome>
    </>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  const message =
    isRouteErrorResponse(error) && error.status === 404
      ? "Page not found."
      : "Something went wrong.";
  // The layout's own loader still runs beside a child throwing. It has no data
  // when the middleware refused the visit (an editor, an author) or when the
  // loader itself failed: then there is no preview to show, only the message.
  if (!loaderData) {
    return (
      <main className={publicLayoutStyles.notFound}>
        <p>{message}</p>
      </main>
    );
  }
  return (
    <>
      <PreviewBar />
      <Chrome
        settings={loaderData.settings}
        navLinks={loaderData.navLinks}
        homeHref="/admin/preview"
      >
        <main className={publicLayoutStyles.notFound}>
          <p>{message}</p>
        </main>
      </Chrome>
    </>
  );
}
