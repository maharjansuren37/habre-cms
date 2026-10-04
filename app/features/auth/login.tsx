import { data, Form, Link, redirect, useNavigation } from "react-router";
import { serializePendingEmailCookie } from "#app/features/signup/pending-email-cookie.server.ts";
import { findUserByEmail } from "#app/features/users/users.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/login";
import { clientIp, rateLimitKeyForIp } from "./client-ip.ts";
import styles from "./login.module.css";
import { isLoginBodySizeAllowed, parseLoginForm } from "./login-input.ts";
import {
  emailLoginLimiter,
  ipLoginLimiter,
  LOGIN_BLOCK_MINUTES,
  passwordCheckSlots,
} from "./login-rate-limit.server.ts";
import { verifyAgainstDummyHash, verifyPassword } from "./password.server.ts";
import { findSessionUser } from "./require-user.server.ts";
import { safeRedirect } from "./safe-redirect.ts";
import { serializeSessionCookie } from "./session-cookie.server.ts";
import { signSessionToken } from "./session-token.server.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Log in - Habre CMS" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await findSessionUser(request)) throw redirect("/admin");
  return { signupOpen: env.SIGNUP_MODE !== "off", resetByEmail: isEmailOn(env) };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isLoginBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = parseLoginForm(await request.formData());
  if (!form.ok) return data({ fieldErrors: form.fieldErrors, email: "" }, { status: 400 });

  const ip = clientIp(request.headers);
  warnOnceIfProxyHeaderMissing(ip);
  const ipKey = rateLimitKeyForIp(ip);
  // Checked before any password work, so a blocked attempt costs no scrypt run.
  const blockedScope = ipLoginLimiter.isBlocked(ipKey)
    ? "ip"
    : emailLoginLimiter.isBlocked(form.email)
      ? "email"
      : null;
  if (blockedScope) {
    logSecurityEvent({ event: "login_rate_limited", scope: blockedScope, ip });
    return data({ retryAfterMinutes: LOGIN_BLOCK_MINUTES, email: form.email }, { status: 429 });
  }
  if (!passwordCheckSlots.tryAcquire()) {
    logSecurityEvent({ event: "login_rate_limited", scope: "server", ip });
    return data({ serverBusy: true, email: form.email }, { status: 503 });
  }

  // Counted before the password work: counting after it lets every attempt
  // already in flight pass the isBlocked check (F-08). A success takes it back.
  emailLoginLimiter.recordFailure(form.email);
  ipLoginLimiter.recordFailure(ipKey);
  let user: Awaited<ReturnType<typeof checkCredentials>>;
  try {
    user = await checkCredentials(form.email, form.password, ip);
  } catch (error) {
    // An error (e.g. the database is down) checked no password, so it is not a
    // failed attempt: counting it would lock out someone retrying through an outage.
    emailLoginLimiter.forgive(form.email);
    ipLoginLimiter.forgive(ipKey);
    throw error;
  } finally {
    passwordCheckSlots.release();
  }
  if (!user) return data({ credentialsRefused: true, email: form.email }, { status: 400 });

  // A correct password on an account whose email is not confirmed signs no one
  // in: it goes to "Check your email", where a new link can be asked for. It
  // counts as a success for the limiters - the password was right.
  if (!user.emailVerifiedAt) {
    emailLoginLimiter.reset(form.email);
    ipLoginLimiter.forgive(ipKey);
    return redirect("/signup/sent", {
      headers: { "Set-Cookie": await serializePendingEmailCookie(user.email) },
    });
  }

  const token = await signSessionToken(
    { userId: user.id, tokenVersion: user.tokenVersion },
    env.JWT_SECRET,
  );
  emailLoginLimiter.reset(form.email);
  ipLoginLimiter.forgive(ipKey);
  logSecurityEvent({ event: "login_succeeded", userId: user.id, ip });
  const destination = safeRedirect(new URL(request.url).searchParams.get("redirectTo"));
  return redirect(destination, { headers: { "Set-Cookie": await serializeSessionCookie(token) } });
}

let hasWarnedProxyHeaderMissing = false;

// In production Caddy always sets X-Forwarded-For. Without it every visitor is
// keyed as "unknown" and shares one IP limit, so 20 failures lock everyone out.
// Once per process: the point is to notice the misconfiguration, not to flood the journal.
function warnOnceIfProxyHeaderMissing(ip: string) {
  if (ip !== "unknown" || env.NODE_ENV !== "production" || hasWarnedProxyHeaderMissing) return;
  hasWarnedProxyHeaderMissing = true;
  console.warn(
    "Login request without X-Forwarded-For: all such logins share one rate-limit bucket. Check that the app is reached only through Caddy.",
  );
}

// Returns the user only for a correct password on an active account. Every
// refusal does the same scrypt work, so timing does not reveal which emails
// have accounts.
async function checkCredentials(email: string, password: string, ip: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    await verifyAgainstDummyHash(password);
    logSecurityEvent({ event: "login_failed", reason: "unknown_email", ip });
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    logSecurityEvent({ event: "login_failed", reason: "bad_password", userId: user.id, ip });
    return null;
  }
  // No membership is refused exactly like a deactivated one.
  if (!user.membership) {
    logSecurityEvent({ event: "login_failed", reason: "no_membership", userId: user.id, ip });
    return null;
  }
  if (user.membership.deactivatedAt) {
    logSecurityEvent({ event: "login_failed", reason: "deactivated", userId: user.id, ip });
    return null;
  }
  // Last, so a deactivated or memberless account is refused as before. The
  // caller sends this user to "Check your email" instead of signing them in.
  if (!user.emailVerifiedAt) {
    logSecurityEvent({ event: "login_failed", reason: "unverified", userId: user.id, ip });
  }
  return user;
}

export default function Login({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const fieldErrors = actionData && "fieldErrors" in actionData ? actionData.fieldErrors : {};

  return (
    <div className={styles.page}>
      <main className={styles.login}>
        <div className={styles.brand}>
          <h1>Log in to Habre CMS</h1>
          <p>Manage the website’s posts, pages and images.</p>
        </div>

        <Form method="post" className={styles.card}>
          {actionData && "retryAfterMinutes" in actionData && (
            <Message tone="error" title="Too many attempts.">
              Wait {actionData.retryAfterMinutes} minutes, then try again.
            </Message>
          )}
          {actionData && "serverBusy" in actionData && (
            <Message tone="error" title="Login is busy.">
              Try again in a minute.
            </Message>
          )}
          {actionData && "credentialsRefused" in actionData && (
            <Message tone="error" title="That email and password don’t match.">
              Check them and try again.
            </Message>
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={actionData?.email}
            error={fieldErrors.email}
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={fieldErrors.password}
            required
          />
          <Button
            type="submit"
            variant="primary"
            className={styles.submit}
            isPending={isSubmitting}
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
        </Form>

        <p className={styles.help}>
          {loaderData.resetByEmail ? (
            <Link to="/forgot-password">Forgot your password?</Link>
          ) : (
            "Forgot your password? Ask an admin of this site to reset it."
          )}
        </p>
        {loaderData.signupOpen && (
          <p className={styles.help}>
            New to Habre? <Link to="/signup">Create your website</Link>
          </p>
        )}
      </main>
    </div>
  );
}
