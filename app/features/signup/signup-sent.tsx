import { data, Form, useNavigation } from "react-router";
import { clientIp, rateLimitKeyForIp } from "#app/features/auth/client-ip.ts";
import { emailSchema } from "#app/features/users/user-input.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/signup-sent";
import { readPendingEmail, serializePendingEmailCookie } from "./pending-email-cookie.server.ts";
import { reissueVerifyToken } from "./resend.server.ts";
import { resendLimits } from "./resend-rate-limit.server.ts";
import styles from "./signup.module.css";
import { isSignupBodyAllowed } from "./signup-input.ts";
import { verificationEmail } from "./verification-email.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Check your email - Habre" }];
}

// Signup is off by default: a self-hosted copy and today's production answer 404.
function requireSignupOn() {
  if (env.SIGNUP_MODE === "off") throw data("Not Found", { status: 404 });
}

export async function loader({ request }: Route.LoaderArgs) {
  requireSignupOn();
  return {
    email: await readPendingEmail(request),
    failed: new URL(request.url).searchParams.get("failed") === "1",
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireSignupOn();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  // The cookie names the address when we know it; otherwise the typed field.
  const typed = form.get("email");
  const raw = (await readPendingEmail(request)) ?? (typeof typed === "string" ? typed : "");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return data(
      { reply: null, limited: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const email = parsed.data;

  const ip = clientIp(request.headers);
  // Every request that passes validation counts, whether or not an account
  // exists, so the limits cannot be used to tell.
  const limited = resendLimits.attempt(rateLimitKeyForIp(ip), email);
  if (limited) {
    logSecurityEvent({ event: "resend_rate_limited", scope: limited, ip });
    return data({ reply: null, limited: true, error: null }, { status: 429 });
  }

  const issued = await reissueVerifyToken(email);
  if (issued) {
    logSecurityEvent({ event: "verification_resent", userId: issued.userId });
    const message = verificationEmail(env.ADMIN_URL, issued.token, issued.name);
    // Not awaited: the answer is the same for every address, and waiting for
    // the mail server would make a real account answer slower than a missing
    // one. A failed send is logged; the person asks again if nothing arrives.
    sendEmail({ to: email, subject: message.subject, text: message.text }).catch(() => {
      logSecurityEvent({ event: "email_send_failed", purpose: "verify", userId: issued.userId });
    });
  }
  return data(
    {
      reply: `If ${email} is waiting to be confirmed, we’ve sent a new link.`,
      limited: false,
      error: null,
    },
    { headers: { "Set-Cookie": await serializePendingEmailCookie(email) } },
  );
}

export default function SignupSent({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const { email, failed } = loaderData;

  return (
    <div className={`${styles.auth} ${styles.single}`}>
      <main className={styles.main}>
        <div className={styles.inner}>
          <span className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              h
            </span>{" "}
            habre
          </span>

          <h1>Check your email</h1>
          <p className={styles.lede}>
            {email ? `We sent a link to ${email}.` : "Enter your email and we’ll send you a link."}{" "}
            Open it to confirm your address and get into your website.
          </p>

          {failed && !actionData && (
            <Message tone="error" title="We couldn’t send the email.">
              Press Send it again to try once more.
            </Message>
          )}
          {actionData?.limited && (
            <Message tone="error" title="Too many requests, wait an hour.">
              Then press Send it again.
            </Message>
          )}
          {actionData?.reply && (
            <Message tone="success" title={actionData.reply}>
              It can take a minute to arrive. Check your spam folder too.
            </Message>
          )}

          <Form method="post" className={styles.form} noValidate>
            {!email && (
              <Field
                id="sent-email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                error={actionData?.error ?? undefined}
                required
              />
            )}
            <Button
              type="submit"
              variant="primary"
              className={styles.submit}
              isPending={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send it again"}
            </Button>
          </Form>
        </div>
      </main>
    </div>
  );
}
