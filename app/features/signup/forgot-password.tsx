import { data, Form, Link, useNavigation } from "react-router";
import { clientIp, rateLimitKeyForIp } from "#app/features/auth/client-ip.ts";
import { emailSchema } from "#app/features/users/user-input.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/forgot-password";
import { issueResetToken } from "./password-reset.server.ts";
import { resetRequestLimits } from "./resend-rate-limit.server.ts";
import { resetEmail } from "./reset-email.ts";
import styles from "./signup.module.css";
import { isSignupBodyAllowed } from "./signup-input.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Reset your password - Habre" }];
}

// Reset is on exactly when email is configured; otherwise the page is Not Found.
function requireEmailOn() {
  if (!isEmailOn(env)) throw data("Not Found", { status: 404 });
}

export function loader() {
  requireEmailOn();
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  requireEmailOn();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const typed = form.get("email");
  const raw = typeof typed === "string" ? typed : "";
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return data(
      { reply: null, limited: false, error: parsed.error.issues[0].message, typed: raw },
      { status: 400 },
    );
  }
  const email = parsed.data;

  const ip = clientIp(request.headers);
  // Every valid request counts, whether or not an account exists, so the
  // limits cannot be used to tell.
  const limited = resetRequestLimits.attempt(rateLimitKeyForIp(ip), email);
  if (limited) {
    logSecurityEvent({ event: "reset_rate_limited", scope: limited, ip });
    return data({ reply: null, limited: true, error: null, typed: raw }, { status: 429 });
  }

  const issued = await issueResetToken(email);
  if (issued) {
    logSecurityEvent({ event: "password_reset_requested", userId: issued.userId });
    const message = resetEmail(env.ADMIN_URL, issued.token, issued.name);
    // Not awaited: the answer is the same for every address, and waiting for
    // the mail server would make a real account answer slower than a missing
    // one. A failed send is logged; the person asks again if nothing arrives.
    sendEmail({ to: email, subject: message.subject, text: message.text }).catch(() => {
      logSecurityEvent({ event: "email_send_failed", purpose: "reset", userId: issued.userId });
    });
  }
  return data({
    reply: `If an account uses ${email}, we’ve sent a link to reset its password.`,
    limited: false,
    error: null,
    typed: raw,
  });
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";

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

          <h1>Reset your password</h1>
          <p className={styles.lede}>
            Enter the email you log in with and we’ll send you a link to choose a new password.
          </p>

          {actionData?.limited && (
            <Message tone="error" title="Too many requests, wait an hour.">
              Then ask for a link again.
            </Message>
          )}
          {actionData?.reply && (
            <Message tone="success" title={actionData.reply}>
              It can take a minute to arrive. Check your spam folder too. The link works for 1 hour.
            </Message>
          )}

          <Form method="post" className={styles.form} noValidate>
            <Field
              id="forgot-email"
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={actionData?.typed ?? ""}
              error={actionData?.error ?? undefined}
              required
            />
            <Button
              type="submit"
              variant="primary"
              className={styles.submit}
              isPending={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send me a link"}
            </Button>
          </Form>

          <p className={styles.foot}>
            <Link to="/admin/login">Back to log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
