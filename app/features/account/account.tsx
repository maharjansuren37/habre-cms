import { data, Form, redirect, useNavigation } from "react-router";
import { clientIp, rateLimitKeyForIp } from "#app/features/auth/client-ip.ts";
import { serializeSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { signSessionToken } from "#app/features/auth/session-token.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { emailChangeLimits } from "#app/features/signup/resend-rate-limit.server.ts";
import styles from "#app/features/users/user-form.module.css";
import { PASSWORD_MIN_LENGTH } from "#app/features/users/user-input.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/account";
import {
  BUSY,
  cancelEmailChange,
  changeEmailNow,
  changeName,
  changePassword,
  checkCurrentPassword,
  findPendingEmailChange,
  isEmailTakenByAnother,
  requestEmailChange,
  TOO_MANY_ATTEMPTS,
  withCurrentPassword,
} from "./account.server.ts";
import {
  isAccountFormBodyAllowed,
  parseAccountEmail,
  parseAccountIntent,
  parseAccountName,
  parseAccountPassword,
} from "./account-input.ts";
import { emailChangeEmail } from "./email-change-email.ts";

type FieldErrors = {
  name?: string;
  newEmail?: string;
  currentPassword?: string;
  newPassword?: string;
};

// A fixed set: the banner never shows text taken from the URL.
const SAVED_MESSAGE: Record<string, string> = {
  name: "Your name is saved.",
  password: "Your password is saved.",
};
// The new address comes from the database, never from the URL.
const savedEmailMessage = (email: string) => `Your email is now ${email}.`;

export function meta() {
  return [{ title: "Your account - Habre CMS" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const saved = new URL(request.url).searchParams.get("saved");
  const emailOn = isEmailOn(env);
  let savedMessage: string | null = null;
  if (saved === "email" && !emailOn) savedMessage = savedEmailMessage(user.email);
  else if (saved !== null && Object.hasOwn(SAVED_MESSAGE, saved))
    savedMessage = SAVED_MESSAGE[saved];
  const pendingEmail = emailOn ? await findPendingEmailChange(user.id) : null;
  return { name: user.name, email: user.email, emailOn, savedMessage, pendingEmail };
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isAccountFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const user = context.get(userContext);
  const form = await request.formData();
  const intent = parseAccountIntent(form.get("intent"));
  const none = {
    intent: null,
    errors: {} as FieldErrors,
    values: {} as { name?: string; newEmail?: string },
    formError: undefined as string | undefined,
  };

  if (intent === "name") {
    const typed = String(form.get("name") ?? "");
    const result = parseAccountName(typed);
    if (!result.ok) {
      return data(
        {
          ...none,
          intent: "name" as const,
          errors: { name: result.message } as FieldErrors,
          values: { name: typed },
        },
        { status: 400 },
      );
    }
    await changeName(user.id, result.name);
    return redirect("/admin/account?saved=name");
  }

  if (intent === "email") {
    const parsed = parseAccountEmail(form.get("newEmail"), form.get("currentPassword"), user.email);
    if (!parsed.ok) {
      return data(
        {
          ...none,
          intent: "email" as const,
          errors: parsed.errors as FieldErrors,
          values: { newEmail: parsed.typed },
        },
        { status: 400 },
      );
    }
    const typed = String(form.get("newEmail") ?? "");
    const ip = clientIp(request.headers);
    const emailOn = isEmailOn(env);
    const gate = await withCurrentPassword<Awaited<ReturnType<typeof changeEmailNow>>>(
      user,
      ip,
      async () => {
        if (!(await checkCurrentPassword(user.id, parsed.currentPassword))) return { ok: false };
        // Email on changes nothing here; the link is sent below.
        if (emailOn) return { ok: true, value: { ok: true } };
        return { ok: true, value: await changeEmailNow(user.id, parsed.newEmail) };
      },
    );
    const refused = (errors: FieldErrors, formError?: string, status = 400) =>
      data(
        { ...none, intent: "email" as const, errors, formError, values: { newEmail: typed } },
        { status },
      );
    if (gate.status === "blocked") return refused({}, TOO_MANY_ATTEMPTS, 429);
    if (gate.status === "busy") return refused({}, BUSY, 503);
    if (gate.status === "wrong") {
      return refused({ currentPassword: "That's not your current password." });
    }
    if (!gate.value.ok) {
      return refused({ newEmail: "That email is already used by another account." });
    }
    if (!emailOn) {
      logSecurityEvent({ event: "email_changed", userId: user.id });
      return redirect("/admin/account?saved=email");
    }

    if (await isEmailTakenByAnother(user.id, parsed.newEmail)) {
      return refused({ newEmail: "That email is already used by another account." });
    }
    const limited = emailChangeLimits.attempt(rateLimitKeyForIp(ip), parsed.newEmail);
    if (limited) {
      logSecurityEvent({ event: "email_change_rate_limited", scope: limited, ip });
      return refused(
        {},
        limited === "email"
          ? "Too many emails to that address. Try again later."
          : "Too many emails. Try again later.",
        429,
      );
    }
    const issued = await requestEmailChange(user.id, parsed.newEmail);
    const message = emailChangeEmail(env.ADMIN_URL, issued.token, issued.name);
    // Awaited, unlike forgot-password: the person is told whether it went.
    try {
      await sendEmail({ to: parsed.newEmail, subject: message.subject, text: message.text });
    } catch {
      await cancelEmailChange(user.id);
      logSecurityEvent({ event: "email_send_failed", purpose: "email_change", userId: user.id });
      return refused({}, "We couldn't send the email. Try again.", 502);
    }
    logSecurityEvent({ event: "email_change_requested", userId: user.id });
    return redirect("/admin/account?saved=link");
  }

  if (intent === "password") {
    const parsed = parseAccountPassword(form.get("currentPassword"), form.get("newPassword"));
    if (!parsed.ok) {
      return data(
        { ...none, intent: "password" as const, errors: parsed.errors as FieldErrors },
        { status: 400 },
      );
    }
    const gate = await withCurrentPassword<number>(user, clientIp(request.headers), async () => {
      const changed = await changePassword(user.id, parsed.currentPassword, parsed.newPassword);
      return changed.ok ? { ok: true, value: changed.tokenVersion } : { ok: false };
    });
    const refused = (errors: FieldErrors, formError?: string, status = 400) =>
      data({ ...none, intent: "password" as const, errors, formError }, { status });
    if (gate.status === "blocked") return refused({}, TOO_MANY_ATTEMPTS, 429);
    if (gate.status === "busy") return refused({}, BUSY, 503);
    if (gate.status === "wrong") {
      return refused({ currentPassword: "That's not your current password." });
    }
    logSecurityEvent({ event: "password_changed", userId: user.id });
    const token = await signSessionToken(
      { userId: user.id, tokenVersion: gate.value },
      env.JWT_SECRET,
    );
    return redirect("/admin/account?saved=password", {
      headers: { "Set-Cookie": await serializeSessionCookie(token) },
    });
  }

  throw data("Bad Request", { status: 400 });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { name, email, emailOn, savedMessage, pendingEmail } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const isSaving = submitting === "name";
  const isSavingEmail = submitting === "email";
  const isSavingPassword = submitting === "password";
  const nameForm = actionData?.intent === "name" ? actionData : null;
  const emailForm = actionData?.intent === "email" ? actionData : null;
  const passwordForm = actionData?.intent === "password" ? actionData : null;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Your account</h1>
      </div>
      {savedMessage && <Message tone="success" title={savedMessage} className={styles.banner} />}
      <div className={styles.form}>
        <section className={styles.section} aria-labelledby="account-name-heading">
          <h2 className={styles.sectionTitle} id="account-name-heading">
            Name
          </h2>
          <Form method="post" className={styles.actionForm}>
            <input type="hidden" name="intent" value="name" />
            <Field
              label="Name"
              name="name"
              autoComplete="name"
              defaultValue={nameForm?.values.name ?? name}
              error={nameForm?.errors.name}
            />
            <Button type="submit" variant="primary" isPending={isSaving}>
              {isSaving ? "Saving…" : "Save name"}
            </Button>
          </Form>
        </section>
        <section className={styles.section} aria-labelledby="account-email-heading">
          <h2 className={styles.sectionTitle} id="account-email-heading">
            Email
          </h2>
          {pendingEmail && (
            <Message
              tone="success"
              title={`We sent a link to ${pendingEmail}. It works for 24 hours.`}
            />
          )}
          {emailForm?.formError && <Message tone="error" title={emailForm.formError} />}
          <div className={styles.readOnly}>
            <span className={styles.readOnlyLabel}>Current email</span>
            <span>{email}</span>
          </div>
          <Form method="post" className={styles.actionForm}>
            <input type="hidden" name="intent" value="email" />
            <Field
              label="New email"
              name="newEmail"
              type="email"
              autoComplete="email"
              defaultValue={emailForm?.values.newEmail}
              error={emailForm?.errors.newEmail}
            />
            <Field
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              error={emailForm?.errors.currentPassword}
            />
            <Button type="submit" variant="primary" isPending={isSavingEmail}>
              {emailOn
                ? isSavingEmail
                  ? "Sending…"
                  : "Send a confirmation link"
                : isSavingEmail
                  ? "Saving…"
                  : "Save email"}
            </Button>
          </Form>
        </section>
        <section className={styles.section} aria-labelledby="account-password-heading">
          <h2 className={styles.sectionTitle} id="account-password-heading">
            Password
          </h2>
          {passwordForm?.formError && <Message tone="error" title={passwordForm.formError} />}
          <Form method="post" className={styles.actionForm}>
            <input type="hidden" name="intent" value="password" />
            <Field
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              error={passwordForm?.errors.currentPassword}
            />
            <Field
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
              error={passwordForm?.errors.newPassword}
            />
            <Button type="submit" variant="primary" isPending={isSavingPassword}>
              {isSavingPassword ? "Saving…" : "Save password"}
            </Button>
          </Form>
        </section>
      </div>
    </>
  );
}
