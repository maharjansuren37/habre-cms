import { useEffect, useRef } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { clientIp, rateLimitKeyForIp } from "#app/features/auth/client-ip.ts";
import { findSessionUser } from "#app/features/auth/require-user.server.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/signup";
import { serializePendingEmailCookie } from "./pending-email-cookie.server.ts";
import styles from "./signup.module.css";
import { createSignup } from "./signup.server.ts";
import { isSignupBodyAllowed, type SignupMode, signupSchema } from "./signup-input.ts";
import { ipSignupLimiter } from "./signup-rate-limit.server.ts";
import { verificationEmail } from "./verification-email.ts";

type FieldName = "name" | "email" | "password" | "address" | "invite";
type FieldErrors = Partial<Record<FieldName, string>>;
// The password is never part of what is sent back.
type Values = Record<Exclude<FieldName, "password">, string>;
// A refusal that belongs to no field.
type Notice = { title: string; body: string } | null;

// The order the fields appear in, which is the order the summary lists them.
const FIELD_ORDER: FieldName[] = ["name", "email", "password", "address", "invite"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Create your website - Habre" }];
}

// Signup is off by default: a self-hosted copy and today's production answer 404.
function requireSignupMode(): SignupMode {
  if (env.SIGNUP_MODE === "off") throw data("Not Found", { status: 404 });
  return env.SIGNUP_MODE;
}

function stringField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function loader({ request }: Route.LoaderArgs) {
  const mode = requireSignupMode();
  if (await findSessionUser(request)) throw redirect("/admin");
  return { mode };
}

export async function action({ request }: Route.ActionArgs) {
  const mode = requireSignupMode();
  if (!isSignupBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const values: Values = {
    name: stringField(form, "name"),
    email: stringField(form, "email"),
    address: stringField(form, "address"),
    invite: stringField(form, "invite"),
  };
  const ip = clientIp(request.headers);
  const ipKey = rateLimitKeyForIp(ip);
  // Every attempt that reaches validation counts, valid or not, and a blocked
  // one costs no password hashing.
  if (ipSignupLimiter.isBlocked(ipKey)) {
    logSecurityEvent({ event: "signup_rate_limited", scope: "ip", ip });
    const notice: Notice = {
      title: "Too many attempts.",
      body: "Wait an hour, then try again.",
    };
    return data({ errors: {} as FieldErrors, values, notice, emailTaken: false }, { status: 429 });
  }
  ipSignupLimiter.recordFailure(ipKey);

  const password = stringField(form, "password");
  const parsed = signupSchema(mode).safeParse({ ...values, password });
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    const errors: FieldErrors = {};
    for (const field of FIELD_ORDER) {
      const message = (fieldErrors as Record<string, string[] | undefined>)[field]?.[0];
      if (message) errors[field] = message;
    }
    return data({ errors, values, notice: null as Notice, emailTaken: false }, { status: 400 });
  }

  const result = await createSignup({ ...parsed.data, password }, mode);
  if (!result.ok && result.reason === "busy") {
    logSecurityEvent({ event: "signup_rate_limited", scope: "server", ip });
    const notice: Notice = { title: "Signup is busy.", body: "Try again in a minute." };
    return data({ errors: {} as FieldErrors, values, notice, emailTaken: false }, { status: 503 });
  }
  if (!result.ok) {
    return data(
      {
        errors: result.errors as FieldErrors,
        values,
        notice: null as Notice,
        emailTaken: result.errors.email !== undefined,
      },
      { status: 400 },
    );
  }

  logSecurityEvent({ event: "signup_created", userId: result.userId, siteId: result.siteId, ip });
  // After the commit: a failed send must not undo the signup. The person is told
  // on the next page and can ask for another link.
  const message = verificationEmail(env.PLATFORM_URL, result.token, parsed.data.name);
  let sendFailed = false;
  try {
    await sendEmail({ to: parsed.data.email, subject: message.subject, text: message.text });
  } catch {
    sendFailed = true;
    logSecurityEvent({ event: "email_send_failed", purpose: "verify", userId: result.userId });
  }
  return redirect(sendFailed ? "/signup/sent?failed=1" : "/signup/sent", {
    headers: { "Set-Cookie": await serializePendingEmailCookie(parsed.data.email) },
  });
}

export default function Signup({ actionData, loaderData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const errors = actionData?.errors ?? {};
  const values = actionData?.values ?? { name: "", email: "", address: "", invite: "" };
  // The form stays on the page after an answer, so the password is cleared by hand.
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (actionData && passwordRef.current) passwordRef.current.value = "";
  }, [actionData]);
  const failed = FIELD_ORDER.filter((field) => errors[field]);

  return (
    <div className={styles.auth}>
      <main className={styles.main}>
        <div className={styles.inner}>
          <span className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              h
            </span>{" "}
            habre
          </span>

          <h1>Create your website</h1>
          <p className={styles.lede}>Free while we’re in beta. No card needed.</p>

          {failed.length > 0 && (
            <Message
              tone="error"
              title={failed.length === 1 ? "One thing to fix" : `${failed.length} things to fix`}
              className={styles.summary}
            >
              {failed.map((field) => (
                <span key={field}>
                  <a href={`#signup-${field}`}>{errors[field]}</a>{" "}
                  {field === "email" && actionData?.emailTaken && (
                    <Link to="/admin/login">Log in</Link>
                  )}{" "}
                </span>
              ))}
            </Message>
          )}
          {actionData?.notice && (
            <Message tone="error" title={actionData.notice.title} className={styles.summary}>
              {actionData.notice.body}
            </Message>
          )}

          <Form method="post" className={styles.form} noValidate>
            <Field
              id="signup-name"
              label="Your name"
              name="name"
              autoComplete="name"
              defaultValue={values.name}
              error={errors.name}
              required
            />
            <Field
              id="signup-email"
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={values.email}
              hint="We’ll send a link to check it’s yours."
              error={errors.email}
              required
            />
            <Field
              id="signup-password"
              ref={passwordRef}
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 12 characters. Enter it again - we never send a password back."
              error={errors.password}
              required
            />
            <Field
              id="signup-address"
              label="Your website’s address"
              name="address"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={values.address}
              hint="Letters, numbers and dashes. You can’t change it later."
              error={errors.address}
              required
            />
            {loaderData.mode === "invite" && (
              <Field
                id="signup-invite"
                label="Invite code"
                name="invite"
                autoCapitalize="characters"
                spellCheck={false}
                defaultValue={values.invite}
                error={errors.invite}
                required
              />
            )}
            <Button
              type="submit"
              variant="primary"
              className={styles.submit}
              isPending={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create my website"}
            </Button>
          </Form>

          <p className={styles.foot}>
            Already have an account? <Link to="/admin/login">Log in</Link>
          </p>
        </div>
      </main>

      <aside className={styles.aside} aria-label="What happens next">
        <p className={styles.quote}>Tell us what you do. We’ll build the first draft.</p>
        <ul className={styles.points}>
          {[
            "Describe your business in a sentence or two - AI drafts your pages, menu and text.",
            "Change anything: drag in text, photos and buttons, and move them around.",
            "Nothing goes live until you press Publish.",
          ].map((point) => (
            <li key={point}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 5 5 9-10" />
              </svg>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className={styles.rings} role="presentation" />
      </aside>
    </div>
  );
}
