import { data, Form, Link } from "react-router";
import { z } from "zod";
import { requireUser } from "#app/features/auth/require-user.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/post-delete";
import { bannerRedirect } from "./banner.ts";
import { deleteEntry, findEntryForUser } from "./entries.server.ts";
import styles from "./entry-delete.module.css";

export const middleware: Route.MiddlewareFunction[] = [requireUser];

/**
 * A post id that is not a uuid never matches a row, but reaching the database
 * with one raises `invalid input syntax for type uuid` and answers 500. A
 * mistyped or stale address deserves the same 404 a missing post gets (F-28).
 *
 * Copied from `post-edit.tsx`, not extracted - its second use, the same call
 * made for the status badge (Step 2): the third use is what earns a shared
 * module (fundamentals.md).
 */
function requirePostId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Delete "${loaderData?.entry.title ?? "post"}" - Habre CMS` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  // findEntryForUser already returns null for someone else's post, the same as
  // for a post that does not exist - existence stays private either way.
  const entry = await findEntryForUser("post", requirePostId(params.id), context.get(userContext));
  if (!entry) throw data("Not Found", { status: 404 });
  return { entry };
}

export async function action({ params, context }: Route.ActionArgs) {
  const id = requirePostId(params.id);
  const deleted = await deleteEntry("post", id, context.get(userContext));
  if (!deleted) throw data("Not Found", { status: 404 });
  return bannerRedirect("deleted", deleted.title, "/admin/posts");
}

export default function DeletePost({ loaderData }: Route.ComponentProps) {
  const { entry } = loaderData;

  return (
    <section className={styles.confirm}>
      <h1 className={styles.title}>Delete this post?</h1>
      <p>
        <strong>{entry.title}</strong> will be removed. This cannot be undone.
      </p>
      <div className={styles.actions}>
        <Link className={`${buttonStyles.button} ${buttonStyles.quiet}`} to="/admin/posts">
          Cancel
        </Link>
        <Form method="post">
          <Button type="submit" className={styles.delete}>
            Delete post
          </Button>
        </Form>
      </div>
    </section>
  );
}
