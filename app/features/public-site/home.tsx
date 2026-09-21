import { Link } from "react-router";
import { listPublishedPosts } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/home";
import styles from "./home.module.css";

// A blog index, not a paginated archive - item 4b's D-1. Revisit if the
// quality bar's "a few thousand entries" ever becomes "read every day".
const POST_LIMIT = 10;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Habre CMS" }];
}

export async function loader() {
  const posts = await listPublishedPosts(POST_LIMIT);
  return { posts };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  return (
    <main className={styles.home}>
      {posts.length === 0 ? (
        <p className={styles.empty}>Nothing has been published yet.</p>
      ) : (
        <ul className={styles.list}>
          {posts.map((post) => (
            <li key={post.slug}>
              <Link to={`/posts/${post.slug}`}>{post.title}</Link>
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {formatDate(post.publishedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// UTC, explicitly - item 4b's D-4. The admin list's own date formatter has no
// timezone (F-55, a server/client mismatch on record); this does not repeat it.
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
