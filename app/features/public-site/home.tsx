import { listPublishedPosts } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/home";
import { POST_LIMIT, PostList } from "./post-list.tsx";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Habre CMS" }];
}

export async function loader() {
  const posts = await listPublishedPosts(POST_LIMIT);
  return { posts };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <PostList posts={loaderData.posts} />;
}
