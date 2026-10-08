import { data, redirect } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import { findPreviewPage } from "#app/features/content/entries.server.ts";
import { resolveDocumentMedia } from "#app/features/public-site/document-media.server.ts";
import { PageBody } from "#app/features/public-site/page-body.tsx";
import type { Route } from "./+types/preview-page";
import { usePreviewHref } from "./use-preview-href.ts";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `Preview - ${loaderData.page.title}` : "Preview" },
    { name: "robots", content: "noindex" },
  ];
}

// Any page of the site whatever its status, never another site's (item 18b4b).
// The home page's own address is the preview's root.
export async function loader({ context, params }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const page = await findPreviewPage(siteId, params.slug);
  if (!page) throw data("Not Found", { status: 404 });
  if (page.isHomePage) throw redirect("/admin/preview");
  return {
    page: { title: page.title, document: page.document },
    mediaById: await resolveDocumentMedia(siteId, page.document),
  };
}

export default function PreviewPage({ loaderData }: Route.ComponentProps) {
  const { hrefFor } = usePreviewHref();
  return <PageBody page={loaderData.page} mediaById={loaderData.mediaById} hrefFor={hrefFor} />;
}
