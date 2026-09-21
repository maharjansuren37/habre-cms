import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The loader is what makes client-side navigations call the server, so the
// middleware checks the user on those too (React Router middleware docs).
export function loader({ context }: Route.LoaderArgs) {
  // "/" on this host redirects to /admin (D22), so the link has to be
  // absolute on the public host rather than the site-relative "/" it used
  // to be - env is server-only, so it crosses the loader boundary like `user`.
  return { user: context.get(userContext), publicUrl: env.PUBLIC_URL };
}

const ROLE_NAMES = { admin: "Admin", editor: "Editor", author: "Author" } as const;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user, publicUrl } = loaderData;
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.state === "submitting" && navigation.formAction === "/admin/logout";

  return (
    <div className={styles.admin}>
      <aside className={styles.sidebar}>
        {/* The site's own title and logo arrive with site settings (item 7). */}
        <div className={styles.site}>
          Habre CMS
          <a href={publicUrl}>View site ↗</a>
        </div>
        {/* The first section to ship (item 3); Pages, Media, Settings and Users
            each add their own entry when they ship, rather than appearing now
            as dead links to routes that do not exist yet. */}
        <nav aria-label="Admin">
          <ul className={styles.nav}>
            <li>
              <NavLink to="/admin/posts">
                <PostsIcon />
                Posts
              </NavLink>
            </li>
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
