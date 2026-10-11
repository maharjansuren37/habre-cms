import { redirect } from "react-router";
import { z } from "zod";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import type { Route } from "./+types/contact-submit";
import { type ContactAnswer, contactMessageSchema } from "./contact-message.ts";
import { contactLimits } from "./contact-rate-limit.server.ts";
import { findPublishedEntryPath, insertContactSubmission } from "./contact-store.server.ts";
import { checkContactToken } from "./contact-token.server.ts";

// A contact form is well under 8 KiB (5,000 characters plus short fields).
const MAX_BODY_BYTES = 16 * 1024;

function answer(path: string, code: ContactAnswer): Response {
  return redirect(`${path}?contact=${code}`, 303);
}

function declaredSizeAllowed(headers: Headers): boolean {
  const declared = headers.get("Content-Length");
  if (declared === null || !/^[0-9]+$/.test(declared)) return false;
  return Number(declared) <= MAX_BODY_BYTES;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

// React Router answers a GET to an action-only route with 400, so the loader
// says 405 itself.
export function loader() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

/**
 * A visitor's message (item 19a). Resource route. Root middleware has already resolved the site from the host (a suspended
 * site never resolves, so it answers 404) and checked the origin.
 */
export async function action({ request, context }: Route.ActionArgs) {
  // Before the body is read: a missing or non-numeric length is refused too,
  // which a browser's form post never sends.
  if (!declaredSizeAllowed(request.headers)) {
    throw new Response("Payload Too Large", { status: 413 });
  }

  const siteId = context.get(siteContext).id;
  const ip = clientIp(request.headers);
  const form = await request.formData();

  // Every answer goes back to the page the form was on; an unknown, draft or
  // other site's entry falls back to the home address.
  const entryId = z.uuid().safeParse(field(form, "entry"));
  const entryPath = entryId.success ? await findPublishedEntryPath(siteId, entryId.data) : null;
  const back = entryPath ?? "/";

  const blockedBy = contactLimits.attempt(siteId, ip);
  if (blockedBy) {
    logSecurityEvent({ event: "contact_rate_limited", scope: blockedBy, siteId, ip });
    return answer(back, "busy");
  }

  if (field(form, "url") !== "") {
    logSecurityEvent({ event: "contact_spam_dropped", reason: "honeypot", siteId, ip });
    return answer(back, "sent");
  }

  if (checkContactToken(field(form, "started"), Date.now()) !== "ok") {
    logSecurityEvent({ event: "contact_spam_dropped", reason: "token", siteId, ip });
    return answer(back, "again");
  }

  const message = contactMessageSchema.safeParse({
    name: field(form, "name"),
    email: field(form, "email"),
    message: field(form, "message"),
  });
  if (!message.success || !entryId.success || entryPath === null) return answer(back, "invalid");

  await insertContactSubmission(siteId, { entryId: entryId.data, ...message.data });
  return answer(back, "sent");
}
