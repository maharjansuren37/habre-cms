import { data, Form, Link, redirect, useNavigation } from "react-router";
import {
  emailLoginLimiter,
  passwordCheckSlots,
} from "#app/features/auth/login-rate-limit.server.ts";
import { hashPassword } from "#app/features/auth/password.server.ts";
import { serializeSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { signSessionToken } from "#app/features/auth/session-token.server.ts";
import { newPasswordSchema, PASSWORD_MIN_LENGTH } from "#app/features/users/user-input.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/reset-password";
import { completeReset, isResetTokenLive } from "./password-reset.server.ts";
import styles from "./signup.module.css";
import { isSignupBodyAllowed } from "./signup-input.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Choose a new password - Habre" }];
}

// Reset is on exactly when email is configured; otherwise the page is Not Found.
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
// Only the form's POST does.
export async function loader({ request }: Route.LoaderArgs) {
  requireEmailOn();
  const token = cleanToken(new URL(request.url).searchParams.get("token"));
  return { token: token && (await isResetTokenLive(token)) ? token : null };
}

export async function action({ request }: Route.ActionArgs) {
  requireEmailOn();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const token = cleanToken(form.get("token"));
  if (!token) return { state: "expired" as const };

  const typed = form.get("password");
  const parsed = newPasswordSchema.safeParse(typeof typed === "string" ? typed : "");
  if (!parsed.success) {
    return data(
      { state: "form" as const, token, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // Before any scrypt work, so a guessed token costs no hash.
  if (!(await isResetTokenLive(token))) return { state: "expired" as const };

  if (!passwordCheckSlots.tryAcquire()) {
    return data({ state: "form" as const, token, busy: true }, { status: 503 });
  }
  let done: Awaited<ReturnType<typeof completeReset>>;
  try {
    done = await completeReset(token, await hashPassword(parsed.data));
  } finally {
    passwordCheckSlots.release();
  }
  if (!done) return { state: "expired" as const };

  const session = await signSessionToken(
    { userId: done.userId, tokenVersion: done.tokenVersion },
    env.JWT_SECRET,
  );
  // The reset proved the person holds the mailbox, so failed logins before it
  // no longer lock them out (F-244).
  emailLoginLimiter.reset(done.email);
  logSecurityEvent({ event: "password_reset_completed", userId: done.userId });
  return redirect("/admin", { headers: { "Set-Cookie": await serializeSessionCookie(session) } });
}

export default function ResetPassword({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const state = actionData?.state ?? (loaderData.token ? "form" : "expired");
  const token = actionData && "token" in actionData ? actionData.token : loaderData.token;
  const error = actionData && "error" in actionData ? actionData.error : undefined;
  const busy = actionData && "busy" in actionData;

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

          {state === "form" && (
            <>
              <h1>Choose a new password</h1>
              {busy && <Message tone="error" title="Busy, try again in a minute." />}
              <Form method="post" className={styles.form} noValidate>
                <input type="hidden" name="token" value={token ?? ""} />
                <Field
                  id="reset-password"
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
                  error={error}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.submit}
                  isPending={isSubmitting}
                >
                  {isSubmitting ? "Saving…" : "Save and log in"}
                </Button>
              </Form>
            </>
          )}

          {state === "expired" && (
            <>
              <h1>Reset your password</h1>
              <Message tone="error" title="This link has expired or was already used." />
              <Link to="/forgot-password">Ask for a new link</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
