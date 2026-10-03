import { data, Form, Link } from "react-router";
import { z } from "zod";
import { requireRole } from "#app/features/auth/require-role.server.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import buttonStyles from "#app/lib/ui/button.module.css";
import { Button } from "#app/lib/ui/button.tsx";
import type { Route } from "./+types/page-delete";
import { bannerRedirect } from "./banner.ts";
import { deleteEntry, findEntryForUser } from "./entries.server.ts";
import styles from "./entry-delete.module.css";
import { entryListHref, parseEntryListQuery } from "./entry-list-query.ts";

// Editor and admin only, same as the rest of /admin/pages*.
export const middleware: Route.MiddlewareFunction[] = [requireRole(["admin", "editor"])];

/**
 * A page id that is not a uuid never matches a row, but reaching the database
 * with one raises `invalid input syntax for type uuid` and answers 500. A
 * mistyped or stale address deserves the same 404 a missing page gets.
 *
 * Copied from `post-delete.tsx`'s own `requirePostId` (item 6a) - the third
 * use of this exact check is what would earn it a shared module
 * (fundamentals.md); until then it stays a one-line copy per file.
 */
function requirePageId(id: string): string {
  if (!z.uuid().safeParse(id).success) throw data("Not Found", { status: 404 });
  return id;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Delete "${loaderData?.entry.title ?? "page"}" - Habre CMS` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  // findEntryForUser already returns null for a page that does not exist -
  // pages have no author-ownership restriction (only admin/editor reach this
  // route at all), but the same "not found, not forbidden" shape still applies.
  const entry = await findEntryForUser(
    context.get(userContext).siteId,
    "page",
    requirePageId(params.id),
    context.get(userContext),
  );
  if (!entry) throw data("Not Found", { status: 404 });
  // The list state the person came from, so Cancel returns to it. Read
  // through the list's own parser: nothing but status, q and page gets through.
  const listQuery = parseEntryListQuery(new URL(request.url));
  return { entry, listHref: entryListHref("/admin/pages", listQuery) };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const id = requirePageId(params.id);
  const deleted = await deleteEntry(
    context.get(userContext).siteId,
    "page",
    id,
    context.get(userContext),
  );
  if (!deleted) throw data("Not Found", { status: 404 });
  return bannerRedirect(
    "deleted",
    deleted.title,
    "/admin/pages",
    parseEntryListQuery(new URL(request.url)),
  );
}

export default function DeletePage({ loaderData }: Route.ComponentProps) {
  const { entry, listHref } = loaderData;

  return (
    <section className={styles.confirm}>
      <h1 className={styles.title}>Delete this page?</h1>
      <p>
        <strong>{entry.title}</strong> will be removed. This cannot be undone.
      </p>
      <div className={styles.actions}>
        <Link className={`${buttonStyles.button} ${buttonStyles.quiet}`} to={listHref}>
          Cancel
        </Link>
        <Form method="post">
          <Button type="submit" className={styles.delete}>
            Delete page
          </Button>
        </Form>
      </div>
    </section>
  );
}
