import {
  data,
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
} from "react-router";
import { clientIp } from "#app/features/auth/client-ip.ts";
import { serializeClearedSessionCookie } from "#app/features/auth/session-cookie.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { deleteObject } from "#app/features/media/r2.server.ts";
import { sendEmail } from "#app/lib/email.server.ts";
import { isEmailOn } from "#app/lib/email-env.server.ts";
import { env } from "#app/lib/env.server.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/account-delete";
import {
  BUSY,
  checkCurrentPassword,
  deleteAccount,
  findDeletion,
  TOO_MANY_ATTEMPTS,
  withCurrentPassword,
} from "./account.server.ts";
import styles from "./account-delete.module.css";
import {
  ADDRESS_MISMATCH,
  addressMatches,
  isDeleteFormBodyAllowed,
  parseDeleteExpect,
  parseDeleteForm,
} from "./account-delete-input.ts";
import { notifyMembers, removeStorageObjects } from "./site-deleted-cleanup.ts";

/** "1 post", "2 posts". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "A", "A and B", "A, B and C". */
function nameList(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const REFUSED =
  "This is the platform's main site, so it can't be deleted yet. Make another member an admin first, then delete your account.";
const CHANGED = "Something changed on your site. Check what will be deleted and try again.";

/**
 * React Router skips revalidation after a 4xx action. A 409 means the case
 * changed, so the loader runs again and the screen shows what will now be
 * deleted (F-263).
 */
export function shouldRevalidate({
  actionStatus,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return actionStatus === 409 || defaultShouldRevalidate;
}

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
  const refused = (
    errors: { address?: string; currentPassword?: string },
    formError?: string,
    status = 400,
    typedAddress = "",
  ) => data({ errors, formError, typedAddress }, { status });

  const parsed = parseDeleteForm(expect, form.get("address"), form.get("currentPassword"));
  if (!parsed.ok) return refused(parsed.errors, undefined, 400, parsed.typedAddress);
  if (parsed.expect === "site") {
    const deletion = await findDeletion(user.siteId, user.id);
    if (!deletion) throw data("Not Found", { status: 404 });
    if (!addressMatches(parsed.address, deletion.address)) {
      return refused({ address: ADDRESS_MISMATCH }, undefined, 400, parsed.address);
    }
  }

  const ip = clientIp(request.headers);
  const gate = await withCurrentPassword<undefined>(user, ip, async () => {
    if (!(await checkCurrentPassword(user.id, parsed.currentPassword))) return { ok: false };
    return { ok: true, value: undefined };
  });
  if (gate.status === "blocked") return refused({}, TOO_MANY_ATTEMPTS, 429);
  if (gate.status === "busy") return refused({}, BUSY, 503);
  if (gate.status === "wrong") {
    return refused({ currentPassword: "That's not your current password." });
  }
  // The slot is released: the transaction may wait on the site's lock (F-265).
  const result = await deleteAccount(user.siteId, user.id, parsed.expect);
  if (!result.ok) {
    return refused({}, result.reason === "refused" ? REFUSED : CHANGED, 409);
  }
  logSecurityEvent({
    event: "account_deleted",
    userId: user.id,
    siteId: user.siteId,
    siteDeleted: result.siteDeleted,
  });
  // After the commit, and not awaited: the person is not kept waiting for R2 or
  // the mail server. Both functions catch everything, so nothing can reject.
  const { storageKeys, otherMembers, address } = result;
  void removeStorageObjects(storageKeys, deleteObject, console.error);
  if (isEmailOn(env)) {
    void notifyMembers(otherMembers, address, sendEmail, () =>
      logSecurityEvent({
        event: "email_send_failed",
        purpose: "site_deleted_notice",
        userId: user.id,
      }),
    );
  }
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
          {loaderData.site ? (
            <p>
              Your site <strong>{loaderData.address}</strong> is deleted with your account:{" "}
              {plural(loaderData.site.posts, "post")}, {plural(loaderData.site.pages, "page")},{" "}
              {plural(loaderData.site.images, "image")}, and{" "}
              {loaderData.site.otherMemberNames.length === 0
                ? "no other members"
                : `the accounts of ${nameList(loaderData.site.otherMemberNames)}`}
              .
            </p>
          ) : (
            <p>
              You'll be signed out and can't sign in again. Your posts, pages and images stay on{" "}
              <strong>{loaderData.address}</strong>, credited to Deleted account.
            </p>
          )}
          <Form method="post" className={styles.form}>
            <input type="hidden" name="expect" value={loaderData.case} />
            {loaderData.site && (
              <Field
                label={`Type ${loaderData.address} to confirm`}
                name="address"
                autoComplete="off"
                defaultValue={actionData?.typedAddress}
                error={actionData?.errors.address}
              />
            )}
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
