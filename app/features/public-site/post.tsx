import { data, Link } from "react-router";
import { collectImageMediaIds, type ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { renderBlocks } from "#app/features/blocks/render.tsx";
import { findPublishedPost } from "#app/features/content/entries.server.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { buildMediaUrl } from "#app/features/media/media-url.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/post";
import styles from "./post.module.css";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.post.title ?? "Post"} - Habre CMS` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const post = await findPublishedPost(params.slug);
  // A draft and a missing slug get the same answer - a post's existence is
  // never leaked by its status (item 4b's D-5; matches findEntryForUser's
  // own rule for ownership on the admin side).
  if (!post) throw data("Not Found", { status: 404 });
  // One query for every image block this post has - an id with no row (the
  // file was deleted after being placed) simply renders nothing, not an error.
  const rows = await findMediaByIds(collectImageMediaIds(post.blocks));
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
  return { post, mediaById };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { post, mediaById } = loaderData;
  return (
    <main className={styles.article}>
      <p className={styles.meta}>
        <time dateTime={new Date(post.publishedAt).toISOString()}>
          {formatDate(post.publishedAt)}
        </time>
        {" · "}
        {post.authorName}
      </p>
      <h1 className={styles.title}>{post.title}</h1>
      <div className={styles.body}>{renderBlocks(post.blocks, mediaById)}</div>
      <Link className={styles.back} to="/">
        ← All posts
      </Link>
    </main>
  );
}

// UTC, explicitly - item 4b's D-4, matching home.tsx's own formatter (not
// shared: two call sites is the project's own line for "copy, don't extract yet").
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
