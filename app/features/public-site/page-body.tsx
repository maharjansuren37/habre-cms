import type { ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { findMainHeading } from "#app/features/blocks/document-nodes.ts";
import { renderDocument, renderSections } from "#app/features/blocks/render.tsx";
import type { PublicPage } from "#app/features/content/entries.server.ts";
import styles from "./page-body.module.css";

/** A published page as visitors see it - shared by `/:slug` and `/` when an
 *  admin has chosen it as the home page (item 9). */
export function PageBody({
  page,
  mediaById,
}: {
  page: PublicPage;
  mediaById: Record<string, ImageMediaSummary>;
}) {
  if ("document" in page) {
    // A v4 page whose main heading has text draws that heading as its only
    // `h1`; otherwise the title is the `h1` (item 14a1).
    return (
      <main className={styles.article}>
        {findMainHeading(page.document) ? null : <h1 className={styles.title}>{page.title}</h1>}
        {renderDocument(page.document, "page")}
      </main>
    );
  }
  return (
    <main className={styles.article}>
      <h1 className={styles.title}>{page.title}</h1>
      <div className={styles.body}>{renderSections(page.sections, mediaById)}</div>
    </main>
  );
}
