import { useEffect } from "react";
import { data, Form, Link, redirect, useNavigation, useRevalidator } from "react-router";
import { z } from "zod";
import { planApply, reviewSummary } from "#app/features/ai/apply-plan.ts";
import { applyRun } from "#app/features/ai/apply-run.server.ts";
import { proposalSchema } from "#app/features/ai/proposal.ts";
import { findRun, type StoredRun } from "#app/features/ai/runs.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { getSiteSettings } from "#app/features/settings/settings.server.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/start-wait";
import styles from "./onboarding.module.css";
import { runView } from "./run-view.ts";
import { refusalMessage } from "./start-refusals.ts";
import { startRun } from "./start-run.server.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Building your site - Habre" }];
}

const POLL_MS = 2000;
const SLOW_AFTER_SECONDS = 120;

async function findThisRun(siteId: string, runId: string | undefined) {
  const id = z.uuid().safeParse(runId);
  const run = id.success ? await findRun(siteId, id.data) : null;
  if (!run) throw data("Not Found", { status: 404 });
  return run;
}

/** One rule for the loader and the retry action: does the stored result still read as a proposal? */
function resultParses(result: unknown): boolean {
  return proposalSchema.safeParse(result).success;
}

function viewOf(run: StoredRun) {
  return runView({ ...run, resultParses: resultParses(run.result) }, new Date());
}

/** Through the CSSOM, never a style attribute: the admin's style-src has no 'unsafe-inline'. */
function setSwatchColour(element: HTMLElement | null, colour: string) {
  element?.style.setProperty("--swatch", colour);
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const view = viewOf(run);
  if (view.state === "applied") throw redirect("/admin");
  // The result is untrusted: only a proposal that parses is reviewed, and its
  // text reaches the page as text. The review shows no addresses, so no slugs
  // are taken; planApply only decides which of the colour and description apply.
  let review = null;
  const proposal = view.state === "succeeded" ? proposalSchema.safeParse(run.result) : null;
  if (proposal?.success) {
    const settings = await getSiteSettings(siteId, env.R2_PUBLIC_URL);
    const plan = planApply(proposal.data, {
      takenPageSlugs: [],
      hasLogo: settings.logoMediaId !== null,
      brandColor: settings.brandColor,
      siteDescription: settings.siteDescription,
    });
    review = {
      ...reviewSummary(proposal.data),
      siteDescription: plan.siteDescription,
      brandColor: plan.brandColor,
    };
  }
  return {
    runId: run.id,
    kind: run.kind,
    state: view.state,
    error: view.error,
    seconds: view.seconds,
    canRetry: view.canRetry,
    review,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { siteId, id: userId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const form = await request.formData();
  if (form.get("intent") === "apply") {
    const result = await applyRun(siteId, run.id, userId);
    if (result.ok || result.reason === "not_succeeded") throw redirect("/admin");
    return data(
      { applyError: "This draft can no longer be used. Try again, or start blank." },
      { status: 400 },
    );
  }
  if (form.get("intent") !== "retry" || !viewOf(run).canRetry) {
    throw data("Bad Request", { status: 400 });
  }
  if (!startRun) throw redirect("/admin");
  const result = await startRun(siteId, userId, { kind: run.kind, description: run.description });
  if (!result.ok) {
    return data({ refusal: refusalMessage(result.reason, new Date()) }, { status: 400 });
  }
  throw redirect(`/start/${result.runId}`);
}

export default function StartRun({ loaderData, actionData }: Route.ComponentProps) {
  const { runId, kind, state, error, seconds, canRetry, review } = loaderData;
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const pendingIntent =
    navigation.state !== "idle" && navigation.formMethod === "POST"
      ? navigation.formData?.get("intent")
      : null;
  const isRetrying = pendingIntent === "retry";
  const isApplying = pendingIntent === "apply";

  // Poll while the run is going; the interval is cleared the moment it is not.
  useEffect(() => {
    if (state !== "running") return;
    const timer = setInterval(() => {
      if (revalidator.state === "idle") void revalidator.revalidate();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, revalidator]);

  const refused = error === "refused";
  const change = (
    <Link
      to={`/start/about?kind=${kind}&from=${runId}`}
      className={state === "failed" && refused ? styles.primaryLink : styles.secondaryLink}
    >
      Change the description
    </Link>
  );

  // The heading and the status line render in every state, so the status element
  // is the same node when the run finishes and its new text is announced (F-354).
  let heading = "Building your site";
  let statusText =
    seconds >= SLOW_AFTER_SECONDS
      ? "This is taking longer than usual. It stops by itself after five minutes."
      : "Writing your pages, menu and search descriptions. This usually takes about a minute.";
  if (state === "succeeded") {
    heading = "Your draft is ready";
    statusText = "Your draft is ready to review.";
  } else if (state === "failed") {
    heading = "Couldn't build your site";
    statusText = refused
      ? "The AI wouldn't write a site from that description. Change it and try again, or start blank."
      : "Something went wrong on our side. Try again, or start blank.";
  }

  return (
    <>
      <h1 className={styles.heading}>{heading}</h1>
      <p role="status" className={state === "succeeded" ? styles.hint : styles.lede}>
        {statusText}
      </p>
      {state === "succeeded" && review && (
        <>
          <p className={styles.lede}>
            Here is what Habre wrote from your description. Nothing is public until you publish it.
          </p>
          {review.pages.map((page) => (
            <section key={page.key} className={styles.reviewSection}>
              <div className={styles.reviewTitle}>
                <h2 className={styles.reviewHeading}>{page.title}</h2>
                {page.key === review.homeKey && <span className={styles.badge}>Home page</span>}
              </div>
              <ol className={styles.reviewList}>
                {page.sections.map((section, at) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a static list, never reordered
                  <li key={at}>
                    {section.kindName}: {section.heading}
                  </li>
                ))}
              </ol>
              <dl className={styles.facts}>
                <dt>Title in search results</dt>
                <dd>{page.seoTitle}</dd>
                <dt>Description</dt>
                <dd>{page.seoDescription}</dd>
              </dl>
            </section>
          ))}
          <section className={styles.reviewSection}>
            <h2 className={styles.reviewHeading}>Menu</h2>
            <ol className={styles.reviewList}>
              {review.menu.map((title, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a static list, never reordered
                <li key={at}>{title}</li>
              ))}
            </ol>
          </section>
          {(review.siteDescription !== null || review.brandColor !== null) && (
            <section className={styles.reviewSection}>
              <h2 className={styles.reviewHeading}>Your site</h2>
              <dl className={styles.facts}>
                {review.siteDescription !== null && (
                  <>
                    <dt>Site description</dt>
                    <dd>{review.siteDescription}</dd>
                  </>
                )}
                {review.brandColor !== null && (
                  <>
                    <dt>Brand colour</dt>
                    <dd className={styles.colour}>
                      <span
                        className={styles.colourSwatch}
                        ref={(element) => setSwatchColour(element, review.brandColor as string)}
                      />
                      {review.brandColor}
                    </dd>
                  </>
                )}
              </dl>
            </section>
          )}
          {review.emptyPhotoCount > 0 && (
            <Message
              tone="notice"
              title={`${review.emptyPhotoCount} ${
                review.emptyPhotoCount === 1 ? "place for a photo is" : "places for a photo are"
              } empty. Add your own from each page's editor.`}
              className={styles.banner}
            />
          )}
          {actionData && "applyError" in actionData && (
            <Message tone="error" title={actionData.applyError} className={styles.banner} />
          )}
          <div className={styles.actions}>
            {change}
            <Form method="post">
              <input type="hidden" name="intent" value="apply" />
              <Button
                type="submit"
                variant="primary"
                className={styles.large}
                isPending={isApplying}
              >
                {isApplying ? "Applying…" : "Use this draft"}
              </Button>
            </Form>
          </div>
        </>
      )}
      {state === "failed" && (
        <>
          {actionData && "refusal" in actionData && (
            <Message tone="error" title={actionData.refusal} className={styles.banner} />
          )}
          <div className={styles.actions}>
            {change}
            {canRetry && (
              <Form method="post">
                <input type="hidden" name="intent" value="retry" />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.large}
                  isPending={isRetrying}
                >
                  {isRetrying ? "Starting…" : "Try again"}
                </Button>
              </Form>
            )}
          </div>
        </>
      )}
      {state === "running" && (
        <>
          <progress className={styles.progress} aria-label="Building your site" />
          <p className={styles.hint}>
            {seconds} {seconds === 1 ? "second" : "seconds"} so far
          </p>
          <noscript>
            <p>
              <a href={`/start/${runId}`}>Check progress</a>
            </p>
          </noscript>
        </>
      )}
    </>
  );
}
