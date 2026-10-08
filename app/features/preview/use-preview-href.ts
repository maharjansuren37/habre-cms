import { useRouteLoaderData } from "react-router";
import { previewHref } from "./preview-href.ts";
import type { loader as previewLayoutLoader } from "./preview-layout.tsx";

export const PREVIEW_LAYOUT_ID = "features/preview/preview-layout";

/** The preview layout's data and the link rewriter built from it, for the
 *  preview routes that draw a page's content (item 18b4b). */
export function usePreviewHref() {
  // The layout always renders around these routes (app/routes.ts); missing
  // data is a bug, so fail loudly rather than show a made-up title.
  const layout = useRouteLoaderData<typeof previewLayoutLoader>(PREVIEW_LAYOUT_ID);
  if (!layout) throw new Error("The preview layout's data is missing.");
  const links = {
    pageSlugs: new Set(layout.pageSlugs),
    homeSlug: layout.homeSlug,
    siteOrigin: layout.siteOrigin,
  };
  return { layout, hrefFor: (href: string) => previewHref(href, links) };
}
