import { useEffect } from "react";
import { data, Form, Link, redirect, useNavigation, useRevalidator } from "react-router";
import { z } from "zod";
import { proposalSchema } from "#app/features/ai/proposal.ts";
import { findRun } from "#app/features/ai/runs.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
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

export async function loader({ context, params }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const view = runView(run, new Date());
  if (view.state === "applied") throw redirect("/admin");
  // The result is untrusted: only a proposal that parses shows its page titles,
  // and they reach the page as text. One that does not parse shows none.
  const proposal = view.state === "succeeded" ? proposalSchema.safeParse(run.result) : null;
  const titles = proposal?.success ? proposal.data.pages.map((page) => page.title) : [];
  return {
    runId: run.id,
    kind: run.kind,
    state: view.state,
    error: view.error,
    seconds: view.seconds,
    canRetry: view.canRetry,
    titles,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { siteId, id: userId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const form = await request.formData();
  if (form.get("intent") !== "retry" || !runView(run, new Date()).canRetry) {
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
  const { runId, kind, state, error, seconds, canRetry, titles } = loaderData;
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const isRetrying = navigation.state !== "idle" && navigation.formMethod === "POST";

  // Poll while the run is going; the interval is cleared the moment it is not.
  useEffect(() => {
    if (state !== "running") return;
    const timer = setInterval(() => {
      if (revalidator.state === "idle") void revalidator.revalidate();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, revalidator]);

  if (state === "succeeded") {
    return (
      <>
        <h1 className={styles.heading}>Your draft is ready</h1>
        {titles.length > 0 && (
          <ul className={styles.titles}>
            {titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  if (state === "failed") {
    const refused = error === "refused";
    const change = (
      <Link
        to={`/start/about?kind=${kind}&from=${runId}`}
        className={refused ? styles.primaryLink : styles.secondaryLink}
      >
        Change the description
      </Link>
    );
    return (
      <>
        <h1 className={styles.heading}>Couldn't build your site</h1>
        <p role="status" className={styles.lede}>
          {refused
            ? "The AI wouldn't write a site from that description. Change it and try again, or start blank."
            : "Something went wrong on our side. Try again, or start blank."}
        </p>
        {actionData?.refusal && (
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
    );
  }

  return (
    <>
      <h1 className={styles.heading}>Building your site</h1>
      <p role="status" className={styles.lede}>
        {seconds >= SLOW_AFTER_SECONDS
          ? "This is taking longer than usual. It stops by itself after five minutes."
          : "Writing your pages, menu and search descriptions. This usually takes about a minute."}
      </p>
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
  );
}
