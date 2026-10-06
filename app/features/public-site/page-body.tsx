import { type DocumentMedia, findMainHeading } from "#app/features/blocks/document-nodes.ts";
import { renderDocument } from "#app/features/blocks/render.tsx";
import type { PublicPage } from "#app/features/content/entries.server.ts";
import styles from "./page-body.module.css";

/** A published page as visitors see it - shared by `/:slug` and `/` when an
 *  admin has chosen it as the home page (item 9). A page whose main heading has
 *  text draws that heading as its only `h1`; otherwise the title is the `h1`
 *  (item 14a1). */
export function PageBody({
  page,
  mediaById,
}: {
  page: Pick<PublicPage, "title" | "document">;
  mediaById: Record<string, DocumentMedia>;
}) {
  return (
    <main className={styles.article}>
      {findMainHeading(page.document) ? null : <h1 className={styles.title}>{page.title}</h1>}
      {renderDocument(page.document, "page", mediaById)}
    </main>
  );
}
