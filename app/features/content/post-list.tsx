import { Link, redirect } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import fieldStyles from "#app/lib/ui/field.module.css";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/post-list";
import { bannerRedirect, readBanner } from "./banner.ts";
import { type EntrySummary, listEntries } from "./entries.server.ts";
import styles from "./entry-list.module.css";
import {
  type EntryListQuery,
  type EntryStatus,
  entryListHref,
  entryListSearch,
  parseEntryListQuery,
} from "./entry-list-query.ts";

// "New post" is a navigation link, not a submit, but reads as the one primary
// button on the page - the Button component's own classes, not a second copy.
const NEW_POST_CLASS = `${buttonStyles.button} ${buttonStyles.primary}`;

const STATUS_LABEL = { draft: "Draft", published: "Published" } as const;
const TABS: { status: EntryStatus; label: string }[] = [
  { status: "all", label: "All" },
  { status: "draft", label: "Drafts" },
  { status: "published", label: "Published" },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Posts - Habre CMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = context.get(userContext);
  const url = new URL(request.url);
  const query = parseEntryListQuery(url);
  const list = await listEntries("post", actor, query);
  // Read once: a successful delete, publish or unpublish redirects here with
  // the title it acted on - the same `?deleted=` shape the other list reads.
  const banner = readBanner(url.searchParams);
  // A bookmarked or stale page past the real end would otherwise render a
  // false "No posts match" with no way back (F-56) - redirect to the last real
  // page instead, as media-list.tsx does. Deleting the only row on the last
  // page lands here too, so the banner rides along, parsed (F-136).
  if (query.page > list.totalPages && list.total > 0) {
    const last = { ...query, page: list.totalPages };
    throw banner
      ? bannerRedirect(banner.verb, banner.title, "/admin/posts", last)
      : redirect(entryListHref("/admin/posts", last));
  }
  return { list, query, banner };
}

function listHref(query: Parameters<typeof entryListHref>[1]): string {
  return entryListHref("/admin/posts", query);
}

export default function PostList({ loaderData }: Route.ComponentProps) {
  const { list, query, banner } = loaderData;
  const { totalPages } = list;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Posts</h1>
        <Link className={NEW_POST_CLASS} to="/admin/posts/new">
          <PlusIcon />
          New post
        </Link>
      </div>
      {banner && (
        <Message
          tone="success"
          title={`"${banner.title}" was ${banner.verb}.`}
          className={styles.banner}
        />
      )}
      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="Filter posts">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              to={listHref({ status: tab.status, q: query.q })}
              aria-current={query.status === tab.status ? "page" : undefined}
            >
              {tab.label}
              <span className={styles.count}>{list.counts[tab.status]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/posts" className={styles.search}>
          {query.status !== "all" && <input type="hidden" name="status" value={query.status} />}
          <label>
            <span className="visually-hidden">Search posts</span>
            <input
              className={fieldStyles.input}
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Search posts"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
      </div>
      {list.counts.all === 0 ? (
        <EmptyState />
      ) : list.entries.length === 0 ? (
        <p className={styles.noMatches}>No posts match this filter or search.</p>
      ) : (
        <>
          <PostTable posts={list.entries} query={query} />
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span>
                Page {query.page} of {totalPages}
              </span>
              <div className={styles.paginationLinks}>
                {query.page > 1 && (
                  <Link to={listHref({ ...query, page: query.page - 1 })}>← Previous</Link>
                )}
                {query.page < totalPages && (
                  <Link to={listHref({ ...query, page: query.page + 1 })}>Next →</Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PostTable({ posts, query }: { posts: EntrySummary[]; query: EntryListQuery }) {
  return (
    <div className={styles.list}>
      <table>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col" className={styles.colStatus}>
              Status
            </th>
            <th scope="col" className={styles.colAuthor}>
              Author
            </th>
            <th scope="col" className={styles.colUpdated}>
              Last changed
            </th>
            <th scope="col" className={styles.colDelete}>
              <span className="visually-hidden">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>
                <Link className={styles.entryTitle} to={`/admin/posts/${post.id}`}>
                  {post.title}
                </Link>
                <span className={styles.entrySlug}>/posts/{post.slug}</span>
              </td>
              <td className={styles.colStatus}>
                <span className={[styles.badge, styles[post.status]].join(" ")}>
                  {STATUS_LABEL[post.status]}
                </span>
              </td>
              <td className={styles.colAuthor}>{post.authorName}</td>
              <td className={`${styles.colUpdated} ${styles.muted}`}>
                {formatUpdatedAt(post.updatedAt)}
              </td>
              <td className={styles.colDelete}>
                <Link
                  className={styles.deleteLink}
                  to={`/admin/posts/${post.id}/delete${entryListSearch(query)}`}
                >
                  Delete<span className="visually-hidden"> {post.title}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatUpdatedAt(updatedAt: Date): string {
  return new Date(updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EmptyState() {
  return (
    <section className={styles.empty} aria-labelledby="empty-title">
      <DocumentIcon />
      <h2 id="empty-title" className={styles.emptyTitle}>
        Write your first post
      </h2>
      <p className={styles.emptyText}>
        Posts are news and updates. Once published, they appear on your site’s home page with the
        newest first. Nothing is public until you press Publish.
      </p>
      <Link className={NEW_POST_CLASS} to="/admin/posts/new">
        <PlusIcon />
        New post
      </Link>
    </section>
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

function DocumentIcon() {
  return (
    <svg
      className={styles.emptyIcon}
      viewBox="0 0 24 24"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}
