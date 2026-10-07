import { Link, redirect } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import { listEntries } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/home";
import styles from "./home.module.css";

const STATUS_LABEL = { draft: "Draft", published: "Published" } as const;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Home - Habre CMS" }];
}

// Home is the admin's landing (item 18b4a). An editor or author has nothing
// here (its cards are admin content), so /admin keeps sending them to Posts.
// The role is the database's, from userContext (D6).
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user.role !== "admin") throw redirect("/admin/posts");
  // The first page of the list is the first 20 (PAGE_SIZE); `total` says
  // whether Pages holds more.
  const list = await listEntries(user.siteId, "page", user, { status: "all", q: "", page: 1 });
  return { pages: list.entries, total: list.total };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pages, total } = loaderData;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Home</h1>
      </div>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="pages-title">
          <h2 id="pages-title" className={styles.cardTitle}>
            Your pages
          </h2>
          {pages.length === 0 ? (
            <>
              <p>No pages yet.</p>
              <Link className={styles.add} to="/admin/pages/new">
                Add a page
              </Link>
            </>
          ) : (
            <>
              <ul className={styles.list}>
                {pages.map((page) => (
                  <li key={page.id}>
                    <span className={styles.pageTitle}>{page.title}</span>
                    <span className={`${styles.badge} ${styles[page.status]}`}>
                      {STATUS_LABEL[page.status]}
                    </span>
                    <Link to={`/admin/pages/${page.id}`}>
                      Edit<span className="visually-hidden"> {page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {total > pages.length && (
                <Link className={styles.more} to="/admin/pages">
                  All pages
                </Link>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
