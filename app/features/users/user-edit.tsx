import { data, Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { hashPassword } from "#app/features/auth/password.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { logSecurityEvent } from "#app/lib/security-log.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import fieldStyles from "#app/lib/ui/field.module.css";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/user-edit";
import styles from "./user-form.module.css";
import { isUserFormBodyAllowed, newPasswordSchema, roleSchema } from "./user-input.ts";
import {
  deactivateUser,
  findMemberById,
  reactivateUser,
  setUserPassword,
  updateUserRole,
} from "./users.server.ts";

// Admin only (project-plan.md's routes table); the nav hides the link too
// (admin-shell/layout.tsx) and a non-admin gets the same 404 an ownership
// refusal already gives (require-role.server.ts).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

const ROLE_OPTIONS = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
] as const;

const CANNOT_CHANGE_OWN_ROLE = "You can’t change your own role.";
const CANNOT_DEACTIVATE_SELF = "You can’t deactivate your own account.";

const UPDATED_MESSAGE: Record<string, string> = {
  "change-role": "Role updated.",
  "reset-password": "Password reset.",
  deactivate: "User deactivated.",
  reactivate: "User reactivated.",
};

/**
 * A user id that is not a uuid never matches a row, but reaching the database
 * with one raises `invalid input syntax for type uuid` and answers 500. A
 * mistyped or stale address deserves the same 404 a missing user gets.
 *
 * Copied from `post-edit.tsx`'s `requirePostId`, not extracted - its second
 * use; the third is what earns a shared module (fundamentals.md).
 */
function requireUserId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.user.name ?? "User"} - Habre CMS` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const id = requireUserId(params.id);
  const actor = context.get(userContext);
  const user = await findMemberById(actor.siteId, id);
  if (!user) throw data("Not Found", { status: 404 });
  const searchParams = new URL(request.url).searchParams;
  const created = searchParams.get("created") !== null;
  const updated = searchParams.get("updated");
  return { user, isSelf: user.id === actor.id, created, updated };
}

type ActionResult = { problem: string };

export async function action({ params, request, context }: Route.ActionArgs) {
  const id = requireUserId(params.id);
  if (!isUserFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const actor = context.get(userContext);
  const target = await findMemberById(actor.siteId, id);
  if (!target) throw data("Not Found", { status: 404 });

  const isSelf = target.id === actor.id;
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "change-role") {
    // Re-checked here regardless of what the request claims - the UI already
    // hides this form for your own account, but a crafted POST does not go
    // through the UI (current-work.md's Decisions).
    if (isSelf) {
      return data({ problem: CANNOT_CHANGE_OWN_ROLE } satisfies ActionResult, { status: 400 });
    }
    const role = roleSchema.safeParse(form.get("role"));
    if (!role.success) {
      return data(
        { problem: role.error.issues[0]?.message ?? "Choose a role." } satisfies ActionResult,
        { status: 400 },
      );
    }
    const updated = await updateUserRole(actor.siteId, id, role.data);
    if (!updated) throw data("Not Found", { status: 404 });
    logSecurityEvent({
      event: "role_changed",
      userId: id,
      fromRole: target.role,
      toRole: role.data,
      actorId: actor.id,
    });
    return redirect(`/admin/users/${id}?updated=change-role`);
  }

  if (intent === "reset-password") {
    const password = newPasswordSchema.safeParse(form.get("password"));
    if (!password.success) {
      return data(
        {
          problem: password.error.issues[0]?.message ?? "Enter a password.",
        } satisfies ActionResult,
        { status: 400 },
      );
    }
    const updated = await setUserPassword(actor.siteId, id, await hashPassword(password.data));
    if (!updated) throw data("Not Found", { status: 404 });
    logSecurityEvent({ event: "password_reset", userId: id, actorId: actor.id });
    return redirect(`/admin/users/${id}?updated=reset-password`);
  }

  if (intent === "deactivate" || intent === "reactivate") {
    // Same re-check as change-role - the one button toggles between the two,
    // and self-reactivation could never reach here through the UI either,
    // since a deactivated session is refused before it can submit anything.
    if (isSelf) {
      return data({ problem: CANNOT_DEACTIVATE_SELF } satisfies ActionResult, { status: 400 });
    }
    const updated =
      intent === "deactivate"
        ? await deactivateUser(actor.siteId, id)
        : await reactivateUser(actor.siteId, id);
    if (!updated) throw data("Not Found", { status: 404 });
    logSecurityEvent({
      event: intent === "deactivate" ? "user_deactivated" : "user_reactivated",
      userId: id,
      actorId: actor.id,
    });
    return redirect(`/admin/users/${id}?updated=${intent}`);
  }

  return data({ problem: "That action could not be read." } satisfies ActionResult, {
    status: 400,
  });
}

export default function UserEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { user, isSelf, created, updated } = loaderData;
  const navigation = useNavigation();
  const submittedIntent = String(navigation.formData?.get("intent") ?? "");
  const isSaving = (intent: string) =>
    navigation.state === "submitting" && submittedIntent === intent;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>{user.name}</h1>
      </div>
      {created && <Message tone="success" title="User created." className={styles.banner} />}
      {updated && UPDATED_MESSAGE[updated] && (
        <Message tone="success" title={UPDATED_MESSAGE[updated]} className={styles.banner} />
      )}
      {actionData?.problem && (
        <Message tone="error" title={actionData.problem} className={styles.banner} />
      )}
      <div className={styles.form}>
        <div className={styles.readOnly}>
          <span className={styles.readOnlyLabel}>Email</span>
          <span>{user.email}</span>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Role</h2>
          {isSelf ? (
            <p className={styles.hint}>{CANNOT_CHANGE_OWN_ROLE}</p>
          ) : (
            <Form method="post" className={styles.actionForm}>
              <input type="hidden" name="intent" value="change-role" />
              <div className={fieldStyles.field}>
                <label className={fieldStyles.label} htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue={user.role}
                  className={fieldStyles.input}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="primary" isPending={isSaving("change-role")}>
                {isSaving("change-role") ? "Saving…" : "Save"}
              </Button>
            </Form>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Password</h2>
          <Form method="post" className={styles.actionForm}>
            <input type="hidden" name="intent" value="reset-password" />
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
            <Button type="submit" variant="primary" isPending={isSaving("reset-password")}>
              {isSaving("reset-password") ? "Saving…" : "Reset password"}
            </Button>
          </Form>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account status</h2>
          {isSelf ? (
            <p className={styles.hint}>{CANNOT_DEACTIVATE_SELF}</p>
          ) : (
            <Form method="post" className={styles.actionForm}>
              <input
                type="hidden"
                name="intent"
                value={user.deactivatedAt ? "reactivate" : "deactivate"}
              />
              <Button
                type="submit"
                isPending={isSaving(user.deactivatedAt ? "reactivate" : "deactivate")}
              >
                {user.deactivatedAt ? "Reactivate" : "Deactivate"}
              </Button>
            </Form>
          )}
        </section>
      </div>
    </>
  );
}
