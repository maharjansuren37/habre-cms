import { data, Form, Link, redirect, useNavigation } from "react-router";
import { allowanceSummary } from "#app/features/ai/allowance-summary.ts";
import { startOfUtcMonth } from "#app/features/ai/credits.ts";
import { runner } from "#app/features/ai/runner.server.ts";
import {
  appliedRunPageCount,
  findLatestFinishedRun,
  hasAppliedRun,
  runStore,
} from "#app/features/ai/runs.server.ts";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import {
  hasPublishedEntries,
  listEntries,
  publishDraftPages,
} from "#app/features/content/entries.server.ts";
import { storageUsed } from "#app/features/media/media.server.ts";
import { storageSummary } from "#app/features/media/storage-limit.ts";
import { startGate } from "#app/features/onboarding/start-gate.ts";
import { getSiteSettings } from "#app/features/settings/settings.server.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { siteOrigin } from "#app/lib/site-origin.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
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
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user.role !== "admin") throw redirect("/admin/posts");
  // The first page of the list is the first 20 (PAGE_SIZE); `total` says
  // whether Pages holds more.
  const now = new Date();
  const [
    list,
    { suspended, subdomain },
    published,
    applied,
    latestFinished,
    storedBytes,
    creditsUsed,
  ] = await Promise.all([
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
    // A flag read as a boolean, nothing echoed (item 18b4b); the banner needs
    // something to be published.
    justPublished: new URL(request.url).searchParams.get("published") === "1" && published,
    siteUrl: siteOrigin(subdomain, env.SITES_URL),
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

// Publish website (item 18b4b): the one-time end of onboarding, so only while a
// draft was used and nothing is published. The role is checked here because the
// loader's redirect does not run for a POST.
export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (user.role !== "admin") {
    // The same event requireRole logs (F-82), with the same fields.
    logSecurityEvent({
      event: "request_refused",
      reason: "role",
      path: new URL(request.url).pathname,
      role: user.role,
      ip: clientIp(request.headers),
    });
    throw data("Not Found", { status: 404 });
  }
  const form = await request.formData();
  if (form.get("intent") !== "publish") throw redirect("/admin");
  const [published, applied] = await Promise.all([
    hasPublishedEntries(user.siteId),
    hasAppliedRun(user.siteId),
  ]);
  if (published || !applied) throw redirect("/admin");
  const pages = await publishDraftPages(user.siteId);
  console.info(
    JSON.stringify({ event: "site_published", siteId: user.siteId, userId: user.id, pages }),
  );
  throw redirect("/admin?published=1");
}

/** A link that opens in a new tab: the arrow is decoration, the words say it. */
function NewTab() {
  return (
    <>
      <span className="visually-hidden"> (opens in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pages, total, state, ready, reviewRunId, storage, allowance, justPublished, siteUrl } =
    loaderData;
  const navigation = useNavigation();
  const publishing =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "publish";

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Home</h1>
      </div>
      {justPublished && (
        <Message
          tone="success"
          title="Your website is published."
          className={styles.banner}
          action={
            <a className={styles.secondaryLink} href={`${siteUrl}/`} target="_blank" rel="noopener">
              View your site
              <NewTab />
            </a>
          }
        />
      )}
      {state === "ready" && ready && (
        <>
          <section className={styles.ready} aria-labelledby="ready-title">
            <span className={`${styles.badge} ${styles.draft}`}>Not published yet</span>
            <h2 id="ready-title" className={styles.readyTitle}>
              Your website is ready. What would you like to change?
            </h2>
            <p className={styles.muted}>
              {ready.pageCount > 0 &&
                `We drafted ${ready.pageCount} ${ready.pageCount === 1 ? "page" : "pages"} from your description. `}
              Look them over, change anything, then publish - nobody sees it before that.
            </p>
            <div className={styles.cluster}>
              <Form method="post">
                <input type="hidden" name="intent" value="publish" />
                <Button type="submit" variant="primary" isPending={publishing}>
                  {publishing ? "Publishing…" : "Publish website"}
                </Button>
              </Form>
              <a
                className={styles.secondaryLink}
                href="/admin/preview"
                target="_blank"
                rel="noopener"
              >
                Preview
                <NewTab />
              </a>
            </div>
          </section>
          <section aria-labelledby="change-title">
            <h2 id="change-title" className="visually-hidden">
              Things to change
            </h2>
            <ul className={styles.suggestList}>
              {ready.homePageId && (
                <li>
                  <Link className={styles.suggest} to={`/admin/pages/${ready.homePageId}`}>
                    Edit the home page
                  </Link>
                </li>
              )}
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
