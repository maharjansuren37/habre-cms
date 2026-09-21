import { data, Link } from "react-router";
import { renderBlocks } from "#app/features/blocks/render.tsx";
import { findPublishedPost } from "#app/features/content/entries.server.ts";
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
  return { post };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
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
      <div className={styles.body}>{renderBlocks(post.blocks)}</div>
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
