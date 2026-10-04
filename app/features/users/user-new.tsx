import { data, Form, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { hashPassword } from "#app/features/auth/password.server.ts";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { Button } from "#app/lib/ui/button.tsx";
import fieldStyles from "#app/lib/ui/field.module.css";
import { Field } from "#app/lib/ui/field.tsx";
import type { Route } from "./+types/user-new";
import styles from "./user-form.module.css";
import { createUserSchema, isUserFormBodyAllowed } from "./user-input.ts";
import { createUser } from "./users.server.ts";

// Admin only (project-plan.md's routes table); the nav hides the link too
// (admin-shell/layout.tsx) and a non-admin gets the same 404 an ownership
// refusal already gives (require-role.server.ts).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

const ROLE_OPTIONS = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
] as const;

type NewUserFieldErrors = { email?: string; name?: string; password?: string; role?: string };
type NewUserValues = { email: string; name: string; role: string };

export function meta(_: Route.MetaArgs) {
  return [{ title: "New user - Habre CMS" }];
}

function stringField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isUserFormBodyAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const values: NewUserValues = {
    email: stringField(form, "email"),
    name: stringField(form, "name"),
    role: stringField(form, "role"),
  };
  const parsed = createUserSchema.safeParse({ ...values, password: stringField(form, "password") });
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return data(
      {
        fieldErrors: {
          email: fieldErrors.email?.[0],
          name: fieldErrors.name?.[0],
          password: fieldErrors.password?.[0],
          role: fieldErrors.role?.[0],
        } satisfies NewUserFieldErrors,
        values,
      },
      { status: 400 },
    );
  }

  const result = await createUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    siteId: context.get(userContext).siteId,
  });
  if (!result.ok) {
    const fieldErrors: NewUserFieldErrors = { email: "That email is already in use." };
    return data(
      {
        fieldErrors,
        values: { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role },
      },
      { status: 400 },
    );
  }

  return redirect(`/admin/users/${result.user.id}?created=1`);
}

export default function NewUser({ actionData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state === "submitting";
  const fieldErrors = actionData?.fieldErrors ?? {};
  const values = actionData?.values ?? { email: "", name: "", role: "author" };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>New user</h1>
      </div>
      <Form method="post" className={styles.form}>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={values.email}
          error={fieldErrors.email}
          required
        />
        <Field
          label="Name"
          name="name"
          defaultValue={values.name}
          error={fieldErrors.name}
          required
        />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={values.role}
            className={fieldStyles.input}
            aria-invalid={fieldErrors.role ? true : undefined}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.role && <p className={fieldStyles.error}>{fieldErrors.role}</p>}
        </div>
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
          required
        />
        <Button type="submit" variant="primary" isPending={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create user"}
        </Button>
      </Form>
    </>
  );
}
