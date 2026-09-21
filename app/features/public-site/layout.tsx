import { isRouteErrorResponse, Link, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

/**
 * Header and footer shared by every public page, including the 404 below -
 * an `ErrorBoundary` replaces its route's own component entirely (React
 * Router's error-boundary docs), so without this shared shell a 404 would
 * lose the chrome around it rather than sit inside it (item 4b's D-5).
 */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* The site's own title and logo arrive with site settings (item 7) -
              D-2, mirrors the admin shell's own pre-nav placeholder. */}
          <Link className={styles.brand} to="/">
            Habre CMS
          </Link>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>Habre CMS</span>
        </div>
      </footer>
    </>
  );
}

export default function PublicLayout() {
  return (
    <Chrome>
      <Outlet />
    </Chrome>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  // Matches root.tsx's own ErrorBoundary (F-66): without this, a genuine bug
  // in a public loader hit this boundary first - "closest boundary renders" -
  // and root's dev-mode message and stack trace never got a chance to show.
  const devDetail =
    !isNotFound && import.meta.env.DEV && error instanceof Error ? error : undefined;
  return (
    <Chrome>
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
