import { data, redirect } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import type { Route } from "./+types/post-new";
import { createDraft } from "./entries.server.ts";
import { EntryForm } from "./entry-form.tsx";
import { isEntryBodySizeAllowed, parseEntryForm } from "./entry-form-input.ts";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

// The loader is what makes a client-side navigation call the server, so the
// middleware checks the user on those too (React Router middleware docs).
export async function loader(_: Route.LoaderArgs) {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "New post - Habre CMS" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isEntryBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = parseEntryForm(await request.formData(), "post");
  if (!form.ok)
    return data({ problem: { kind: "invalid" as const, message: form.message } }, { status: 400 });

  const user = context.get(userContext);
  const entry = await createDraft("post", { title: form.title, blocks: form.blocks }, user.id);
  // The address is chosen here, so the editor moves to the saved post's own URL.
  return redirect(`/admin/posts/${entry.id}`);
}

export default function NewPost({ actionData }: Route.ComponentProps) {
  return (
    <EntryForm
      entryType="post"
      title=""
      slug=""
      blocks={[]}
      status="draft"
      version={1}
      problem={actionData?.problem ?? null}
    />
  );
}
