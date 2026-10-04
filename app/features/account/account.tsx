import { data, Form, redirect, useNavigation } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import styles from "#app/features/users/user-form.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/account";
import { changeName } from "./account.server.ts";
import { isAccountFormBodyAllowed, parseAccountIntent, parseAccountName } from "./account-input.ts";

// A fixed set: the banner never shows text taken from the URL.
const SAVED_MESSAGE: Record<string, string> = {
  name: "Your name is saved.",
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

  if (intent === "name") {
    const typed = String(form.get("name") ?? "");
    const result = parseAccountName(typed);
    if (!result.ok) {
      return data({ errors: { name: result.message }, values: { name: typed } }, { status: 400 });
    }
    await changeName(user.id, result.name);
    return redirect("/admin/account?saved=name");
  }

  throw data("Bad Request", { status: 400 });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { name, savedMessage } = loaderData;
  const navigation = useNavigation();
  const isSaving =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "name";

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
              defaultValue={actionData?.values.name ?? name}
              error={actionData?.errors.name}
            />
            <Button type="submit" variant="primary" isPending={isSaving}>
              {isSaving ? "Saving…" : "Save name"}
            </Button>
          </Form>
        </section>
      </div>
    </>
  );
}
