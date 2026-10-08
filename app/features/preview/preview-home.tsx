import { userContext } from "#app/features/auth/user-context.ts";
import { findPreviewHomePage } from "#app/features/content/entries.server.ts";
import { resolveDocumentMedia } from "#app/features/public-site/document-media.server.ts";
import pageStyles from "#app/features/public-site/page-body.module.css";
import { PageBody } from "#app/features/public-site/page-body.tsx";
import listStyles from "#app/features/public-site/post-list.module.css";
import type { Route } from "./+types/preview-home";
import type { loader as previewLayoutLoader } from "./preview-layout.tsx";
import { PREVIEW_LAYOUT_ID as LAYOUT_ID, usePreviewHref } from "./use-preview-href.ts";

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
  const { hrefFor, layout } = usePreviewHref();
  if (loaderData.kind === "page") {
    return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} hrefFor={hrefFor} />;
  }
  return (
    <main className={listStyles.home}>
      <h1 className={pageStyles.title}>{layout.settings.siteTitle}</h1>
      <p className={listStyles.empty}>This site is being set up.</p>
    </main>
  );
}
