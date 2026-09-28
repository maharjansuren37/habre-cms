import { isRouteErrorResponse, Link, Outlet } from "react-router";
import { findPublishedPageSlugs } from "#app/features/content/entries.server.ts";
import { getSiteSettings, type SiteSettings } from "#app/features/settings/settings.server.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

type NavLink = { label: string; href: string };

/**
 * The saved navigation, resolved to real hrefs: a `url` item passes through
 * as-is, a `pageId` item becomes `/${slug}` if its page is currently
 * published, or is silently dropped otherwise (deleted or unpublished) - the
 * same degrade-silently rule an image block's dangling `mediaId` already
 * follows (D61), not a new one invented for this table.
 */
async function resolveNavigation(items: SiteSettings["navigation"]): Promise<NavLink[]> {
  const pageIds = items.flatMap((item) => ("pageId" in item ? [item.pageId] : []));
  const published = await findPublishedPageSlugs(pageIds);
  const slugById = new Map(published.map((page) => [page.id, page.slug]));
  return items.flatMap((item) => {
    if ("url" in item) return [{ label: item.label, href: item.url }];
    const slug = slugById.get(item.pageId);
    return slug ? [{ label: item.label, href: `/${slug}` }] : [];
  });
}

export async function loader() {
  const settings = await getSiteSettings(env.R2_PUBLIC_URL);
  const navLinks = await resolveNavigation(settings.navigation);
  return { settings, navLinks };
}

/**
 * Header and footer shared by every public page, including the 404 below -
 * an `ErrorBoundary` replaces its route's own component entirely (React
 * Router's error-boundary docs), so without this shared shell a 404 would
 * lose the chrome around it rather than sit inside it (item 4b's D-5).
 */
function Chrome({
  settings,
  navLinks,
  children,
}: {
  settings: SiteSettings;
  navLinks: NavLink[];
  children: React.ReactNode;
}) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to="/">
            {settings.logoUrl && <img src={settings.logoUrl} alt="" className={styles.logo} />}
            {settings.siteTitle}
          </Link>
          {navLinks.length > 0 && (
            <nav aria-label="Site">
              <ul className={styles.navList}>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    {/* Plain <a>, not <Link> - a page item's href is a known
                        internal path, but a URL item's is whatever the admin
                        typed (external, mailto:, a fragment), and this list
                        mixes both without keeping the distinction around. */}
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>{settings.siteTitle}</span>
        </div>
      </footer>
    </>
  );
}

export default function PublicLayout({ loaderData }: Route.ComponentProps) {
  return (
    <Chrome settings={loaderData.settings} navLinks={loaderData.navLinks}>
      <Outlet />
    </Chrome>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  // Matches root.tsx's own ErrorBoundary (F-66): without this, a genuine bug
  // in a public loader hit this boundary first - "closest boundary renders" -
  // and root's dev-mode message and stack trace never got a chance to show.
  const devDetail =
    !isNotFound && import.meta.env.DEV && error instanceof Error ? error : undefined;
  // This layout's own loader still runs and succeeds alongside a child
  // throwing (React Router's loaders-run-in-parallel model) - loaderData is
  // only missing if this loader itself is what failed, which reaching for
  // env.PUBLIC_URL and a primary-key read practically never does.
  const settings = loaderData?.settings ?? {
    siteTitle: "Habre CMS",
    logoMediaId: null,
    logoUrl: null,
    navigation: [],
    homePageId: null,
  };
  const navLinks = loaderData?.navLinks ?? [];
  return (
    <Chrome settings={settings} navLinks={navLinks}>
      <main className={styles.notFound}>
        <p>{isNotFound ? "Page not found." : (devDetail?.message ?? "Something went wrong.")}</p>
        {devDetail?.stack && (
          <pre className={styles.stack}>
            <code>{devDetail.stack}</code>
          </pre>
        )}
      </main>
    </Chrome>
  );
}
