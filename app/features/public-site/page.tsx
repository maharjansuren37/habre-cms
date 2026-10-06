import { data, redirect } from "react-router";
import { findPublishedEntry } from "#app/features/content/entries.server.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import type { Route } from "./+types/page";
import { resolveDocumentMedia } from "./document-media.server.ts";
import { PageBody } from "./page-body.tsx";
import { publicTitle } from "./public-title.ts";

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return [{ title: publicTitle(matches, loaderData?.page.title ?? "Page") }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const siteId = context.get(siteContext).id;
  const page = await findPublishedEntry(siteId, "page", params.slug);
  // A draft and a missing slug get the same answer - matches post.tsx's own
  // rule (item 4b's D-5), so a page's existence is never leaked by its status.
  if (!page) throw data("Not Found", { status: 404 });
  // One address per page (D-4): the home page lives at `/`. Temporary, since
  // the setting can change and browsers cache a 301 indefinitely (as D22).
  if (page.isHomePage) throw redirect("/");
  // The view never reads these, so they stay off the wire (F-108).
  const { id: _id, isHomePage: _isHomePage, ...publicPage } = page;
  return { page: publicPage, mediaById: await resolveDocumentMedia(siteId, page.document) };
}

export default function PublicPage({ loaderData }: Route.ComponentProps) {
  return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} />;
}
