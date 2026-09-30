import { useEffect, useId, useRef, useState } from "react";
import { Button } from "#app/lib/ui/button.tsx";
import {
  type Block,
  type ImageMediaSummary,
  LEGACY_SECTION_ID,
  MAX_SECTIONS,
  type Section,
} from "./blocks.ts";
import { BlockEditor } from "./editor.client.tsx";
import styles from "./sections-editor.module.css";

type ColumnReader = { current: (() => Promise<unknown>) | null };

/** What the list holds for a section: its id, and the blocks its editor starts
 *  with. Editor.js owns the content from then on - it is read back on save. */
type Entry = { id: string; blocks: Block[] };

/** Where focus goes after the list changes, since the control that held it may
 *  have moved, been disabled or gone. */
type FocusTarget =
  | { id: string; control: "heading" | "up" | "down" | "remove" | "keep" | "editor" }
  | { control: "add" };

/**
 * A page's sections, each with its own Editor.js (D114). The section list lives
 * here in React; every Editor.js owns the DOM inside its own section, so React
 * never re-renders inside one, and a move only moves the section's card.
 *
 * `contentRef` hands the parent what the save sends: `{ sections: [{ id,
 * columns: [{ blocks }] }] }`, read from every editor on demand. Item 10 has one
 * column per section.
 */
export function SectionsEditor({
  initialSections,
  mediaById = {},
  contentRef,
  onChange,
}: {
  initialSections: Section[];
  mediaById?: Record<string, ImageMediaSummary>;
  contentRef: { current: (() => Promise<unknown>) | null };
  onChange: () => void;
}) {
  // A not-yet-resaved page loads as the section `legacy`; it gets a real id here,
  // once, so what is saved never carries the placeholder.
  const [entries, setEntries] = useState<Entry[]>(() =>
    initialSections.map((section) => ({
      id: section.id === LEGACY_SECTION_ID ? crypto.randomUUID() : section.id,
      blocks: section.data.children[0] ?? [],
    })),
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const readers = useRef(new Map<string, ColumnReader>());
  const root = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const readerFor = (id: string): ColumnReader => {
    let reader = readers.current.get(id);
    if (!reader) {
      reader = { current: null };
      readers.current.set(id, reader);
    }
    return reader;
  };

  // `readerFor` only reads a ref, so it is stable.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    contentRef.current = async () => ({
      sections: await Promise.all(
        entries.map(async (entry) => {
          const column = await readerFor(entry.id).current?.();
          // One editor that gives nothing fails the whole save, rather than
          // saving the page with that section empty (F-42's rule, per section).
          // The parent checks the rest of the shape before it submits.
          if (column === undefined || column === null)
            throw new Error("A section could not be read.");
          return { id: entry.id, columns: [column] };
        }),
      ),
    });
    return () => {
      contentRef.current = null;
    };
  }, [contentRef, entries]);

  // Focus follows the change once React has put the new DOM in place.
  useEffect(() => {
    if (!focusTarget) return;
    setFocusTarget(null);
    const card =
      "id" in focusTarget
        ? root.current?.querySelector<HTMLElement>(`[data-section-id="${focusTarget.id}"]`)
        : null;
    if ("id" in focusTarget && focusTarget.control === "editor") {
      focusEditorWhenReady(card ?? null);
      return;
    }
    const selector = `[data-control="${focusTarget.control}"]`;
    (card ?? root.current)?.querySelector<HTMLElement>(selector)?.focus();
  }, [focusTarget]);

  function changed(message: string) {
    setAnnouncement(message);
    onChange();
  }

  function add() {
    const id = crypto.randomUUID();
    setEntries([...entries, { id, blocks: [] }]);
    setFocusTarget({ id, control: "editor" });
    changed(`Section added. Now ${entries.length + 1} sections.`);
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    const moved = entries[index];
    if (!moved || target < 0 || target >= entries.length) return;
    const next = [...entries];
    next.splice(index, 1);
    next.splice(target, 0, moved);
    setEntries(next);
    // Keep focus on the same direction; at the end of the list that button is
    // now disabled, so it goes to the other one.
    const stillCan = by === -1 ? target > 0 : target < entries.length - 1;
    setFocusTarget({
      id: moved.id,
      control: stillCan ? (by === -1 ? "up" : "down") : by === -1 ? "down" : "up",
    });
    changed(`Section moved to position ${target + 1} of ${entries.length}.`);
  }

  function remove(index: number) {
    const gone = entries[index];
    if (!gone || entries.length < 2) return;
    readers.current.delete(gone.id);
    const next = entries.filter((entry) => entry.id !== gone.id);
    setEntries(next);
    setConfirmingId(null);
    const landing = next[Math.min(index, next.length - 1)];
    if (landing) setFocusTarget({ id: landing.id, control: "heading" });
    changed(`Section removed. ${next.length} ${next.length === 1 ? "section" : "sections"} left.`);
  }

  const atLimit = entries.length >= MAX_SECTIONS;

  return (
    <div className={styles.sections} ref={root}>
      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
      {entries.map((entry, index) => {
        const position = `Section ${index + 1} of ${entries.length}`;
        const headingId = `${hintId}-${entry.id}`;
        const confirming = confirmingId === entry.id;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a group named by its heading, not a fieldset - the editor inside is not a form field
          <div
            key={entry.id}
            className={styles.section}
            data-section-id={entry.id}
            role="group"
            aria-labelledby={headingId}
          >
            <div className={styles.sectionBar}>
              <h2
                className={styles.sectionTitle}
                id={headingId}
                tabIndex={-1}
                data-control="heading"
              >
                {position}
              </h2>
              {confirming ? (
                <div className={styles.actions}>
                  <span className={styles.confirmText}>Remove this section?</span>
                  <Button type="button" onClick={() => remove(index)} data-control="remove-confirm">
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    data-control="keep"
                    onClick={() => {
                      setConfirmingId(null);
                      setFocusTarget({ id: entry.id, control: "remove" });
                    }}
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="quiet"
                    data-control="up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Move up<span className="visually-hidden"> ({position.toLowerCase()})</span>
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    data-control="down"
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Move down<span className="visually-hidden"> ({position.toLowerCase()})</span>
                  </Button>
                  {entries.length > 1 ? (
                    <Button
                      type="button"
                      variant="quiet"
                      data-control="remove"
                      onClick={() => {
                        setConfirmingId(entry.id);
                        setFocusTarget({ id: entry.id, control: "keep" });
                      }}
                    >
                      Remove<span className="visually-hidden"> ({position.toLowerCase()})</span>
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
            <BlockEditor
              initialBlocks={entry.blocks}
              mediaById={mediaById}
              contentRef={readerFor(entry.id)}
              onChange={onChange}
              label={`Section ${index + 1} content`}
              placeholder="Write your page…"
            />
          </div>
        );
      })}
      <div className={styles.addRow}>
        <Button
          type="button"
          data-control="add"
          disabled={atLimit}
          aria-describedby={atLimit ? hintId : undefined}
          onClick={add}
        >
          Add section
        </Button>
        {atLimit ? (
          <p className={styles.hint} id={hintId}>
            A page can have up to {MAX_SECTIONS} sections.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Editor.js builds its editable block a moment after it mounts. */
function focusEditorWhenReady(card: HTMLElement | null, triesLeft = 60) {
  const editable = card?.querySelector<HTMLElement>("[contenteditable=true]");
  if (editable) {
    editable.focus();
    return;
  }
  if (triesLeft > 0) requestAnimationFrame(() => focusEditorWhenReady(card, triesLeft - 1));
}
