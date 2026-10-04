import { data, Form, Link, redirect, useNavigation } from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { serializeClearedSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/account-delete";
import {
  BUSY,
  checkCurrentPassword,
  type DeleteAccountResult,
  deleteAccount,
  findDeletion,
  TOO_MANY_ATTEMPTS,
  withCurrentPassword,
} from "./account.server.ts";
import styles from "./account-delete.module.css";
import {
  isDeleteFormBodyAllowed,
  parseDeleteExpect,
  parseDeleteForm,
} from "./account-delete-input.ts";

const REFUSED =
  "This is the platform's main site, so it can't be deleted yet. Make another member an admin first, then delete your account.";
const CHANGED = "Something changed on your site. Check what will be deleted and try again.";

export function meta() {
  return [{ title: "Delete your account - Habre CMS" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const deletion = await findDeletion(user.siteId, user.id);
  if (!deletion) throw data("Not Found", { status: 404 });
  return deletion;
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isDeleteFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const user = context.get(userContext);
  const form = await request.formData();
  const expect = parseDeleteExpect(form.get("expect"));
  if (!expect) throw data("Bad Request", { status: 400 });
  const refused = (errors: { currentPassword?: string }, formError?: string, status = 400) =>
    data({ errors, formError }, { status });

  const parsed = parseDeleteForm(expect, form.get("address"), form.get("currentPassword"));
  if (!parsed.ok) return refused(parsed.errors);

  const ip = clientIp(request.headers);
  const gate = await withCurrentPassword<DeleteAccountResult>(user, ip, async () => {
    if (!(await checkCurrentPassword(user.id, parsed.currentPassword))) return { ok: false };
    return { ok: true, value: await deleteAccount(user.siteId, user.id, parsed.expect) };
  });
  if (gate.status === "blocked") return refused({}, TOO_MANY_ATTEMPTS, 429);
  if (gate.status === "busy") return refused({}, BUSY, 503);
  if (gate.status === "wrong") {
    return refused({ currentPassword: "That's not your current password." });
  }
  if (!gate.value.ok) {
    return refused({}, gate.value.reason === "refused" ? REFUSED : CHANGED, 409);
  }
  logSecurityEvent({
    event: "account_deleted",
    userId: user.id,
    siteId: user.siteId,
    siteDeleted: false,
  });
  // A fixed flag, never text from the URL.
  return redirect("/admin/login?deleted=1", {
    headers: { "Set-Cookie": await serializeClearedSessionCookie() },
  });
}

export default function DeleteAccount({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting";

  return (
    <section className={styles.confirm}>
      <h1 className={styles.title}>Delete your account</h1>
      {actionData?.formError && <Message tone="error" title={actionData.formError} />}
      {loaderData.case === "refused" ? (
        <p>{REFUSED}</p>
      ) : (
        <>
          <p>
            You'll be signed out and can't sign in again. Your posts, pages and images stay on{" "}
            <strong>{loaderData.address}</strong>, credited to Deleted account.
          </p>
          <Form method="post" className={styles.form}>
            <input type="hidden" name="expect" value={loaderData.case} />
            <Field
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              error={actionData?.errors.currentPassword}
            />
            <div className={styles.actions}>
              <Button type="submit" variant="danger" isPending={isDeleting}>
                {isDeleting ? "Deleting…" : "Delete my account"}
              </Button>
              <Link className={`${buttonStyles.button} ${buttonStyles.quiet}`} to="/admin/account">
                Cancel
              </Link>
            </div>
          </Form>
        </>
      )}
      {loaderData.case === "refused" && (
        <div className={styles.actions}>
          <Link className={`${buttonStyles.button} ${buttonStyles.quiet}`} to="/admin/account">
            Back to Your account
          </Link>
        </div>
      )}
    </section>
  );
}
