import { isRouteErrorResponse, Link, Outlet } from "react-router";
import { getSiteSettings, type SiteSettings } from "#app/features/settings/settings.server.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

export async function loader() {
  return { settings: await getSiteSettings(env.R2_PUBLIC_URL) };
}

/**
 * Header and footer shared by every public page, including the 404 below -
 * an `ErrorBoundary` replaces its route's own component entirely (React
 * Router's error-boundary docs), so without this shared shell a 404 would
 * lose the chrome around it rather than sit inside it (item 4b's D-5).
 */
function Chrome({ settings, children }: { settings: SiteSettings; children: React.ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to="/">
            {settings.logoUrl && <img src={settings.logoUrl} alt="" className={styles.logo} />}
            {settings.siteTitle}
          </Link>
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
    <Chrome settings={loaderData.settings}>
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
  };
  return (
    <Chrome settings={settings}>
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
