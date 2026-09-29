import { listPublishedPosts } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/posts";
import { POST_LIMIT, PostList } from "./post-list.tsx";
import { publicTitle } from "./public-title.ts";

// The post list's permanent address, whatever `/` shows (item 9's D-3).
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: publicTitle(matches, "Posts") }];
}

export async function loader() {
  const posts = await listPublishedPosts(POST_LIMIT);
  return { posts };
}

export default function Posts({ loaderData }: Route.ComponentProps) {
  return <PostList posts={loaderData.posts} />;
}
