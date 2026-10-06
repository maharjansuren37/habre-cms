import { siteContext } from "#app/features/sites/site-context.ts";
import type { Route } from "./+types/robots";

const TEXT = { "Content-Type": "text/plain; charset=utf-8" };

// The platform host has no `siteContext` and `context.get` throws for an unset
// context with no default, so a throw here means "the platform's request".
function mainOriginOrNull(context: Route.LoaderArgs["context"]): string | null {
  try {
    return context.get(siteContext).mainOrigin;
  } catch {
    return null;
  }
}

/** The platform is never indexed; a site is, and names its sitemap (item 17, D173). */
export function loader({ context }: Route.LoaderArgs) {
  const mainOrigin = mainOriginOrNull(context);
  const body = mainOrigin
    ? `User-agent: *\nAllow: /\n\nSitemap: ${mainOrigin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: TEXT });
}
