import { data, Link } from "react-router";
import { renderDocument } from "#app/features/blocks/render.tsx";
import { findPublishedEntry } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/post";
import { resolveDocumentMedia } from "./document-media.server.ts";
import styles from "./post.module.css";
import { findPublicSiteId } from "./public-site.server.ts";
import { publicTitle } from "./public-title.ts";

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return [{ title: publicTitle(matches, loaderData?.post.title ?? "Post") }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const siteId = await findPublicSiteId();
  const post = await findPublishedEntry(siteId, "post", params.slug);
  // A draft and a missing slug get the same answer - a post's existence is
  // never leaked by its status (item 4b's D-5; matches findEntryForUser's
  // own rule for ownership on the admin side).
  if (!post) throw data("Not Found", { status: 404 });
  // The view never reads these, so they stay off the wire (F-108).
  const { id: _id, isHomePage: _isHomePage, ...publicPost } = post;
  return { post: publicPost, mediaById: await resolveDocumentMedia(siteId, post.document) };
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
      {renderDocument(post.document, "post", mediaById)}
      <Link className={styles.back} to="/posts">
        ← All posts
      </Link>
    </main>
  );
}

// UTC, explicitly - item 4b's D-4, matching post-list.tsx's own formatter (not
// shared: two call sites is the project's own line for "copy, don't extract yet").
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
