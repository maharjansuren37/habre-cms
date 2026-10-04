import { data, Form, Link } from "react-router";
import { z } from "zod";
import { userContext } from "#app/features/auth/user-context.ts";
import { env } from "#app/lib/env.server.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/media-delete";
import { mediaBannerRedirect } from "./banner.ts";
import { deleteMedia, findMediaForUser } from "./media.server.ts";
import styles from "./media-delete.module.css";
import { buildMediaUrl } from "./media-url.ts";
import { deleteObject } from "./r2.server.ts";

/**
 * A media id that is not a uuid never matches a row, but reaching the
 * database with one raises `invalid input syntax for type uuid` and answers
 * 500. Same guard as content's `requirePostId` (F-28), not shared across the
 * two features (ai-interaction.md: refactoring is its own item).
 */
function requireMediaId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Delete "${loaderData?.media.filename ?? "image"}" - Habre CMS` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  // findMediaForUser returns null for someone else's upload, the same as for
  // an id that does not exist - existence stays private either way.
  const actor = context.get(userContext);
  const media = await findMediaForUser(actor.siteId, requireMediaId(params.id), actor);
  if (!media) throw data("Not Found", { status: 404 });
  return { media: { ...media, url: buildMediaUrl(env.R2_PUBLIC_URL, media.storageKey) } };
}

export async function action({ params, context }: Route.ActionArgs) {
  const id = requireMediaId(params.id);
  // Row first, then the R2 object (the plan's data rule). The row is the
  // source of truth - listMedia and findMediaForUser both read from it - so
  // once it is gone the delete has already succeeded from the app's own
  // point of view. An R2 failure past this point is logged, not thrown: the
  // person already got what they asked for, and throwing here would tell
  // them the delete failed when it did not (F-74). The object is left behind
  // exactly the way an upload's own R2-then-row failure is (plan: "harmless").
  const actor = context.get(userContext);
  const deleted = await deleteMedia(actor.siteId, id, actor);
  if (!deleted) throw data("Not Found", { status: 404 });
  try {
    await deleteObject(deleted.storageKey);
  } catch (error) {
    console.error(`Failed to delete R2 object for media ${id}:`, error);
  }
  return mediaBannerRedirect("deleted", deleted.filename);
}

export default function DeleteMedia({ loaderData }: Route.ComponentProps) {
  const { media } = loaderData;

  return (
    <section className={styles.confirm}>
      <h1 className={styles.title}>Delete this image?</h1>
      <img src={media.url} alt="" className={styles.thumb} />
      <p>
        <strong>{media.filename}</strong> will be removed, including anywhere it is used. This
        cannot be undone.
      </p>
      <div className={styles.actions}>
        <Link className={`${buttonStyles.button} ${buttonStyles.quiet}`} to="/admin/media">
          Cancel
        </Link>
        <Form method="post">
          <Button type="submit" className={styles.delete}>
            Delete image
          </Button>
        </Form>
      </div>
    </section>
  );
}
