import { Link } from "react-router";
import { requireProLevel } from "#app/features/auth/require-level.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import type { Route } from "./+types/user-list";
import styles from "./user-list.module.css";
import { listUsers, type Member } from "./users.server.ts";

// Admin only (project-plan.md's routes table); the nav hides the link too
// (admin-shell/layout.tsx) and a non-admin gets the same 404 an ownership
// refusal already gives (require-role.server.ts).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"]), requireProLevel()];

// "New user" is a navigation link, not a submit, but reads as the one primary
// button on the page - matching page-list.tsx's own "New page" pattern.
const NEW_USER_CLASS = `${buttonStyles.button} ${buttonStyles.primary}`;

const ROLE_LABEL = { admin: "Admin", editor: "Editor", author: "Author" } as const;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Users - Habre CMS" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { users: await listUsers(context.get(userContext).siteId) };
}

export default function UserList({ loaderData }: Route.ComponentProps) {
  const { users } = loaderData;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Users</h1>
        <Link className={NEW_USER_CLASS} to="/admin/users/new">
          <PlusIcon />
          New user
        </Link>
      </div>
      <UserTable users={users} />
    </>
  );
}

function UserTable({ users }: { users: Member[] }) {
  return (
    <div className={styles.list}>
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <Link className={styles.userName} to={`/admin/users/${user.id}`}>
                  {user.name}
                </Link>
              </td>
              <td className={styles.muted}>{user.email}</td>
              <td>{ROLE_LABEL[user.role]}</td>
              <td>
                <span
                  className={[
                    styles.badge,
                    user.deactivatedAt ? styles.deactivated : styles.active,
                  ].join(" ")}
                >
                  {user.deactivatedAt ? "Deactivated" : "Active"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
