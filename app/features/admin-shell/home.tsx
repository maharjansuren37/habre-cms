import { userContext } from "#app/features/auth/user-context.ts";
import type { Route } from "./+types/home";
import styles from "./home.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin - Habre CMS" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const { name, role } = context.get(userContext);
  return { name, role };
}

// A placeholder until managing posts (item 3) makes /admin the posts list.
export default function AdminHome({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1 className={styles.title}>Hello, {loaderData.name}</h1>
      <p className={styles.lead}>You’re logged in as {loaderData.role}.</p>
    </>
  );
}
