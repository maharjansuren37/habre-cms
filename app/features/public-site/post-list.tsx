import { Link } from "react-router";
import type { PublicPostSummary } from "#app/features/content/entries.server.ts";
import styles from "./post-list.module.css";

// A blog index, not a paginated archive - item 4b's D-1. Revisit if the
// quality bar's "a few thousand entries" ever becomes "read every day".
export const POST_LIMIT = 10;

/** The latest-posts list at `/posts` - `/` never shows it (item 9's D-12). */
export function PostList({ posts }: { posts: PublicPostSummary[] }) {
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
