import { useRouteLoaderData } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import { findPreviewHomePage } from "#app/features/content/entries.server.ts";
import { resolveDocumentMedia } from "#app/features/public-site/document-media.server.ts";
import pageStyles from "#app/features/public-site/page-body.module.css";
import { PageBody } from "#app/features/public-site/page-body.tsx";
import listStyles from "#app/features/public-site/post-list.module.css";
import type { Route } from "./+types/preview-home";
import { previewHref } from "./preview-href.ts";
import type { loader as previewLayoutLoader } from "./preview-layout.tsx";

const LAYOUT_ID = "features/preview/preview-layout";

export function meta({ matches }: Route.MetaArgs) {
  const layout = matches.find((match) => match?.id === LAYOUT_ID)?.loaderData as
    | Awaited<ReturnType<typeof previewLayoutLoader>>
    | undefined;
  const siteTitle = layout?.settings.siteTitle;
  return [
    { title: siteTitle ? `Preview - ${siteTitle}` : "Preview" },
    { name: "robots", content: "noindex" },
  ];
}

// The home page whatever its status (item 18b4b); with none chosen, the
// placeholder the site itself would show.
export async function loader({ context }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const page = await findPreviewHomePage(siteId);
  if (!page) return { kind: "placeholder" as const };
  return {
    kind: "page" as const,
    page: { title: page.title, document: page.document },
    mediaById: await resolveDocumentMedia(siteId, page.document),
  };
}

export default function PreviewHome({ loaderData }: Route.ComponentProps) {
  // The layout always renders around this route (app/routes.ts); missing data
  // is a bug, so fail loudly rather than show a made-up title.
  const layout = useRouteLoaderData<typeof previewLayoutLoader>(LAYOUT_ID);
  if (!layout) throw new Error("The preview layout's data is missing.");
  if (loaderData.kind === "page") {
    const links = {
      pageSlugs: new Set(layout.pageSlugs),
      homeSlug: layout.homeSlug,
      siteOrigin: layout.siteOrigin,
    };
    return (
      <PageBody
        page={loaderData.page}
        mediaById={loaderData.mediaById}
        hrefFor={(href) => previewHref(href, links)}
      />
    );
  }
  return (
    <main className={listStyles.home}>
      <h1 className={pageStyles.title}>{layout.settings.siteTitle}</h1>
      <p className={listStyles.empty}>This site is being set up.</p>
    </main>
  );
}
