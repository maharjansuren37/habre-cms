import type { Block, ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { renderBlocks } from "#app/features/blocks/render.tsx";
import styles from "./page-body.module.css";

/** A published page as visitors see it - shared by `/:slug` and `/` when an
 *  admin has chosen it as the home page (item 9). */
export function PageBody({
  page,
  mediaById,
}: {
  page: { title: string; blocks: Block[] };
  mediaById: Record<string, ImageMediaSummary>;
}) {
  return (
    <main className={styles.article}>
      <h1 className={styles.title}>{page.title}</h1>
      <div className={styles.body}>{renderBlocks(page.blocks, mediaById)}</div>
    </main>
  );
}
