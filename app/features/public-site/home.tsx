import { Link, useRouteLoaderData } from "react-router";
import { findHomePage, hasPublishedPosts } from "#app/features/content/entries.server.ts";
import { publicMeta } from "#app/features/seo/head-tags.ts";
import { siteContext } from "#app/features/sites/site-context.ts";
import type { Route } from "./+types/home";
import { resolveDocumentMedia } from "./document-media.server.ts";
import type { loader as publicLayoutLoader } from "./layout.tsx";
import pageStyles from "./page-body.module.css";
import { PageBody } from "./page-body.tsx";
import listStyles from "./post-list.module.css";

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const title = loaderData?.kind === "page" ? loaderData.page.title : undefined;
  const tags = publicMeta(matches, { title, path: "/" });
  // The "being set up" placeholder is not for search engines (item 17).
  if (loaderData?.kind === "placeholder") tags.push({ name: "robots", content: "noindex" });
  return tags;
}

// `/` is always a landing page (D-12): the chosen page when there is one and
// it is published; otherwise a placeholder, never the post list - an
// unpublished or deleted home page never breaks the front door (D-2).
export async function loader({ context }: Route.LoaderArgs) {
  const siteId = context.get(siteContext).id;
  const page = await findHomePage(siteId);
  if (page) {
    return {
      kind: "page" as const,
      page,
      mediaById: await resolveDocumentMedia(siteId, page.document),
    };
  }
  return { kind: "placeholder" as const, hasPosts: await hasPublishedPosts(siteId) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "page") {
    return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} />;
  }
  return <HomePlaceholder hasPosts={loaderData.hasPosts} />;
}

/** Reuses the post list's and a page's existing styles rather than adding a
 *  look of its own (Step 8). */
function HomePlaceholder({ hasPosts }: { hasPosts: boolean }) {
  // The layout always renders around this route (app/routes.ts); missing
  // data is a bug, so fail loudly rather than show a made-up title (F-111).
  const layoutData = useRouteLoaderData<typeof publicLayoutLoader>("features/public-site/layout");
  if (!layoutData) throw new Error("The public layout's data is missing.");
  const siteTitle = layoutData.settings.siteTitle;
  return (
    <main className={listStyles.home}>
      <h1 className={pageStyles.title}>{siteTitle}</h1>
      <p className={listStyles.empty}>This site is being set up.</p>
      {hasPosts && (
        <p>
          <Link to="/posts">Read the posts</Link>
        </p>
      )}
    </main>
  );
}
