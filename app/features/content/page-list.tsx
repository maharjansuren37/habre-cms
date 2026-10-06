import { Link, redirect } from "react-router";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { DELETED_ACCOUNT } from "#app/lib/deleted-account.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import fieldStyles from "#app/lib/ui/field.module.css";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/page-list";
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

// Editor and admin only (project-plan.md's routes table); an author never
// reaches this loader, and the nav hides the link too (admin-shell/layout.tsx).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin", "editor"])];

// "New page" is a navigation link, not a submit, but reads as the one primary
// button on the page - the Button component's own classes, not a second copy.
const NEW_PAGE_CLASS = `${buttonStyles.button} ${buttonStyles.primary}`;

const STATUS_LABEL = { draft: "Draft", published: "Published" } as const;
const TABS: { status: EntryStatus; label: string }[] = [
  { status: "all", label: "All" },
  { status: "draft", label: "Drafts" },
  { status: "published", label: "Published" },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Pages - Habre CMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = context.get(userContext);
  const url = new URL(request.url);
  const query = parseEntryListQuery(url);
  const list = await listEntries(actor.siteId, "page", actor, query);
  // Read once: a successful delete, publish or unpublish redirects here with
  // the title it acted on - the same `?deleted=` shape the other list reads.
  const banner = readBanner(url.searchParams);
  // A bookmarked or stale page past the real end would otherwise render a
  // false "No pages match" with no way back (F-56) - redirect to the last real
  // page instead, as media-list.tsx does. Deleting the only row on the last
  // page lands here too, so the banner rides along, parsed (F-136).
  if (query.page > list.totalPages && list.total > 0) {
    const last = { ...query, page: list.totalPages };
    throw banner
      ? bannerRedirect(banner.verb, banner.title, "/admin/pages", last)
      : redirect(entryListHref("/admin/pages", last));
  }
  return { list, query, banner };
}

function listHref(query: Parameters<typeof entryListHref>[1]): string {
  return entryListHref("/admin/pages", query);
}

export default function PageList({ loaderData }: Route.ComponentProps) {
  const { list, query, banner } = loaderData;
  const { totalPages } = list;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Pages</h1>
        <Link className={NEW_PAGE_CLASS} to="/admin/pages/new">
          <PlusIcon />
          New page
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
        <nav className={styles.tabs} aria-label="Filter pages">
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
        <form method="get" action="/admin/pages" className={styles.search}>
          {query.status !== "all" && <input type="hidden" name="status" value={query.status} />}
          <label>
            <span className="visually-hidden">Search pages</span>
            <input
              className={fieldStyles.input}
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Search pages"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
      </div>
      {list.counts.all === 0 ? (
        <EmptyState />
      ) : list.entries.length === 0 ? (
        <p className={styles.noMatches}>No pages match this filter or search.</p>
      ) : (
        <>
          <PageTable pages={list.entries} query={query} />
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

function PageTable({ pages, query }: { pages: EntrySummary[]; query: EntryListQuery }) {
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
          {pages.map((page) => (
            <tr key={page.id}>
              <td>
                <Link className={styles.entryTitle} to={`/admin/pages/${page.id}`}>
                  {page.title}
                </Link>
                {/* A page is served at its own address off the site root, unlike
                    a post's /posts/ prefix (entries.server.ts's createDraft). */}
                <span className={styles.entrySlug}>/{page.slug}</span>
              </td>
              <td className={styles.colStatus}>
                <span className={[styles.badge, styles[page.status]].join(" ")}>
                  {STATUS_LABEL[page.status]}
                </span>
              </td>
              <td className={styles.colAuthor}>{page.authorName ?? DELETED_ACCOUNT}</td>
              <td className={`${styles.colUpdated} ${styles.muted}`}>
                {formatUpdatedAt(page.updatedAt)}
              </td>
              <td className={styles.colDelete}>
                <Link
                  className={styles.deleteLink}
                  to={`/admin/pages/${page.id}/delete${entryListSearch(query)}`}
                >
                  Delete<span className="visually-hidden"> {page.title}</span>
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
        Write your first page
      </h2>
      <p className={styles.emptyText}>
        Pages are for content that stays put - About, Contact, and the like. Each is reachable at
        its own address once published. Nothing is public until you press Publish.
      </p>
      <Link className={NEW_PAGE_CLASS} to="/admin/pages/new">
        <PlusIcon />
        New page
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

// A page laid out top to bottom, distinguishable from Posts' folded-corner
// document icon and Media's image frame (admin-shell/layout.tsx).
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
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
