import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { getSiteSettings } from "#app/features/settings/settings.server.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The loader is what makes client-side navigations call the server, so the
// middleware checks the user on those too (React Router middleware docs).
export async function loader({ context }: Route.LoaderArgs) {
  // "/" on this host redirects to /admin (D22), so the link has to be
  // absolute on the public host rather than the site-relative "/" it used
  // to be - env is server-only, so it crosses the loader boundary like `user`.
  const user = context.get(userContext);
  return {
    user,
    publicUrl: env.PUBLIC_URL,
    settings: await getSiteSettings(user.siteId, env.R2_PUBLIC_URL),
  };
}

const ROLE_NAMES = { admin: "Admin", editor: "Editor", author: "Author" } as const;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user, publicUrl, settings } = loaderData;
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.state === "submitting" && navigation.formAction === "/admin/logout";

  return (
    <div className={styles.admin}>
      <aside className={styles.sidebar}>
        <div className={styles.site}>
          <span className={styles.siteName}>
            {settings.logoUrl && <img src={settings.logoUrl} alt="" className={styles.siteLogo} />}
            {settings.siteTitle}
          </span>
          <a href={publicUrl}>View site ↗</a>
        </div>
        {/* Posts shipped in item 3, Media in item 5a, Pages in item 6a,
            Settings in item 7a, Users in item 8 - each added here in ship
            order (D35). Pages is editor/admin only and Settings and Users are
            admin only (requireRole), so a role that would get a 404 from the
            route never sees a link to it. */}
        <nav aria-label="Admin">
          <ul className={styles.nav}>
            <li>
              <NavLink to="/admin/posts">
                <PostsIcon />
                Posts
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/media">
                <MediaIcon />
                Media
              </NavLink>
            </li>
            {user.role !== "author" && (
              <li>
                <NavLink to="/admin/pages">
                  <PagesIcon />
                  Pages
                </NavLink>
              </li>
            )}
            {user.role === "admin" && (
              <li>
                <NavLink to="/admin/settings">
                  <SettingsIcon />
                  Settings
                </NavLink>
              </li>
            )}
            {user.role === "admin" && (
              <li>
                <NavLink to="/admin/users">
                  <UsersIcon />
                  Users
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className={styles.user}>
          <div>
            <p>{user.name}</p>
            <p className={styles.role}>{ROLE_NAMES[user.role]}</p>
          </div>
          <Form method="post" action="/admin/logout">
            <Button
              type="submit"
              variant="quiet"
              className={styles.logout}
              isPending={isLoggingOut}
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </Button>
          </Form>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

function PostsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

// A page laid out top to bottom, distinguishable from Posts' folded-corner
// document (page-list.tsx's own empty-state icon uses the same shape).
function PagesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
