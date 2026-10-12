import type { BillingFacts } from "#app/features/plans/plan-view.ts";
import { sql } from "#app/lib/db.server.ts";

type Row = {
  plan: "free" | "paid";
  billing_status: BillingFacts["billingStatus"];
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  paid_until: Date | null;
  billing_interval: "month" | "year" | null;
  trial_ends_at: Date | null;
};

/**
 * What the plan page needs about a site's billing; one query on the primary
 * key of a platform table. Not on `findMemberSite`, which every admin request
 * runs and which only needs the plan.
 */
export async function findBillingFacts(siteId: string): Promise<BillingFacts> {
  const [row] = await sql<Row[]>`
    select plan, billing_status, billing_customer_id, billing_subscription_id,
           paid_until, billing_interval, trial_ends_at
    from sites where id = ${siteId}`;
  if (!row) throw new Error("the member's site does not exist");
  return {
    plan: row.plan,
    billingStatus: row.billing_status,
    customerId: row.billing_customer_id,
    subscriptionId: row.billing_subscription_id,
    paidUntil: row.paid_until,
    interval: row.billing_interval,
    trialEndsAt: row.trial_ends_at,
  };
}
