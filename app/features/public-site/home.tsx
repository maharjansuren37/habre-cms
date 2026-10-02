import { Link, useRouteLoaderData } from "react-router";
import { findHomePage, hasPublishedPosts } from "#app/features/content/entries.server.ts";
import type { Route } from "./+types/home";
import type { loader as publicLayoutLoader } from "./layout.tsx";
import pageStyles from "./page-body.module.css";
import { PageBody } from "./page-body.tsx";
import { resolvePageMedia } from "./page-media.server.ts";
import listStyles from "./post-list.module.css";
import { publicTitle } from "./public-title.ts";

export function meta({ loaderData, matches }: Route.MetaArgs) {
  if (loaderData?.kind === "page") return [{ title: publicTitle(matches, loaderData.page.title) }];
  return [{ title: publicTitle(matches) }];
}

// `/` is always a landing page (D-12): the chosen page when there is one and
// it is published; otherwise a placeholder, never the post list - an
// unpublished or deleted home page never breaks the front door (D-2).
export async function loader() {
  const page = await findHomePage();
  if (page) {
    const mediaById = await resolvePageMedia(page.sections);
    return { kind: "page" as const, page, mediaById };
  }
  return { kind: "placeholder" as const, hasPosts: await hasPublishedPosts() };
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
