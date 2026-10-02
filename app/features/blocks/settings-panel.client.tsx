import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { Button } from "#app/lib/ui/button.tsx";
import styles from "./settings-panel.module.css";

/**
 * The settings panel (design.md, *Settings panel*): an `aside` headed by what
 * it edits, 17rem on the right from 1024px and a bottom sheet below it. It is
 * drawn only for a block that has settings - an image or a section; text is
 * edited where it sits. Close settings and Escape inside it call `onClose`,
 * which hides the panel and returns focus to the writing area.
 *
 * Below 1024px the sheet covers the bottom of the page, so while it is open it
 * publishes its height as `--settings-sheet` on `<body>` (the canvas pads its
 * bottom by it) and scrolls the selected block above it (`keepVisible`).
 */
export function SettingsPanel({
  title,
  onClose,
  keepVisible,
  children,
}: {
  title: string;
  onClose: () => void;
  /** The selected block's element, kept above the bottom sheet. */
  keepVisible?: () => Element | null;
  children: ReactNode;
}) {
  const headingId = useId();
  const aside = useRef<HTMLElement>(null);
  const latestKeepVisible = useRef(keepVisible);
  useLayoutEffect(() => {
    latestKeepVisible.current = keepVisible;
  }, [keepVisible]);

  useLayoutEffect(() => {
    const element = aside.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      const isSheet = getComputedStyle(element).position === "fixed";
      const height = isSheet ? element.offsetHeight : 0;
      document.body.style.setProperty("--settings-sheet", `${height}px`);
      const block = latestKeepVisible.current?.();
      if (height === 0 || !block) return;
      const rect = block.getBoundingClientRect();
      const visibleBottom = window.innerHeight - height - 16;
      // Never so far that the block's own top leaves the screen.
      const shift = Math.min(rect.bottom - visibleBottom, rect.top - 16);
      if (shift > 0) window.scrollBy({ top: shift });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.body.style.removeProperty("--settings-sheet");
    };
  }, []);

  return (
    <aside
      ref={aside}
      className={styles.panel}
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        <Button
          type="button"
          variant="quiet"
          className={styles.close}
          aria-label="Close settings"
          title="Close settings"
          onClick={onClose}
        >
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.fields}>{children}</div>
    </aside>
  );
}

/** A section's settings: Columns 1 / 2 / 3 (D119 - the editor's `setColumns` does the work). */
export function SectionSettings({
  columns,
  onColumns,
}: {
  columns: number;
  onColumns: (columns: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Columns
      </label>
      <select
        id={id}
        className={styles.select}
        value={columns}
        onChange={(event) => onColumns(Number(event.currentTarget.value))}
      >
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
      </select>
    </div>
  );
}

/**
 * An image's settings: Choose / Replace image, and its alt text read-only -
 * it is set when the image is uploaded (D55). `media` is undefined for an
 * image with no file or one whose file was deleted.
 */
export function ImageSettings({
  mediaId,
  media,
  onChoose,
}: {
  mediaId: string;
  media: { altText: string } | undefined;
  onChoose: () => void;
}) {
  return (
    <>
      <div className={styles.field}>
        <Button type="button" onClick={onChoose}>
          {mediaId === "" ? "Choose image" : "Replace image"}
        </Button>
      </div>
      {mediaId !== "" && !media ? (
        <p className={styles.note}>This image is no longer available.</p>
      ) : null}
      {media ? (
        <div className={styles.field}>
          <dl className={styles.alt}>
            <dt className={styles.label}>Alt text</dt>
            <dd className={styles.readonly}>{media.altText}</dd>
          </dl>
          <p className={styles.note}>Alt text is set when the image is uploaded.</p>
        </div>
      ) : null}
    </>
  );
}
