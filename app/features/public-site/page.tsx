import { data } from "react-router";
import { collectImageMediaIds, type ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { renderBlocks } from "#app/features/blocks/render.tsx";
import { findPublishedEntry } from "#app/features/content/entries.server.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/page";
import styles from "./page.module.css";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.page.title ?? "Page"} - Habre CMS` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const page = await findPublishedEntry("page", params.slug);
  // A draft and a missing slug get the same answer - matches post.tsx's own
  // rule (item 4b's D-5), so a page's existence is never leaked by its status.
  if (!page) throw data("Not Found", { status: 404 });
  // One query for every image block this page has, same contract post.tsx
  // uses - an id with no row (the file was deleted after being placed)
  // simply renders nothing, not an error.
  const rows = await findMediaByIds(collectImageMediaIds(page.blocks));
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
  return { page, mediaById };
}

export default function PublicPage({ loaderData }: Route.ComponentProps) {
  const { page, mediaById } = loaderData;
  return (
    <main className={styles.article}>
      <h1 className={styles.title}>{page.title}</h1>
      <div className={styles.body}>{renderBlocks(page.blocks, mediaById)}</div>
    </main>
  );
}
