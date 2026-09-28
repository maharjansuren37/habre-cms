import { findHomePage, listPublishedPosts } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/home";
import { PageBody } from "./page-body.tsx";
import { resolvePageMedia } from "./page-media.server.ts";
import { POST_LIMIT, PostList } from "./post-list.tsx";

export function meta({ loaderData }: Route.MetaArgs) {
  if (loaderData?.kind === "page") return [{ title: `${loaderData.page.title} - Habre CMS` }];
  return [{ title: "Habre CMS" }];
}

// The chosen page when there is one and it is published; otherwise the latest
// posts, exactly as before item 9 - an unpublished or deleted home page never
// breaks the front door (D-2).
export async function loader() {
  const page = await findHomePage();
  if (page) {
    const mediaById = await resolvePageMedia(page.blocks);
    return { kind: "page" as const, page, mediaById };
  }
  const posts = await listPublishedPosts(POST_LIMIT);
  return { kind: "posts" as const, posts };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "page") {
    return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} />;
  }
  return <PostList posts={loaderData.posts} />;
}
