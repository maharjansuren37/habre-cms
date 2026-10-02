import { data } from "react-router";
import { z } from "zod";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { resolveDocumentMedia } from "#app/features/public-site/document-media.server.ts";
import type { Route } from "./+types/page-edit";
import { bannerRedirect } from "./banner.ts";
import { findEntryForUser, saveEntry } from "./entries.server.ts";
import { ENTRY_TOO_LONG_MESSAGE, isEntryBodySizeAllowed } from "./entry-body-size.ts";
import { EntryForm } from "./entry-form.tsx";
import { parseDocumentForm, parseVersion } from "./entry-form-input.ts";

// Outside the admin-shell layout (routes.ts), same as post-edit.tsx.
export const middleware: Route.MiddlewareFunction[] = [
  requireUser,
  requireRole(["admin", "editor"]),
];

/**
 * A page id that is not a uuid never matches a row, but reaching the database
 * with one raises `invalid input syntax for type uuid` and answers 500. A
 * mistyped or stale address deserves the same 404 a missing page gets.
 */
function requirePageId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

/** Which button was pressed. Never trusted as free text past this parse. */
const intentSchema = z.enum(["save", "publish", "unpublish"]);

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.entry.title ?? "Page"} - Habre CMS` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const entry = await findEntryForUser("page", requirePageId(params.id), context.get(userContext));
  if (!entry) throw data("Not Found", { status: 404 });
  return { entry, mediaById: await resolveDocumentMedia(entry.document) };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const id = requirePageId(params.id);
  if (!isEntryBodySizeAllowed(request.headers)) {
    // Returned, not thrown: a thrown 413 replaced the editor with the error
    // page and lost the draft (F-39). The body is never read.
    return data(
      { problem: { kind: "invalid" as const, message: ENTRY_TOO_LONG_MESSAGE } },
      { status: 413 },
    );
  }
  const form = await request.formData();
  // A native submit with no JavaScript carries no `intent` at all - the
  // buttons that set it only render once the editor has mounted (F-34's same
  // condition) - and that has to fall through to `parseDocumentForm`'s own
  // missing-blocks message below, not a new "action could not be read" one.
  const intent = intentSchema.safeParse(form.get("intent") ?? "save");
  if (!intent.success) {
    return data(
      { problem: { kind: "invalid" as const, message: "That action could not be read." } },
      { status: 400 },
    );
  }
  const parsed = parseDocumentForm(form, "page");
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

  const result = await saveEntry(
    "page",
    id,
    { title: parsed.title, document: parsed.document },
    version,
    context.get(userContext),
    intent.data === "save" ? undefined : intent.data,
  );
  if (!result.ok) {
    if (result.reason === "not_found") throw data("Not Found", { status: 404 });
    return data({ problem: { kind: "stale" as const } }, { status: 409 });
  }
  // Publish and unpublish return to the list with the same success-banner
  // pattern posts already use.
  if (intent.data === "publish")
    return bannerRedirect("published", result.entry.title, "/admin/pages");
  if (intent.data === "unpublish")
    return bannerRedirect("unpublished", result.entry.title, "/admin/pages");
  return { problem: null, version: result.entry.version };
}

export default function EditPage({ loaderData, actionData }: Route.ComponentProps) {
  const { entry } = loaderData;
  return (
    <EntryForm
      entryType="page"
      title={entry.title}
      slug={entry.slug}
      document={entry.document}
      mediaById={loaderData.mediaById}
      status={entry.status}
      // After a save the row moved on; the form carries the new version so the
      // next save is not refused as stale.
      version={actionData && "version" in actionData ? actionData.version : entry.version}
      problem={actionData?.problem ?? null}
    />
  );
}
