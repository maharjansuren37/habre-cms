import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { findRun, findRunningRun } from "#app/features/ai/runs.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/start-about";
import { isAboutBodyAllowed } from "./body-size.ts";
import styles from "./onboarding.module.css";
import { refusalMessage } from "./start-refusals.ts";
import { startRun } from "./start-run.server.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Tell us about it - Habre" }];
}

const KINDS = ["website", "blog", "business", "portfolio"] as const;
const UUID = z.uuid();

const inputSchema = z.object({
  kind: z.enum(KINDS),
  description: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters.")
    .max(2000, "Keep it to 2,000 characters or fewer."),
});

export async function loader({ context, request }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const running = await findRunningRun(siteId);
  if (running) throw redirect(`/start/${running.id}`);
  const params = new URL(request.url).searchParams;
  const kind = KINDS.find((candidate) => candidate === params.get("kind"));
  if (!kind) throw redirect("/start");
  // from= carries a run id, never the text; only this site's own run prefills.
  const from = UUID.safeParse(params.get("from"));
  const earlier = from.success ? await findRun(siteId, from.data) : null;
  return { kind, description: earlier?.description ?? "" };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { siteId, id: userId } = context.get(userContext);
  if (!isAboutBodyAllowed(request.headers)) throw data("Request too large", { status: 413 });
  const form = await request.formData();
  const values = {
    kind: String(form.get("kind") ?? ""),
    description: String(form.get("description") ?? ""),
  };
  const parsed = inputSchema.safeParse(values);
  if (!parsed.success) {
    // A bad kind cannot come from the form; send it back to choose again.
    if (!KINDS.some((kind) => kind === values.kind)) throw redirect("/start");
    const error = parsed.error.issues.find((issue) => issue.path[0] === "description")?.message;
    return data({ error: error ?? "Describe your site.", refusal: null, values }, { status: 400 });
  }
  if (!startRun) throw redirect("/admin");
  const result = await startRun(siteId, userId, parsed.data);
  if (!result.ok) {
    return data(
      { error: null, refusal: refusalMessage(result.reason, new Date()), values },
      { status: 400 },
    );
  }
  throw redirect(`/start/${result.runId}/brand`);
}

export default function StartAbout({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isStarting = navigation.state !== "idle" && navigation.formMethod === "POST";
  const { kind } = loaderData;
  const description = actionData?.values.description ?? loaderData.description;
  const error = actionData?.error ?? undefined;

  return (
    <Form method="post">
      <div className={styles.steps}>
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.done}`} />
          <span className={`${styles.bar} ${styles.done}`} />
          <span className={styles.bar} />
        </span>
        <span>Step 2 of 3</span>
      </div>
      <h1 className={styles.heading}>Tell us about it</h1>
      <p className={styles.lede}>
        A sentence or two is enough: what it's called, what you do and who it's for.
      </p>

      {actionData?.refusal && (
        <Message tone="error" title={actionData.refusal} className={styles.banner} />
      )}

      <input type="hidden" name="kind" value={kind} />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          About your {kind}
        </label>
        <textarea
          id="description"
          name="description"
          key={description}
          defaultValue={description}
          rows={6}
          className={styles.textarea}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "description-hint description-error" : "description-hint"}
        />
        <p id="description-hint" className={styles.hint}>
          10 to 2,000 characters.
        </p>
        {error && (
          <p id="description-error" className={styles.error}>
            {error}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <Link to={`/start?kind=${kind}`} className={styles.back}>
          Back
        </Link>
        <Button type="submit" variant="primary" className={styles.large} isPending={isStarting}>
          {isStarting ? "Starting…" : "Build my site"}
        </Button>
      </div>
    </Form>
  );
}
