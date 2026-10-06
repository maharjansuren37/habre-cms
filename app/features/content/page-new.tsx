import { data, redirect } from "react-router";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { emptyDocument } from "#app/features/blocks/document.ts";
import type { Route } from "./+types/page-new";
import { createDraft, listLinkablePages } from "./entries.server.ts";
import { ENTRY_TOO_LONG_MESSAGE, isEntryBodySizeAllowed } from "./entry-body-size.ts";
import { EntryForm } from "./entry-form.tsx";
import { parseDocumentForm } from "./entry-form-input.ts";

// Login is checked by editor-layout.tsx; the role is this route's own, as in
// page-list.tsx (F-293).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin", "editor"])];

// Hands over the empty document a new entry starts with, so the schema module
// stays out of the browser bundle.
export async function loader({ context }: Route.LoaderArgs) {
  return {
    document: emptyDocument(),
    mediaById: {},
    pages: await listLinkablePages(context.get(userContext).siteId, context.get(userContext)),
  };
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "New page - Habre CMS" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isEntryBodySizeAllowed(request.headers)) {
    // Returned, not thrown: a thrown 413 replaced the editor with the error
    // page and lost the draft (F-39). The body is never read.
    return data(
      { problem: { kind: "invalid" as const, message: ENTRY_TOO_LONG_MESSAGE } },
      { status: 413 },
    );
  }
  const form = parseDocumentForm(await request.formData(), "page");
  if (!form.ok)
    return data({ problem: { kind: "invalid" as const, message: form.message } }, { status: 400 });

  const user = context.get(userContext);
  const entry = await createDraft(
    user.siteId,
    "page",
    { title: form.title, document: form.document },
    user.id,
  );
  // The address is chosen here, so the editor moves to the saved page's own URL.
  return redirect(`/admin/pages/${entry.id}`);
}

export default function NewPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <EntryForm
      entryType="page"
      title=""
      slug=""
      document={loaderData.document}
      mediaById={loaderData.mediaById}
      pages={loaderData.pages}
      status="draft"
      version={1}
      problem={actionData?.problem ?? null}
    />
  );
}
