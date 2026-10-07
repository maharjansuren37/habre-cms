import { data, Form, Link, redirect, useNavigation } from "react-router";
import { serializeSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { signSessionToken } from "#app/features/auth/session-token.server.ts";
import { sql } from "#app/lib/db.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/verify";
import { hashEmailToken } from "./email-token-hash.ts";
import { readPendingEmail } from "./pending-email-cookie.server.ts";
import styles from "./signup.module.css";
import { isSignupBodyAllowed } from "./signup-input.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Confirm your email - Habre" }];
}

// Signup is off by default: a self-hosted copy and today's production answer 404.
function requireSignupOn() {
  if (env.SIGNUP_MODE === "off") throw data("Not Found", { status: 404 });
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
  requireSignupOn();
  return {
    token: cleanToken(new URL(request.url).searchParams.get("token")),
    email: await readPendingEmail(request),
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireSignupOn();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const token = cleanToken((await request.formData()).get("token"));
  const email = await readPendingEmail(request);
  if (!token) return { state: "expired" as const, email };

  const hash = hashEmailToken(token);
  // One transaction, so a token is never used up without its account being
  // confirmed. The update is the only place a token is used: its `where`
  // makes "once" and "within 24 hours" atomic.
  const confirmed = await sql.begin(async (tx) => {
    const [used] = await tx<{ userId: string }[]>`
      update email_tokens set used_at = now()
      where token_hash = ${hash} and purpose = 'verify'
        and used_at is null and expires_at > now()
      returning user_id as "userId"
    `;
    if (!used) return null;
    const [user] = await tx<{ tokenVersion: number }[]>`
      update users
      set email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
      where id = ${used.userId}
      returning token_version as "tokenVersion"
    `;
    return { userId: used.userId, tokenVersion: user.tokenVersion };
  });

  if (!confirmed) {
    // Say "already confirmed" only to someone holding one of that account's
    // verify links; anyone else gets the plain expired-or-used answer.
    const [owner] = await sql<{ confirmed: boolean }[]>`
      select u.email_verified_at is not null as confirmed
      from email_tokens t join users u on u.id = t.user_id
      where t.token_hash = ${hash} and t.purpose = 'verify'
    `;
    return { state: owner?.confirmed ? ("confirmed" as const) : ("expired" as const), email };
  }

  const session = await signSessionToken(
    { userId: confirmed.userId, tokenVersion: confirmed.tokenVersion },
    env.JWT_SECRET,
  );
  logSecurityEvent({ event: "email_verified", userId: confirmed.userId });
  return redirect("/start", { headers: { "Set-Cookie": await serializeSessionCookie(session) } });
}

export default function Verify({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const state = actionData?.state ?? (loaderData.token ? "confirm" : "expired");
  const email = actionData?.email ?? loaderData.email;

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

          {state === "confirm" && (
            <>
              <h1>Confirm your email</h1>
              <p className={styles.lede}>
                Press the button to confirm your address and get into your website.
              </p>
              <Form method="post" className={styles.form}>
                <input type="hidden" name="token" value={loaderData.token ?? ""} />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.submit}
                  isPending={isSubmitting}
                >
                  {isSubmitting ? "Confirming…" : "Confirm my email"}
                </Button>
              </Form>
            </>
          )}

          {state === "confirmed" && (
            <>
              <h1>Your email is already confirmed</h1>
              <p className={styles.lede}>You can log in to your website.</p>
              <Link to="/admin/login">Log in</Link>
            </>
          )}

          {state === "expired" && (
            <>
              <h1>Confirm your email</h1>
              <Message tone="error" title="This link has expired or was already used.">
                Ask for a new one below.
              </Message>
              <Form method="post" action="/signup/sent" className={styles.form} noValidate>
                {!email && (
                  <Field
                    id="verify-email"
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                )}
                <Button type="submit" variant="primary" className={styles.submit}>
                  Send me a new link
                </Button>
              </Form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
