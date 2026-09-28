import { data } from "react-router";
import { findPublishedEntry } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/page";
import { PageBody } from "./page-body.tsx";
import { resolvePageMedia } from "./page-media.server.ts";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.page.title ?? "Page"} - Habre CMS` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const page = await findPublishedEntry("page", params.slug);
  // A draft and a missing slug get the same answer - matches post.tsx's own
  // rule (item 4b's D-5), so a page's existence is never leaked by its status.
  if (!page) throw data("Not Found", { status: 404 });
  const mediaById = await resolvePageMedia(page.blocks);
  return { page, mediaById };
}

export default function PublicPage({ loaderData }: Route.ComponentProps) {
  return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} />;
}
