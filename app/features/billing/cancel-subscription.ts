// Cancelling a site's subscription before the site is deleted (item 21b, D160).
// `deleteAccount` is the one place a site is deleted; leaving the subscription
// running would charge a customer for a site that no longer exists, so a
// deletion Stripe cannot confirm is refused rather than carried on.

export type CancelOutcome = "none" | "cancelled" | "already" | "unavailable";

type CancelClient = { subscriptions: { cancel(id: string): Promise<unknown> } };

export async function cancelForDeletion(
  subscriptionId: string | null,
  client: CancelClient | null,
): Promise<CancelOutcome> {
  // Billing off, or never subscribed: nothing to cancel.
  if (subscriptionId === null || client === null) return "none";
  try {
    await client.subscriptions.cancel(subscriptionId);
    return "cancelled";
  } catch (error) {
    // Stripe no longer has it (already cancelled and gone): nothing left to stop.
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "resource_missing") return "already";
    }
    const type =
      typeof error === "object" && error !== null && "type" in error
        ? String(error.type)
        : "unknown";
    console.error(JSON.stringify({ event: "stripe_call_failed", action: "cancel", type }));
    return "unavailable";
  }
}
