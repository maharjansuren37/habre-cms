import type { loader as publicLayoutLoader } from "./layout.tsx";

const PUBLIC_LAYOUT_ID = "features/public-site/layout";
// Only reached if the layout's own loader failed - the same literal the
// layout's ErrorBoundary falls back to.
export const FALLBACK_SITE_TITLE = "Habre CMS";

type PublicLayoutData = Awaited<ReturnType<typeof publicLayoutLoader>>;

/**
 * A public page's browser title, named for the site an admin set in
 * Settings rather than the CMS (F-116): "<page> - <site>", or the site title
 * alone. Reads the public layout's loader data from a `meta` function's
 * `matches`, the same route id `home.tsx` reads through `useRouteLoaderData`.
 */
export function publicTitle(
  matches: ReadonlyArray<{ id: string; loaderData?: unknown } | undefined>,
  pageTitle?: string,
): string {
  const layoutData = matches.find((match) => match?.id === PUBLIC_LAYOUT_ID)?.loaderData as
    | PublicLayoutData
    | undefined;
  const siteTitle = layoutData?.settings.siteTitle ?? FALLBACK_SITE_TITLE;
  return pageTitle ? `${pageTitle} - ${siteTitle}` : siteTitle;
}
