import { allowanceSummary } from "#app/features/ai/allowance-summary.ts";
import { startOfUtcMonth } from "#app/features/ai/credits.ts";
import { runner } from "#app/features/ai/runner.server.ts";
import { runStore } from "#app/features/ai/runs.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { storageUsed } from "#app/features/media/media.server.ts";
import { storageSummary } from "#app/features/media/storage-limit.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { env } from "#app/lib/env.server.ts";
import { Meter } from "#app/lib/ui/meter.tsx";
import type { Route } from "./+types/plan-page";
import { limitsFor } from "./plan-limits.ts";
import styles from "./plan-page.module.css";
import { launchAdds, planName } from "./plan-view.ts";

// Admin only; a non-admin gets the same 404 as every other refusal.
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Plan - Habre CMS" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const now = new Date();
  const [{ plan }, storedBytes, creditsUsed] = await Promise.all([
    findMemberSite(user.siteId),
    storageUsed(user.siteId),
    // Only while AI is on: with it off the page has no AI meter.
    runner === null ? 0 : runStore.creditsUsedSince(user.siteId, startOfUtcMonth(now)),
  ]);
  const limits = limitsFor(plan, env.PLAN_LIMITS);
  return {
    isLaunch: plan === "paid",
    name: planName(plan),
    storage: storageSummary(storedBytes, limits.storageBytes),
    allowance:
      runner === null || env.AI === null
        ? null
        : allowanceSummary(creditsUsed, limits.aiCredits, now),
    adds: launchAdds(env.PLAN_LIMITS.free, env.PLAN_LIMITS.launch),
  };
}

export default function PlanPage({ loaderData }: Route.ComponentProps) {
  const { isLaunch, name, storage, allowance, adds } = loaderData;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Plan</h1>
      </div>
      <p>Your site is on the {name} plan.</p>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="use-title">
          <h2 id="use-title" className={styles.cardTitle}>
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
        <section className={styles.card} aria-labelledby="adds-title">
          <h2 id="adds-title" className={styles.cardTitle}>
            {isLaunch ? "What Launch includes" : "What Launch adds"}
          </h2>
          <ul className={styles.list}>
            {adds.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
      <p className={styles.muted}>Paid plans are coming soon.</p>
    </>
  );
}
