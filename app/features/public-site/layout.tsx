import { isRouteErrorResponse, Link, Outlet } from "react-router";
import { brandCustomProperties } from "#app/features/brand/brand-colours.ts";
import { findPublishedPageSlugs } from "#app/features/content/entries.server.ts";
import { getSiteSettings, type SiteSettings } from "#app/features/settings/settings.server.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import { env } from "#app/lib/env.server.ts";
import { nonceContext } from "#app/lib/nonce-context.ts";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";
import { FALLBACK_SITE_TITLE, publicTitle } from "./public-title.ts";

export type NavLink = { label: string; href: string };

/**
 * The saved navigation, resolved to real hrefs: a `url` item passes through
 * as-is, a `pageId` item becomes `/${slug}` if its page is currently
 * published, or is silently dropped otherwise (deleted or unpublished) - the
 * same degrade-silently rule an image block's dangling `mediaId` already
 * follows (D61), not a new one invented for this table.
 */
async function resolveNavigation(
  siteId: string,
  items: SiteSettings["navigation"],
): Promise<NavLink[]> {
  const pageIds = items.flatMap((item) => ("pageId" in item ? [item.pageId] : []));
  const published = await findPublishedPageSlugs(siteId, pageIds);
  const slugById = new Map(published.map((page) => [page.id, page.slug]));
  return items.flatMap((item) => {
    if ("url" in item) return [{ label: item.label, href: item.url }];
    const slug = slugById.get(item.pageId);
    return slug ? [{ label: item.label, href: `/${slug}` }] : [];
  });
}

/**
 * The title an error page gets. React Router cuts `matches` off at the
 * boundary that renders - this layout's - so a child's own `meta` never runs
 * for a 404 and, without this, the page had no `<title>` at all (F-116).
 * Every child route replaces it: the leaf's meta wins. Worded as the
 * ErrorBoundary below words its body.
 */
export function meta({ error, matches }: Route.MetaArgs) {
  if (!error) return [{ title: publicTitle(matches) }];
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  return [{ title: publicTitle(matches, isNotFound ? "Page not found" : "Something went wrong") }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { id: siteId, mainOrigin } = context.get(siteContext);
  const settings = await getSiteSettings(siteId, env.R2_PUBLIC_URL);
  const navLinks = await resolveNavigation(siteId, settings.navigation);
  // Only what the header, footer and head tags need (F-108); never the whole row.
  return {
    settings: { siteTitle: settings.siteTitle, logoUrl: settings.logoUrl },
    language: settings.language,
    siteDescription: settings.siteDescription,
    navLinks,
    mainOrigin,
    // The brand reaches the page as derived declarations only, never the stored
    // string (D171); the nonce is the one in this response's CSP header.
    nonce: context.get(nonceContext),
    brandCss: brandCustomProperties(settings.brandColor),
    stylePreset: settings.stylePreset,
  };
}

/**
 * Header and footer shared by every public page, including the 404 below -
 * an `ErrorBoundary` replaces its route's own component entirely (React
 * Router's error-boundary docs), so without this shared shell a 404 would
 * lose the chrome around it rather than sit inside it (item 4b's D-5).
 */
export function Chrome({
  settings,
  navLinks,
  homeHref = "/",
  children,
}: {
  settings: Pick<SiteSettings, "siteTitle" | "logoUrl">;
  navLinks: NavLink[];
  /** Where the logo and name lead: `/`, or the preview's home (item 18b4b). */
  homeHref?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={settings.logoUrl ? styles.brand : `${styles.brand} ${styles.wordmark}`}
            to={homeHref}
          >
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
  // only missing if this loader itself is what failed, which a primary-key
  // read and the navigation lookup practically never do.
  const settings = loaderData?.settings ?? {
    siteTitle: FALLBACK_SITE_TITLE,
    logoUrl: null,
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
