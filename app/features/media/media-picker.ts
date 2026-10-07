import { userContext } from "#app/features/auth/user-context.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/media-picker";
import { listMedia } from "./media.server.ts";
import { clampToLastPage, parseMediaListPage } from "./media-list-query.ts";
import { toPickedMedia } from "./media-objects.ts";

/**
 * `GET /admin/media/picker` - the image tool's dialog fetches this, paginated
 * the same page size as `/admin/media`. No `requireUser` here: this route sits
 * inside the guarded admin layout in `app/routes.ts`, which already applies it
 * to every request that reaches it (matches `post-list.tsx`'s convention, not
 * `post-delete.tsx`'s redundant one, F-58).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const url = new URL(request.url);
  const requestedPage = parseMediaListPage(url);
  const first = await listMedia(siteId, requestedPage);
  const page = clampToLastPage(requestedPage, first.totalPages);
  // `totalPages` does not depend on which page was asked for, so only an
  // out-of-range request costs a second query.
  const list = page === requestedPage ? first : await listMedia(siteId, page);
  return Response.json({
    media: list.media.map((item) => toPickedMedia(env.R2_PUBLIC_URL, item)),
    page,
    totalPages: list.totalPages,
  });
}
