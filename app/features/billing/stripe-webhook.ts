import { clientIp } from "#app/features/auth/client-ip.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import type { Route } from "./+types/stripe-webhook";
import { applyStripeEvent } from "./apply-event.server.ts";
import type { StripeEventLike } from "./billing-events.ts";
import { readTextUpTo } from "./read-body.ts";
import { stripe } from "./stripe.server.ts";

// Stripe's events are a few KB; subscription objects with many items are the
// largest. 512 KB is far above any and far below a memory problem.
const MAX_BODY_BYTES = 512 * 1024;

// React Router answers a GET to an action-only route with 400, so the loader
// says 405 itself.
export function loader() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

/**
 * Stripe's webhook (item 21b, D160). The only thing that changes a site's plan
 * from a payment. No session, cookie or origin: the signature over the exact
 * body is the authentication. 404 with billing off, 413 past the size cap, 400
 * for a missing or wrong signature, 200 once applied, ignored or seen before,
 * and 500 when applying failed so Stripe retries.
 */
export async function action({ request }: Route.ActionArgs) {
  if (stripe === null || env.BILLING === null) {
    throw new Response("Not Found", { status: 404 });
  }
  const ip = clientIp(request.headers);

  const declared = request.headers.get("Content-Length");
  if (declared !== null && /^[0-9]+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) {
    logSecurityEvent({ event: "stripe_webhook_refused", reason: "too_large", ip });
    throw new Response("Payload Too Large", { status: 413 });
  }
  const body = await readTextUpTo(request.body, MAX_BODY_BYTES);
  if (body === null) {
    logSecurityEvent({ event: "stripe_webhook_refused", reason: "too_large", ip });
    throw new Response("Payload Too Large", { status: 413 });
  }

  const signature = request.headers.get("Stripe-Signature");
  let event: StripeEventLike;
  try {
    if (signature === null) throw new Error("missing signature");
    event = await stripe.webhooks.constructEventAsync(body, signature, env.BILLING.webhookSecret);
  } catch {
    // The body and the SDK's message stay out of the log: either may echo input.
    logSecurityEvent({ event: "stripe_webhook_refused", reason: "signature", ip });
    throw new Response("Bad signature", { status: 400 });
  }

  const result = await applyStripeEvent(event);
  return new Response(JSON.stringify({ received: true, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
