import { data, redirect } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import type { Route } from "./+types/post-new";
import { createDraft } from "./entries.server.ts";
import { PostForm } from "./post-form.tsx";
import { isPostBodySizeAllowed, parsePostForm } from "./post-form-input.ts";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

export function meta(_: Route.MetaArgs) {
  return [{ title: "New post - Habre CMS" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isPostBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = parsePostForm(await request.formData());
  if (!form.ok)
    return data({ problem: { kind: "invalid" as const, message: form.message } }, { status: 400 });

  const user = context.get(userContext);
  const entry = await createDraft({ title: form.title, blocks: form.blocks }, user.id);
  // The address is chosen here, so the editor moves to the saved post's own URL.
  return redirect(`/admin/posts/${entry.id}`);
}

export default function NewPost({ actionData }: Route.ComponentProps) {
  return (
    <PostForm title="" slug="" blocks={[]} version={1} problem={actionData?.problem ?? null} />
  );
}
