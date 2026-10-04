import { data, Form, redirect, useNavigation } from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import {
  emailLoginLimiter,
  LOGIN_BLOCK_MINUTES,
  passwordCheckSlots,
} from "#app/features/auth/login-rate-limit.server.ts";
import { serializeSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { signSessionToken } from "#app/features/auth/session-token.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import styles from "#app/features/users/user-form.module.css";
import { PASSWORD_MIN_LENGTH } from "#app/features/users/user-input.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/account";
import { changeName, changePassword } from "./account.server.ts";
import {
  isAccountFormBodyAllowed,
  parseAccountIntent,
  parseAccountName,
  parseAccountPassword,
} from "./account-input.ts";

type FieldErrors = { name?: string; currentPassword?: string; newPassword?: string };

// A fixed set: the banner never shows text taken from the URL.
const SAVED_MESSAGE: Record<string, string> = {
  name: "Your name is saved.",
  password: "Your password is saved.",
};

export function meta() {
  return [{ title: "Your account - Habre CMS" }];
}

export function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const saved = new URL(request.url).searchParams.get("saved");
  const savedMessage =
    saved !== null && Object.hasOwn(SAVED_MESSAGE, saved) ? SAVED_MESSAGE[saved] : null;
  return { name: user.name, savedMessage };
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
    values: {} as { name?: string },
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

  if (intent === "password") {
    const parsed = parseAccountPassword(form.get("currentPassword"), form.get("newPassword"));
    if (!parsed.ok) {
      return data(
        { ...none, intent: "password" as const, errors: parsed.errors as FieldErrors },
        { status: 400 },
      );
    }
    // Checked like a login, keyed by the account's current email: the limiter,
    // a slot, then the password work; the attempt is counted before it (F-08).
    if (emailLoginLimiter.isBlocked(user.email)) {
      return data(
        {
          ...none,
          intent: "password" as const,
          formError: `Too many attempts. Try again in ${LOGIN_BLOCK_MINUTES} minutes.`,
        },
        { status: 429 },
      );
    }
    if (!passwordCheckSlots.tryAcquire()) {
      return data(
        { ...none, intent: "password" as const, formError: "Busy, try again in a minute." },
        { status: 503 },
      );
    }
    emailLoginLimiter.recordFailure(user.email);
    let result: Awaited<ReturnType<typeof changePassword>>;
    try {
      result = await changePassword(user.id, parsed.currentPassword, parsed.newPassword);
    } catch (error) {
      // An error checked no password, so it is not a failed attempt.
      emailLoginLimiter.forgive(user.email);
      throw error;
    } finally {
      passwordCheckSlots.release();
    }
    if (!result.ok) {
      logSecurityEvent({
        event: "account_password_refused",
        userId: user.id,
        ip: clientIp(request.headers),
      });
      return data(
        {
          ...none,
          intent: "password" as const,
          errors: { currentPassword: "That's not your current password." } as FieldErrors,
        },
        { status: 400 },
      );
    }
    // A right password takes this attempt back but does not reset the counter.
    emailLoginLimiter.forgive(user.email);
    logSecurityEvent({ event: "password_changed", userId: user.id });
    const token = await signSessionToken(
      { userId: user.id, tokenVersion: result.tokenVersion },
      env.JWT_SECRET,
    );
    return redirect("/admin/account?saved=password", {
      headers: { "Set-Cookie": await serializeSessionCookie(token) },
    });
  }

  throw data("Bad Request", { status: 400 });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { name, savedMessage } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const isSaving = submitting === "name";
  const isSavingPassword = submitting === "password";
  const nameForm = actionData?.intent === "name" ? actionData : null;
  const passwordForm = actionData?.intent === "password" ? actionData : null;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Your account</h1>
      </div>
      {savedMessage && <Message tone="success" title={savedMessage} className={styles.banner} />}
      <div className={styles.form}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Name</h2>
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
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Password</h2>
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
