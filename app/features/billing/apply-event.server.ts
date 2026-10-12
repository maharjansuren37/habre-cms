import type { TransactionSql } from "postgres";
import { sql } from "#app/lib/db.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { type PlanChange, planChangeFor, type StripeEventLike } from "./billing-events.ts";

export type ApplyResult = "applied" | "duplicate" | "ignored" | "stale" | "unknown_site";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SiteRow = { id: string; plan: "free" | "paid"; billing_event_at: Date | null };

/**
 * Applies one verified Stripe event, once (item 21b, D160). One transaction:
 * the event's id goes into `stripe_events` first, so a second delivery of the
 * same id inserts nothing and changes nothing, and a failure rolls the id back
 * with the rest so Stripe's retry applies it. `sites` and `stripe_events` are
 * platform tables, outside row-level security.
 *
 * An event older than the last one applied to the site is recorded and
 * ignored: Stripe does not promise order, and a late `updated` after a
 * `deleted` would bring a plan back.
 */
export async function applyStripeEvent(event: StripeEventLike): Promise<ApplyResult> {
  return (await sql.begin(async (tx) => {
    const recorded = await tx<{ id: string }[]>`
      insert into stripe_events (id, type) values (${event.id}, ${event.type})
      on conflict (id) do nothing
      returning id`;
    if (recorded.length === 0) return "duplicate";

    const change = planChangeFor(event);
    if (change === null) return "ignored";

    const site = await findSite(tx, change);
    if (site === null) {
      console.warn(JSON.stringify({ event: "stripe_event_unknown_site", eventId: event.id }));
      return "unknown_site";
    }
    // Strictly older: events share a second, and both are then applied.
    if (site.billing_event_at !== null && change.eventAt < site.billing_event_at) return "stale";

    const detail = change.source === "subscription";
    await tx`
      update sites set
        plan = ${change.plan},
        billing_status = ${change.billingStatus},
        billing_customer_id = coalesce(${change.customerId}, billing_customer_id),
        billing_subscription_id = coalesce(${change.subscriptionId}, billing_subscription_id),
        paid_until = ${detail ? change.paidUntil : tx`paid_until`},
        billing_interval = ${detail ? change.billingInterval : tx`billing_interval`},
        trial_ends_at = ${detail ? change.trialEndsAt : tx`trial_ends_at`},
        billing_event_at = ${change.eventAt},
        updated_at = now()
      where id = ${site.id}`;

    if (site.plan !== change.plan) {
      logSecurityEvent({
        event: "plan_changed",
        siteId: site.id,
        from: site.plan,
        to: change.plan,
        billingStatus: change.billingStatus,
        eventId: event.id,
      });
    }
    return "applied";
  })) as ApplyResult;
}

// The subscription Stripe already knows it by, then the customer, then the
// site id a checkout or a subscription's metadata carries. Locked, so two
// events for one site apply one after the other.
async function findSite(tx: TransactionSql, change: PlanChange): Promise<SiteRow | null> {
  const { subscriptionId, customerId, siteId } = change.match;
  if (subscriptionId !== undefined) {
    const [row] = await tx<SiteRow[]>`
      select id, plan, billing_event_at from sites
      where billing_subscription_id = ${subscriptionId} for update`;
    if (row) return row;
  }
  if (customerId !== undefined) {
    const [row] = await tx<SiteRow[]>`
      select id, plan, billing_event_at from sites
      where billing_customer_id = ${customerId} for update`;
    if (row) return row;
  }
  if (siteId !== undefined && UUID.test(siteId)) {
    const [row] = await tx<SiteRow[]>`
      select id, plan, billing_event_at from sites where id = ${siteId} for update`;
    if (row) return row;
  }
  return null;
}
