import { useEffect, useId, useRef, useState } from "react";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import {
  type Block,
  fromEditorJs,
  type ImageMediaSummary,
  LEGACY_SECTION_ID,
  MAX_COLUMNS,
  MAX_SECTIONS,
  type Section,
} from "./blocks.ts";
import { BlockEditor } from "./editor.client.tsx";
import { pickedMedia } from "./image-tool.client.ts";
import { isPlainSection, resizeColumns } from "./sections.ts";
import styles from "./sections-editor.module.css";

type ColumnReader = { current: (() => Promise<unknown>) | null };

/** What the list holds for a section: its id, and the blocks each column's
 *  editor starts with. Editor.js owns the content from then on - it is read back
 *  on save. */
type PlainEntry = {
  kind: "plain";
  id: string;
  columns: Block[][];
  /** Bumped when the column count changes, which re-mounts the section's editors. */
  rev: number;
};

/** What a hero's form holds - the same four texts the save sends. */
type HeroFields = { heading: string; text: string; buttonLabel: string; buttonHref: string };

/** A ready-made hero or call to action: plain form fields, no Editor.js. */
type SlotKind = "hero" | "cta";
type SlotEntry = { kind: SlotKind; id: string; fields: HeroFields };

type Entry = PlainEntry | SlotEntry;

/** Where focus goes after the list changes, since the control that held it may
 *  have moved, been disabled or gone. */
type FocusTarget =
  | {
      id: string;
      control:
        | "heading"
        | "up"
        | "down"
        | "remove"
        | "keep"
        | "editor"
        | "hero-heading"
        | "cta-heading";
    }
  | { control: "add" };

/**
 * A page's sections, each with its own Editor.js (D114). The section list lives
 * here in React; every Editor.js owns the DOM inside its own section, so React
 * never re-renders inside one, and a move only moves the section's card.
 *
 * `contentRef` hands the parent what the save sends: `{ sections: [{ id,
 * columns: [{ blocks }] }] }`, read from every column's editor on demand. A
 * section has 1-3 columns, one Editor.js each.
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
    initialSections.map((section): Entry => {
      if (!isPlainSection(section)) {
        const { heading, text, button } = section.data;
        return {
          kind: section.type,
          id: section.id,
          fields: {
            heading,
            text,
            buttonLabel: button?.label ?? "",
            buttonHref: button?.href ?? "",
          },
        };
      }
      return {
        kind: "plain",
        id: section.id === LEGACY_SECTION_ID ? crypto.randomUUID() : section.id,
        columns: section.data.children,
        rev: 0,
      };
    }),
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** Why a section's column count could not change; it is left as it was. */
  const [layoutError, setLayoutError] = useState<{ id: string; message: string } | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const readers = useRef(new Map<string, ColumnReader>());
  const root = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const readerFor = (id: string, column: number): ColumnReader => {
    const key = `${id}:${column}`;
    let reader = readers.current.get(key);
    if (!reader) {
      reader = { current: null };
      readers.current.set(key, reader);
    }
    return reader;
  };

  // `readerFor` only reads a ref, so it is stable.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    contentRef.current = async () => ({
      sections: await Promise.all(
        entries.map(async (entry) => {
          if (entry.kind !== "plain")
            return { id: entry.id, kind: entry.kind, fields: entry.fields };
          const columns = await Promise.all(
            entry.columns.map((_, index) => readerFor(entry.id, index).current?.()),
          );
          // One editor that gives nothing fails the whole save, rather than
          // saving the page with that column empty (F-42's rule, per column).
          // The parent checks the rest of the shape before it submits.
          if (columns.some((column) => column === undefined || column === null))
            throw new Error("A section could not be read.");
          return { id: entry.id, columns };
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

  // Typing in any column may be the fix for the message above, so it clears it.
  function edited() {
    setLayoutError(null);
    onChange();
  }

  function changed(message: string) {
    setAnnouncement(message);
    onChange();
  }

  function add() {
    const id = crypto.randomUUID();
    setEntries([...entries, { kind: "plain", id, columns: [[]], rev: 0 }]);
    setFocusTarget({ id, control: "editor" });
    changed(`Section added. Now ${entries.length + 1} sections.`);
  }

  function addSlotSection(kind: SlotKind) {
    const id = crypto.randomUUID();
    const fields = { heading: "", text: "", buttonLabel: "", buttonHref: "" };
    setEntries([...entries, { kind, id, fields }]);
    setFocusTarget({ id, control: `${kind}-heading` });
    changed(
      `${kind === "cta" ? "Call to action" : "Hero"} section added. Now ${entries.length + 1} sections.`,
    );
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
    if (gone.kind === "plain")
      for (let column = 0; column < gone.columns.length; column++)
        readers.current.delete(`${gone.id}:${column}`);
    const next = entries.filter((entry) => entry.id !== gone.id);
    setEntries(next);
    setConfirmingId(null);
    const landing = next[Math.min(index, next.length - 1)];
    if (landing) setFocusTarget({ id: landing.id, control: "heading" });
    changed(`Section removed. ${next.length} ${next.length === 1 ? "section" : "sections"} left.`);
  }

  /** Changes one section's column count. Every column is read back first and the
   *  blocks are re-seeded through `resizeColumns`, so shrinking merges rather than
   *  discards; if any column cannot be read, nothing changes. */
  async function setColumns(index: number, count: number) {
    const entry = entries[index];
    if (entry?.kind !== "plain" || entry.columns.length === count) return;
    const before = entry.columns.length;
    let read: unknown[];
    try {
      read = await Promise.all(
        entry.columns.map((_, column) => readerFor(entry.id, column).current?.()),
      );
    } catch {
      // An editor that fails to hand its content over is refused like an
      // unreadable one: nothing changes, and the writer is told.
      setLayoutError({
        id: entry.id,
        message: `Section ${index + 1} could not be read. Try again in a moment.`,
      });
      return;
    }
    const blocks: Block[][] = [];
    for (const [column, output] of read.entries()) {
      const name = `Section ${index + 1}${before > 1 ? `, column ${column + 1}` : ""}`;
      const result =
        output === undefined || output === null
          ? ({ ok: false, message: `${name} could not be read.` } as const)
          : fromEditorJs(output, name);
      if (!result.ok) {
        setLayoutError({
          id: entry.id,
          message: `${result.message} Fix that, then change the columns again.`,
        });
        return;
      }
      blocks.push(result.blocks);
    }
    for (let column = count; column < before; column++)
      readers.current.delete(`${entry.id}:${column}`);
    setLayoutError(null);
    setEntries((current) =>
      current.map((each) =>
        each.kind === "plain" && each.id === entry.id
          ? { ...each, columns: resizeColumns(blocks, count), rev: each.rev + 1 }
          : each,
      ),
    );
    const plural = (n: number) => `${n} ${n === 1 ? "column" : "columns"}`;
    changed(
      count > before
        ? `Section ${index + 1} now has ${plural(count)}.`
        : `Section ${index + 1} now has ${plural(count)}. ${
            before - count === 1 ? `Column ${before}` : `Columns ${count + 1} to ${before}`
          } merged into column ${count}.`,
    );
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
              {entry.kind !== "plain" ? (
                <span className={styles.kindTag}>
                  {entry.kind === "cta" ? "Call to action" : "Hero"}
                </span>
              ) : (
                <fieldset className={styles.layout}>
                  <legend className={styles.layoutLegend}>
                    Columns<span className="visually-hidden"> ({position.toLowerCase()})</span>
                  </legend>
                  {Array.from({ length: MAX_COLUMNS }, (_, option) => option + 1).map((count) => (
                    <label key={count} className={styles.layoutOption}>
                      <input
                        type="radio"
                        name={`${hintId}-columns-${entry.id}`}
                        checked={entry.columns.length === count}
                        onChange={() => void setColumns(index, count)}
                      />
                      {count} {count === 1 ? "column" : "columns"}
                    </label>
                  ))}
                </fieldset>
              )}
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
            {layoutError?.id === entry.id ? (
              <Message tone="error" title="The columns were not changed.">
                {layoutError.message}
              </Message>
            ) : null}
            {entry.kind !== "plain" ? (
              <HeroForm
                kind={entry.kind}
                idPrefix={`${hintId}-${entry.id}`}
                fields={entry.fields}
                onChange={(fields) => {
                  setEntries((current) =>
                    current.map((each) =>
                      each.kind !== "plain" && each.id === entry.id ? { ...each, fields } : each,
                    ),
                  );
                  edited();
                }}
              />
            ) : (
              <div key={entry.rev} className={styles.columns} data-columns={entry.columns.length}>
                {entry.columns.map((blocks, columnIndex) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns carry no id; the count only changes by remounting the section
                    key={columnIndex}
                    className={styles.column}
                  >
                    <BlockEditor
                      initialBlocks={blocks}
                      mediaById={{ ...mediaById, ...pickedMedia }}
                      contentRef={readerFor(entry.id, columnIndex)}
                      onChange={edited}
                      label={
                        entry.columns.length === 1
                          ? `Section ${index + 1} content`
                          : `Section ${index + 1}, column ${columnIndex + 1} content`
                      }
                      placeholder="Write your page…"
                    />
                  </div>
                ))}
              </div>
            )}
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
          Add blank section
        </Button>
        <Button
          type="button"
          data-control="add-hero"
          disabled={atLimit}
          aria-describedby={atLimit ? hintId : undefined}
          onClick={() => addSlotSection("hero")}
        >
          Add hero section
        </Button>
        <Button
          type="button"
          data-control="add-cta"
          disabled={atLimit}
          aria-describedby={atLimit ? hintId : undefined}
          onClick={() => addSlotSection("cta")}
        >
          Add call to action
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

const HERO_FIELDS = [
  { name: "heading", label: "Heading (required)", hint: "Up to 120 characters." },
  { name: "text", label: "Text", hint: "Up to 400 characters. One paragraph." },
  {
    name: "buttonLabel",
    label: "Button label",
    hint: "Leave the label and link empty for no button.",
  },
  {
    name: "buttonHref",
    label: "Button link",
    hint: "Starts with https://, mailto:, / or #.",
  },
] as const;

/**
 * A hero's slots as plain controls - no Editor.js. They carry no `name`, so the
 * page form never posts them by themselves: the save sends them through
 * `contentRef` like every other section.
 */
function HeroForm({
  kind,
  idPrefix,
  fields,
  onChange,
}: {
  kind: SlotKind;
  idPrefix: string;
  fields: HeroFields;
  onChange: (fields: HeroFields) => void;
}) {
  return (
    <div className={styles.heroForm}>
      {HERO_FIELDS.map((slot) => {
        const { name } = slot;
        // A call to action's button is not optional.
        const required = name === "heading" || (kind === "cta" && name.startsWith("button"));
        const label =
          kind === "cta" && name.startsWith("button") ? `${slot.label} (required)` : slot.label;
        const hint = kind === "cta" && name === "buttonLabel" ? "Up to 40 characters." : slot.hint;
        const id = `${idPrefix}-${name}`;
        const shared = {
          id,
          className: styles.heroInput,
          value: fields[name],
          "aria-describedby": `${id}-hint`,
          "aria-required": required ? (true as const) : undefined,
          "data-control": `${kind}-${name}`,
        };
        return (
          <div key={name} className={styles.heroField}>
            <label className={styles.heroLabel} htmlFor={id}>
              {label}
            </label>
            {name === "text" ? (
              <textarea
                {...shared}
                rows={3}
                onChange={(event) => onChange({ ...fields, [name]: event.target.value })}
              />
            ) : (
              <input
                {...shared}
                type="text"
                inputMode={name === "buttonHref" ? "url" : undefined}
                onChange={(event) => onChange({ ...fields, [name]: event.target.value })}
              />
            )}
            <p className={styles.hint} id={`${id}-hint`}>
              {hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}
