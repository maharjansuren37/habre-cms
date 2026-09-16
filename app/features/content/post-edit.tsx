import { data } from "react-router";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import type { Route } from "./+types/post-edit";
import { findEntryForUser, updateDraft } from "./entries.server.ts";
import { PostForm } from "./post-form.tsx";
import { isPostBodySizeAllowed, parsePostForm, parseVersion } from "./post-form-input.ts";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.entry.title ?? "Post"} - Habre CMS` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const entry = await findEntryForUser(params.id, context.get(userContext));
  // A post belonging to someone else is not "forbidden", it is not found: the
  // answer is the same either way, so its existence stays private.
  if (!entry) throw data("Not Found", { status: 404 });
  return { entry };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  if (!isPostBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  const parsed = parsePostForm(form);
  if (!parsed.ok) {
    return data(
      { problem: { kind: "invalid" as const, message: parsed.message } },
      { status: 400 },
    );
  }
  const version = parseVersion(form);
  if (version === null) {
    return data({ problem: { kind: "stale" as const } }, { status: 409 });
  }

  const result = await updateDraft(
    params.id,
    { title: parsed.title, blocks: parsed.blocks },
    version,
    context.get(userContext),
  );
  if (result.ok) return { problem: null, version: result.entry.version };
  if (result.reason === "not_found") throw data("Not Found", { status: 404 });
  return data({ problem: { kind: "stale" as const } }, { status: 409 });
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const { entry } = loaderData;
  return (
    <PostForm
      title={entry.title}
      slug={entry.slug}
      blocks={entry.blocks}
      // After a save the row moved on; the form carries the new version so the
      // next save is not refused as stale.
      version={actionData && "version" in actionData ? actionData.version : entry.version}
      problem={actionData?.problem ?? null}
    />
  );
}
