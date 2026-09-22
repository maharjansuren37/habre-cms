import { data } from "react-router";
import { z } from "zod";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { collectImageMediaIds, type ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/page-edit";
import { bannerRedirect } from "./banner.ts";
import { findEntryForUser, saveEntry } from "./entries.server.ts";
import { EntryForm } from "./entry-form.tsx";
import { isEntryBodySizeAllowed, parseEntryForm, parseVersion } from "./entry-form-input.ts";

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
  // One query for every image block this entry has, so reopening it shows
  // them immediately - no picker round trip, no per-image fetch.
  const rows = await findMediaByIds(collectImageMediaIds(entry.blocks));
  const mediaById: Record<string, ImageMediaSummary> = Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        url: buildMediaUrl(env.R2_PUBLIC_URL, row.storageKey),
        altText: row.altText,
        width: row.width,
        height: row.height,
      },
    ]),
  );
  return { entry, mediaById };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const id = requirePageId(params.id);
  if (!isEntryBodySizeAllowed(request.headers)) {
    throw data("Request too large", { status: 413 });
  }
  const form = await request.formData();
  // A native submit with no JavaScript carries no `intent` at all - the
  // buttons that set it only render once the editor has mounted (F-34's same
  // condition) - and that has to fall through to `parseEntryForm`'s own
  // missing-blocks message below, not a new "action could not be read" one.
  const intent = intentSchema.safeParse(form.get("intent") ?? "save");
  if (!intent.success) {
    return data(
      { problem: { kind: "invalid" as const, message: "That action could not be read." } },
      { status: 400 },
    );
  }
  const parsed = parseEntryForm(form);
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
    { title: parsed.title, blocks: parsed.blocks },
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
  const { entry, mediaById } = loaderData;
  return (
    <EntryForm
      entryType="page"
      title={entry.title}
      slug={entry.slug}
      blocks={entry.blocks}
      mediaById={mediaById}
      status={entry.status}
      // After a save the row moved on; the form carries the new version so the
      // next save is not refused as stale.
      version={actionData && "version" in actionData ? actionData.version : entry.version}
      problem={actionData?.problem ?? null}
    />
  );
}
