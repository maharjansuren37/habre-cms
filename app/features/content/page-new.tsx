import { data, redirect } from "react-router";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { sectionsFromBlocks } from "#app/features/blocks/blocks.ts";
import type { Route } from "./+types/page-new";
import { createDraft } from "./entries.server.ts";
import { EntryForm } from "./entry-form.tsx";
import { isEntryBodySizeAllowed, parseEntryForm } from "./entry-form-input.ts";

// Outside the admin-shell layout (routes.ts), same as post-new.tsx - the
// editor drops the sidebar - so this route needs both checks itself: login,
// then role.
export const middleware: Route.MiddlewareFunction[] = [
  requireUser,
  requireRole(["admin", "editor"]),
];

// The loader is what makes a client-side navigation call the server, so the
// middleware checks the user on those too (React Router middleware docs).
export async function loader(_: Route.LoaderArgs) {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "New page - Habre CMS" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isEntryBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = parseEntryForm(await request.formData(), "page");
  if (!form.ok)
    return data({ problem: { kind: "invalid" as const, message: form.message } }, { status: 400 });

  const user = context.get(userContext);
  const entry = await createDraft("page", { title: form.title, sections: form.sections }, user.id);
  // The address is chosen here, so the editor moves to the saved page's own URL.
  return redirect(`/admin/pages/${entry.id}`);
}

export default function NewPage({ actionData }: Route.ComponentProps) {
  return (
    <EntryForm
      entryType="page"
      title=""
      slug=""
      sections={sectionsFromBlocks([])}
      status="draft"
      version={1}
      problem={actionData?.problem ?? null}
    />
  );
}
