import { Link, redirect } from "react-router";
import { allowanceSummary } from "#app/features/ai/allowance-summary.ts";
import { startOfUtcMonth } from "#app/features/ai/credits.ts";
import { runner } from "#app/features/ai/runner.server.ts";
import {
  appliedRunPageCount,
  findLatestFinishedRun,
  hasAppliedRun,
  runStore,
} from "#app/features/ai/runs.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { hasPublishedEntries, listEntries } from "#app/features/content/entries.server.ts";
import { storageUsed } from "#app/features/media/media.server.ts";
import { storageSummary } from "#app/features/media/storage-limit.ts";
import { startGate } from "#app/features/onboarding/start-gate.ts";
import { getSiteSettings } from "#app/features/settings/settings.server.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { Meter } from "#app/lib/ui/meter.tsx";
import type { Route } from "./+types/home";
import styles from "./home.module.css";
import { homeState } from "./home-state.ts";

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
  const now = new Date();
  const [list, { suspended }, published, applied, latestFinished, storedBytes, creditsUsed] =
    await Promise.all([
      listEntries(user.siteId, "page", user, { status: "all", q: "", page: 1 }),
      findMemberSite(user.siteId),
      hasPublishedEntries(user.siteId),
      hasAppliedRun(user.siteId),
      findLatestFinishedRun(user.siteId),
      storageUsed(user.siteId),
      // Only while AI is on: with it off the card has no AI meter.
      runner === null ? 0 : runStore.creditsUsedSince(user.siteId, startOfUtcMonth(now)),
    ]);
  const offered =
    startGate({ aiOn: runner !== null, suspended, published, applied }).kind === "offer";
  const state = homeState({
    published,
    applied,
    offered,
    latestFinished: latestFinished?.status ?? null,
  });
  // Only the ready panel needs the draft's size and the page to edit first. With
  // no home page set (the person changed it), Edit the home page is not offered.
  const ready =
    state === "ready"
      ? {
          pageCount: await appliedRunPageCount(user.siteId),
          homePageId: (await getSiteSettings(user.siteId, env.R2_PUBLIC_URL)).homePageId,
        }
      : null;
  return {
    pages: list.entries,
    total: list.total,
    state,
    ready,
    storage: storageSummary(storedBytes, env.STORAGE_LIMIT_BYTES),
    allowance:
      runner === null || env.AI === null
        ? null
        : allowanceSummary(creditsUsed, env.AI.creditsPerMonth, now),
    reviewRunId: state === "review" ? (latestFinished?.id ?? null) : null,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pages, total, state, ready, reviewRunId, storage, allowance } = loaderData;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Home</h1>
      </div>
      {state === "ready" && ready && (
        <>
          <section className={styles.ready} aria-labelledby="ready-title">
            <span className={`${styles.badge} ${styles.draft}`}>Not published yet</span>
            <h2 id="ready-title" className={styles.readyTitle}>
              Your website is ready. What would you like to change?
            </h2>
            <p className={styles.muted}>
              We drafted {ready.pageCount} {ready.pageCount === 1 ? "page" : "pages"} from your
              description. Look them over and change anything - nobody sees them before you publish.
            </p>
            {ready.homePageId && (
              <p>
                <Link className={styles.primaryLink} to={`/admin/pages/${ready.homePageId}`}>
                  Edit the home page
                </Link>
              </p>
            )}
          </section>
          <section aria-labelledby="change-title">
            <h2 id="change-title" className="visually-hidden">
              Things to change
            </h2>
            <ul className={styles.suggestList}>
              <li>
                <Link className={styles.suggest} to="/admin/settings">
                  Add your logo
                </Link>
              </li>
              <li>
                <Link className={styles.suggest} to="/admin/settings">
                  Change the menu
                </Link>
              </li>
            </ul>
          </section>
        </>
      )}
      {state === "review" && reviewRunId && (
        <section className={styles.ready} aria-labelledby="offer-title">
          <h2 id="offer-title" className={styles.readyTitle}>
            Your draft is waiting.
          </h2>
          <p>
            <Link className={styles.primaryLink} to={`/start/${reviewRunId}`}>
              Review your draft
            </Link>
          </p>
        </section>
      )}
      {state === "start" && (
        <section className={styles.ready} aria-labelledby="offer-title">
          <h2 id="offer-title" className={styles.readyTitle}>
            Let Habre draft your site from a short description.
          </h2>
          <p>
            <Link className={styles.primaryLink} to="/start">
              Start from a description
            </Link>
          </p>
        </section>
      )}
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
        <section className={styles.card} aria-labelledby="month-title">
          <h2 id="month-title" className={styles.cardTitle}>
            This month
          </h2>
          {allowance && (
            <Meter
              label="AI allowance"
              text={allowance.text}
              value={allowance.value}
              max={allowance.max}
            />
          )}
          <Meter
            label="Storage"
            text={
              storage.limitText
                ? `${storage.usedText} of ${storage.limitText} used`
                : `${storage.usedText} used`
            }
            value={storage.value}
            max={storage.max}
          />
        </section>
      </div>
    </>
  );
}
