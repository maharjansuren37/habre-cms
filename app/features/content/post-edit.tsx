import { data } from "react-router";
import { z } from "zod";
import { userContext } from "#app/features/auth/user-context.ts";
import { resolveDocumentMedia } from "#app/features/public-site/document-media.server.ts";
import type { Route } from "./+types/post-edit";
import { bannerRedirect } from "./banner.ts";
import { findEntryForUser, listLinkablePages, saveEntry } from "./entries.server.ts";
import { ENTRY_TOO_LONG_MESSAGE, isEntryBodySizeAllowed } from "./entry-body-size.ts";
import { EntryForm } from "./entry-form.tsx";
import { parseDocumentForm, parseVersion } from "./entry-form-input.ts";

/**
 * A post id that is not a uuid never matches a row, but reaching the database
 * with one raises `invalid input syntax for type uuid` and answers 500. A
 * mistyped or stale address deserves the same 404 a missing post gets (F-28).
 */
function requirePostId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

/** Which button was pressed. Never trusted as free text past this parse. */
const intentSchema = z.enum(["save", "publish", "unpublish"]);

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.entry.title ?? "Post"} - Habre CMS` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const entry = await findEntryForUser(
    context.get(userContext).siteId,
    "post",
    requirePostId(params.id),
    context.get(userContext),
  );
  // A post belonging to someone else is not "forbidden", it is not found: the
  // answer is the same either way, so its existence stays private.
  if (!entry) throw data("Not Found", { status: 404 });
  const actor = context.get(userContext);
  return {
    entry,
    mediaById: await resolveDocumentMedia(actor.siteId, entry.document),
    pages: await listLinkablePages(actor.siteId, actor),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const id = requirePostId(params.id);
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
  const parsed = parseDocumentForm(form, "post");
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
    context.get(userContext).siteId,
    "post",
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
  // pattern the delete flow already uses (design.md); a plain save stays on
  // the editor and shows its new version instead.
  if (intent.data === "publish")
    return bannerRedirect("published", result.entry.title, "/admin/posts");
  if (intent.data === "unpublish")
    return bannerRedirect("unpublished", result.entry.title, "/admin/posts");
  return { problem: null, version: result.entry.version };
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const { entry } = loaderData;
  return (
    <EntryForm
      entryType="post"
      title={entry.title}
      slug={entry.slug}
      document={entry.document}
      mediaById={loaderData.mediaById}
      pages={loaderData.pages}
      status={entry.status}
      // After a save the row moved on; the form carries the new version so the
      // next save is not refused as stale.
      version={actionData && "version" in actionData ? actionData.version : entry.version}
      problem={actionData?.problem ?? null}
    />
  );
}
