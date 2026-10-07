import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { isUploadSizeAllowed } from "#app/features/media/media-input.ts";
import { storeUpload } from "#app/features/media/store-upload.server.ts";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/logo-upload";
import { getSiteSettings } from "./settings.server.ts";

// Admin only, like Settings itself: anyone else gets the same 404 (D69).
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin"])];

/** The library's label for a logo: the header shows it with `alt=""`, so this is never read aloud.
 *  Cut short so a long site title cannot push it past the alt text limit. */
function logoAltText(siteTitle: string): string {
  return `${siteTitle.slice(0, 200)} logo`;
}

/**
 * `POST /admin/settings/logo` - Settings' Upload logo posts one image here.
 * 200 `{ media }` with the new library item, or 400 / 413 `{ problem }`.
 * It stores the image like Media's upload does and sets nothing: the logo
 * is applied only when Settings is saved.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const actor = context.get(userContext);
  if (!isUploadSizeAllowed(request.headers)) {
    return Response.json(
      { problem: "This image is larger than 10 MB. Choose a smaller file and try again." },
      { status: 413 },
    );
  }
  const form = await request.formData();
  const { siteTitle } = await getSiteSettings(actor.siteId, env.R2_PUBLIC_URL);
  const result = await storeUpload(actor, form.get("file"), logoAltText(siteTitle));
  if (!result.ok) return Response.json({ problem: result.problem }, { status: result.status });
  return Response.json({ media: result.media });
}
