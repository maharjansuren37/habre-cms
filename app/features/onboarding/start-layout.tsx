import { Link, Outlet, redirect } from "react-router";
import { runner } from "#app/features/ai/runner.server.ts";
import { hasAppliedRun } from "#app/features/ai/runs.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { hasPublishedEntries } from "#app/features/content/entries.server.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import type { Route } from "./+types/start-layout";
import styles from "./onboarding.module.css";
import { startGate } from "./start-gate.ts";

// Middleware, not a loader: loaders do not run for a POST, so an action under
// this layout (step 2's, the wait's retry) would otherwise skip the gate.
const gateMiddleware: Route.MiddlewareFunction = async ({ context }) => {
  const { siteId } = context.get(userContext);
  const [{ suspended }, published, applied] = await Promise.all([
    findMemberSite(siteId),
    hasPublishedEntries(siteId),
    hasAppliedRun(siteId),
  ]);
  const gate = startGate({ aiOn: runner !== null, suspended, published, applied });
  if (gate.kind === "redirect") throw redirect(gate.to);
};

// Order matters: a signed-out visitor goes to sign in, a member who is not an
// admin gets Not Found, and only then is the gate asked. It guards every /start
// route: the steps below it add only their own checks.
export const middleware: Route.MiddlewareFunction[] = [
  requireUser,
  requireRole(["admin"]),
  gateMiddleware,
];

export default function StartLayout() {
  return (
    <div className={styles.flow}>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            h
          </span>{" "}
          habre
        </span>
        <Link to="/admin" className={styles.skip}>
          Start blank instead
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
