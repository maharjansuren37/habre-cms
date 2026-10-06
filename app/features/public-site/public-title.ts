import type { loader as publicLayoutLoader } from "./layout.tsx";

const PUBLIC_LAYOUT_ID = "features/public-site/layout";
// Only reached if the layout's own loader failed - the same literal the
// layout's ErrorBoundary falls back to.
export const FALLBACK_SITE_TITLE = "Habre CMS";

export type PublicLayoutData = Awaited<ReturnType<typeof publicLayoutLoader>>;

type Matches = ReadonlyArray<{ id: string; loaderData?: unknown } | undefined>;

/** The public layout's loader data from a `meta` function's `matches`, if it loaded. */
export function publicLayoutData(matches: Matches): PublicLayoutData | undefined {
  return matches.find((match) => match?.id === PUBLIC_LAYOUT_ID)?.loaderData as
    | PublicLayoutData
    | undefined;
}

/**
 * A public page's browser title, named for the site an admin set in
 * Settings rather than the CMS (F-116): "<page> - <site>", or the site title
 * alone. Reads the public layout's loader data from a `meta` function's
 * `matches`, the same route id `home.tsx` reads through `useRouteLoaderData`.
 */
export function publicTitle(matches: Matches, pageTitle?: string): string {
  const siteTitle = publicLayoutData(matches)?.settings.siteTitle ?? FALLBACK_SITE_TITLE;
  return pageTitle ? `${pageTitle} - ${siteTitle}` : siteTitle;
}
