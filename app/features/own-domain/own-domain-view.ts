import type { DomainRefusal, VerificationOutcome } from "./own-domain.ts";

// What the Own domain section of the plan page says (item 21c, Step 5). Pure:
// the site's facts come in, the state and the words go out.

export type OwnDomainState = "free-billing" | "free-no-billing" | "none" | "waiting" | "verified";

/**
 * Which part of the section to show. An existing row wins over the plan: a
 * Free site that still has a verified domain (a downgrade, or site 1's seeded
 * row) keeps serving it (D150), and an unverified one can still be checked or
 * removed. Only adding needs Launch.
 */
export function ownDomainState(input: {
  plan: "free" | "paid";
  billingOn: boolean;
  row: { verifiedAt: Date | null } | null;
}): OwnDomainState {
  if (input.row) return input.row.verifiedAt === null ? "waiting" : "verified";
  if (input.plan === "paid") return "none";
  return input.billingOn ? "free-billing" : "free-no-billing";
}

export type RefusalReason = DomainRefusal | "free" | "has_domain" | "taken" | "rate_limited";

const REFUSALS: Record<RefusalReason, string> = {
  empty: "Type your domain, like example.org.",
  invalid: "That does not look like a domain name. Type just the name, like example.org.",
  ip: "Use a name, not an IP address.",
  reserved: "That address belongs to Habre. Use your own domain.",
  free: "Your own domain is part of Launch.",
  has_domain: "Your site already has a domain. Remove it to add another.",
  taken: "That domain is already in use on another site.",
  rate_limited:
    "That is ten checks in the last hour. Try again later - we also check by ourselves.",
};

export const refusalMessage = (reason: RefusalReason): string => REFUSALS[reason];

const OUTCOMES: Record<VerificationOutcome, string> = {
  verified: "Your domain is verified.",
  "no-txt":
    "We cannot see the verification record yet. DNS changes can take a few minutes, sometimes longer.",
  "wrong-txt":
    "We found a verification record, but its value is not the one above. Check it for typos.",
  "not-pointing":
    "The verification record is there, but the domain does not point to your site yet. If you use Cloudflare, turn its proxy off (a grey cloud).",
  "lookup-failed": "We could not check just now. Try again in a minute.",
};

export const outcomeMessage = (outcome: VerificationOutcome): string => OUTCOMES[outcome];
