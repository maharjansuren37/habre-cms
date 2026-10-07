import { Form, redirect } from "react-router";
import { findRunningRun } from "#app/features/ai/runs.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/start";
import styles from "./onboarding.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "What do you want to create? - Habre" }];
}

const KINDS = [
  {
    value: "website",
    title: "Website",
    description: "A few pages about you, a club or a project.",
    icon: (
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
    ),
  },
  {
    value: "blog",
    title: "Blog",
    description: "Posts, newest first, and an About page.",
    icon: <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" />,
  },
  {
    value: "business",
    title: "Business",
    description: "What you offer, your prices, and a way to get in touch.",
    icon: (
      <path d="M4 9 5.5 4h13L20 9M4 9h16v1.5a3 3 0 0 1-5.3 1.9 3 3 0 0 1-5.4 0A3 3 0 0 1 4 10.5zM5 13v7h14v-7" />
    ),
  },
  {
    value: "portfolio",
    title: "Portfolio",
    description: "Your work, in pictures, with a way to enquire.",
    icon: <path d="M4 8h3l2-3h6l2 3h3v11H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z" />,
  },
] as const;

// The running-run redirect lives here and in step 2, not in the layout, so a
// run's own page never redirects to itself.
export async function loader({ context, request }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const running = await findRunningRun(siteId);
  if (running) throw redirect(`/start/${running.id}`);
  const kind = new URL(request.url).searchParams.get("kind");
  return { kind: KINDS.find((candidate) => candidate.value === kind)?.value ?? null };
}

export default function Start({ loaderData }: Route.ComponentProps) {
  return (
    <Form method="get" action="/start/about">
      <div className={styles.steps}>
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.done}`} />
          <span className={styles.bar} />
        </span>
        <span>Step 1 of 2</span>
      </div>
      <h1 className={styles.heading}>What do you want to create?</h1>
      <p className={styles.lede}>
        Pick the closest. You can add pages, a blog or a contact form later, whatever you choose.
      </p>

      <fieldset className={styles.cards}>
        <legend className="visually-hidden">Kind of website</legend>
        {KINDS.map((kind) => (
          <label key={kind.value} className={styles.card}>
            <input
              type="radio"
              name="kind"
              value={kind.value}
              defaultChecked={loaderData.kind === kind.value}
              required
            />
            <span className={styles.cardIcon}>
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                className={styles.icon}
                aria-hidden="true"
              >
                {kind.icon}
              </svg>
            </span>
            <span className={styles.cardTitle}>{kind.title}</span>
            <span className={styles.cardDescription}>{kind.description}</span>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              className={styles.tick}
              aria-hidden="true"
            >
              <path d="m5 12 5 5 9-10" />
            </svg>
          </label>
        ))}
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" className={styles.large}>
          Continue
        </Button>
      </div>
    </Form>
  );
}
