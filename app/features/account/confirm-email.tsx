import { data, Form, Link, redirect, useNavigation } from "react-router";
import styles from "#app/features/signup/signup.module.css";
import { isSignupBodyAllowed } from "#app/features/signup/signup-input.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/confirm-email";
import { confirmEmailChange } from "./account.server.ts";
import { emailChangedNotice } from "./email-changed-notice.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Confirm your new email - Habre" }];
}

// Without email there are no links to confirm: a self-hosted copy answers 404.
function requireEmailOn() {
  if (!isEmailOn(env)) throw data("Not Found", { status: 404 });
}

// A real token is 43 characters; anything far longer is not one.
const MAX_TOKEN_LENGTH = 200;

function cleanToken(value: unknown): string | null {
  return typeof value === "string" && value !== "" && value.length <= MAX_TOKEN_LENGTH
    ? value
    : null;
}

// GET changes nothing: a mail scanner that opens the link must not use it up.
// Only the button's POST does.
export async function loader({ request }: Route.LoaderArgs) {
  requireEmailOn();
  return { token: cleanToken(new URL(request.url).searchParams.get("token")) };
}

export async function action({ request }: Route.ActionArgs) {
  requireEmailOn();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const token = cleanToken((await request.formData()).get("token"));
  if (!token) return { state: "expired" as const };

  const result = await confirmEmailChange(token);
  if (!result.ok) return { state: result.state };

  logSecurityEvent({ event: "email_changed", userId: result.userId });
  // Not awaited: the change is done and the notice is best-effort. No session
  // is issued here (D270); a signed-out browser is sent to sign-in and back.
  const notice = emailChangedNotice(result.name);
  sendEmail({ to: result.oldEmail, subject: notice.subject, text: notice.text }).catch(() => {
    logSecurityEvent({
      event: "email_send_failed",
      purpose: "email_changed_notice",
      userId: result.userId,
    });
  });
  return redirect("/admin/account?saved=email");
}

export default function ConfirmEmail({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const state = actionData?.state ?? (loaderData.token ? "confirm" : "expired");

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

          <h1>Confirm your new email</h1>

          {state === "confirm" && (
            <>
              <p className={styles.lede}>
                Press the button to make this address your account's email.
              </p>
              <Form method="post" className={styles.form}>
                <input type="hidden" name="token" value={loaderData.token ?? ""} />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.submit}
                  isPending={isSubmitting}
                >
                  {isSubmitting ? "Confirming…" : "Confirm new email"}
                </Button>
              </Form>
            </>
          )}

          {state === "expired" && (
            <>
              <Message tone="error" title="This link has expired or was already used.">
                Ask for a new one from Your account.
              </Message>
              <Link to="/admin/account">Back to Your account</Link>
            </>
          )}

          {state === "taken" && (
            <>
              <Message tone="error" title="That email is now used by another account." />
              <Link to="/admin/account">Back to Your account</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
