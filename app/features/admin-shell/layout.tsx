import { Form, Outlet, useNavigation } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The loader is what makes client-side navigations call the server, so the
// middleware checks the user on those too (React Router middleware docs).
export function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(userContext) };
}

const ROLE_NAMES = { admin: "Admin", editor: "Editor", author: "Author" } as const;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.state === "submitting" && navigation.formAction === "/admin/logout";

  return (
    <div className={styles.admin}>
      <aside className={styles.sidebar}>
        {/* The site's own title and logo arrive with site settings (item 7). */}
        <div className={styles.site}>
          Habre CMS
          <a href="/">View site ↗</a>
        </div>
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
