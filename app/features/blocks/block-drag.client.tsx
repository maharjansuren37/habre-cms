import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { useEditor } from "@tiptap/react";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./block-drag.module.css";
import {
  CAP_SENTENCE,
  DRAG_CANCELLED,
  type DropSlot,
  type DropSource,
  dragName,
  drop,
  dropAnnouncement,
  dropZoneLabel,
  hoverAnnouncement,
  type MeasuredColumn,
  type Rect,
  type SectionSlot,
  sectionDropZoneLabel,
  sectionHoverAnnouncement,
  sectionSlotAt,
  slotAt,
} from "./block-drops.ts";
import { blockKind, columnsOf } from "./block-moves.ts";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";
import {
  type DraggingTile,
  KIND_ICONS,
  SECTION_ICONS,
  SECTIONS_FULL_NOTE,
} from "./palette.client.tsx";
import {
  insertSection,
  SECTION_TEMPLATE_NAMES,
  sectionAddedAnnouncement,
  topLevelPosition,
} from "./palette-insert.ts";
import type { SectionTemplate } from "./section-templates.ts";

type Editor = NonNullable<ReturnType<typeof useEditor>>;

/**
 * Drag and drop (item 14b): the selected block by its grip, or a palette tile,
 * to any place in any column. Pointer Events, so mouse, pen and touch alike;
 * no HTML5 drag and drop, no library (current-work.md, Decisions).
 */

/** A drag starts after the pointer moves this far; a shorter press is a click. */
const THRESHOLD = 6;
/** Where the ghost sits from the pointer, so it never hides the place being aimed at. */
const GHOST_OFFSET = 12;

/* ---- The gap -------------------------------------------------------------
 * A widget decoration inside the writing area - the only way it can open and
 * push the blocks below it down - plus a node decoration dimming the dragged
 * block. Neither is content: not stored, not focusable, hidden from assistive
 * technology (the status region says where the block will land). */

type Gap = {
  slot: DropSlot | null;
  /** Where a dragged section lands: a gap between top-level sections. */
  section: SectionSlot | null;
  label: string;
  dragged: number | null;
};
const NO_GAP: Gap = { slot: null, section: null, label: "", dragged: null };
const gapKey = new PluginKey<Gap>("dropGap");

/** The document position of a slot: before the column's child `index`, or its end. */
function slotPos(doc: ProseMirrorNode, slot: DropSlot): number | null {
  const column = columnsOf(doc).find((c) => c.section === slot.section && c.column === slot.column);
  if (!column) return null;
  if (slot.index < 0 || slot.index > column.node.childCount) return null;
  let pos = column.pos + 1;
  for (let i = 0; i < slot.index; i++) {
    pos += column.node.child(i).nodeSize;
  }
  return pos;
}

function dropZone(label: string): HTMLElement {
  const zone = document.createElement("div");
  zone.className = styles.dropZone;
  zone.dataset.dropZone = "";
  zone.setAttribute("aria-hidden", "true");
  zone.contentEditable = "false";
  const text = document.createElement("span");
  text.className = styles.dropZoneLabel;
  text.textContent = label;
  zone.append(text);
  return zone;
}

function gapDecorations(state: EditorState): DecorationSet | null {
  const gap = gapKey.getState(state);
  if (!gap || (gap.slot === null && gap.section === null && gap.dragged === null)) return null;
  const decorations: Decoration[] = [];
  const dragged = gap.dragged === null ? null : state.doc.nodeAt(gap.dragged);
  if (gap.dragged !== null && dragged) {
    decorations.push(
      Decoration.node(gap.dragged, gap.dragged + dragged.nodeSize, {
        class: styles.dragged,
        "data-dragged": "",
      }),
    );
  }
  let at: number | null = null;
  if (gap.slot) at = slotPos(state.doc, gap.slot);
  else if (gap.section) at = topLevelPosition(state.doc, gap.section.index);
  if (at !== null) {
    const { label } = gap;
    decorations.push(
      Decoration.widget(at, () => dropZone(label), {
        side: -1,
        key: `drop-zone:${label}`,
        ignoreSelection: true,
      }),
    );
  }
  return DecorationSet.create(state.doc, decorations);
}

/**
 * The gap's plugin. Its transactions carry only a meta: they change no
 * document and add no history, so `onUpdate` never fires and a cancelled drag
 * leaves the form unchanged. Any change to the document clears it.
 */
export const DropGap = Extension.create({
  name: "dropGap",
  addProseMirrorPlugins() {
    return [
      new Plugin<Gap>({
        key: gapKey,
        state: {
          init: () => NO_GAP,
          apply: (tr, value) =>
            (tr.getMeta(gapKey) as Gap | undefined) ?? (tr.docChanged ? NO_GAP : value),
        },
        props: { decorations: gapDecorations },
      }),
    ];
  },
});

function setGap(editor: Editor, gap: Gap) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(gapKey, gap).setMeta("addToHistory", false));
}

function sameSlot(a: DropSlot | null, b: DropSlot | null): boolean {
  return (
    a === b ||
    (!!a && !!b && a.section === b.section && a.column === b.column && a.index === b.index)
  );
}

function sameSectionSlot(a: SectionSlot | null, b: SectionSlot | null): boolean {
  return a === b || (!!a && !!b && a.index === b.index);
}

/**
 * Whether something drawn over the writing area (the sticky top bar, the
 * settings sheet below 1024px) is the topmost element at the point. Such a
 * point is no place, whatever section lies underneath.
 */
function covered(editor: Editor, x: number, y: number): boolean {
  const top = document.elementFromPoint(x, y);
  return !top || !editor.view.dom.contains(top);
}

/** The block slot under the point, or null outside every section or under an overlay. */
function blockSlotUnder(editor: Editor, x: number, y: number): DropSlot | null {
  return covered(editor, x, y) ? null : slotAt(measure(editor), x, y);
}

/** The section slot under the point: the top-level sections' rects against the writing area's. */
function sectionSlotUnder(editor: Editor, x: number, y: number): SectionSlot | null {
  const { view, state } = editor;
  if (covered(editor, x, y)) return null;
  const rects: Rect[] = [];
  state.doc.forEach((_, offset) => {
    const dom = view.nodeDOM(offset);
    if (dom instanceof HTMLElement) rects.push(dom.getBoundingClientRect());
  });
  return sectionSlotAt(rects, view.dom.getBoundingClientRect(), x, y);
}

/** What a section drop needs beyond the editor: the entry's type and the section cap. */
export type SectionDropOptions = { entryType: "post" | "page"; maxSections: number };

/** Adds the template at `at` as one undo step, focuses the writing area and announces; says why when there is no room. */
function dropSection(
  editor: Editor,
  template: SectionTemplate,
  at: SectionSlot,
  options: SectionDropOptions,
  announce: (message: string) => void,
) {
  if (topLevelPosition(editor.state.doc, at.index) === null) {
    announce(DRAG_CANCELLED);
    return;
  }
  const tr = insertSection(editor.state, template, {
    allowMainHeading: options.entryType === "page",
    maxSections: options.maxSections,
    maxBlocks: MAX_DOCUMENT_BLOCKS,
    index: at.index,
  });
  if (!tr) {
    announce(
      editor.state.doc.childCount >= options.maxSections ? SECTIONS_FULL_NOTE : CAP_SENTENCE,
    );
    return;
  }
  editor.view.dispatch(tr);
  editor.view.focus();
  announce(sectionAddedAnnouncement(template, at.index, editor.state.doc.childCount));
}

/** Every column's rect, its section's rect, and its blocks' rects (the gap is not a block). */
function measure(editor: Editor): MeasuredColumn[] {
  const { view, state } = editor;
  const measured: MeasuredColumn[] = [];
  for (const column of columnsOf(state.doc)) {
    const dom = view.nodeDOM(column.pos);
    const sectionDom = view.nodeDOM(state.doc.resolve(column.pos).before());
    if (!(dom instanceof HTMLElement) || !(sectionDom instanceof HTMLElement)) continue;
    const blocks: Rect[] = [];
    let pos = column.pos + 1;
    column.node.forEach((child) => {
      const block = view.nodeDOM(pos);
      if (block instanceof HTMLElement) blocks.push(block.getBoundingClientRect());
      pos += child.nodeSize;
    });
    measured.push({
      section: column.section,
      column: column.column,
      rect: dom.getBoundingClientRect(),
      sectionRect: sectionDom.getBoundingClientRect(),
      blocks,
    });
  }
  return measured;
}

/** How near the window's bottom, or the sticky top bar's lower edge, auto-scroll starts. */
const SCROLL_ZONE = 48;
/** The fastest auto-scroll, in pixels a frame, at the very edge. */
const SCROLL_MAX = 24;

/**
 * Pixels to scroll this frame for a pointer at `y`: down near the window's
 * bottom, up near the sticky top bar's lower edge, faster nearer the edge.
 */
function scrollSpeed(y: number): number {
  const top = document.querySelector("[data-sticky-bar]")?.getBoundingClientRect().bottom ?? 0;
  const bottom = window.innerHeight;
  const ramp = (distance: number) =>
    Math.ceil(SCROLL_MAX * Math.min(1, (SCROLL_ZONE - Math.max(0, distance)) / SCROLL_ZONE));
  if (y > bottom - SCROLL_ZONE) return ramp(bottom - y);
  if (y < top + SCROLL_ZONE) return -ramp(y - top);
  return 0;
}

/**
 * Swallows the click a drag's release would send to the element it started
 * on (the grip announcing itself, a tile adding its block). With the pointer
 * still down, it waits for the gesture to end: a release, a cancel (a touch
 * the browser took for a pan), or one second, whichever comes first. Each call
 * removes only its own blocker.
 */
function swallowClick(pointerStillDown: boolean) {
  const block = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", block, true);
  if (!pointerStillDown) {
    setTimeout(() => window.removeEventListener("click", block, true), 0);
    return;
  }
  let timer = 0;
  const end = (afterClick: boolean) => {
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    clearTimeout(timer);
    // A release is followed at once by its click, which is still swallowed;
    // a cancel and the fallback have no click coming.
    if (afterClick) setTimeout(() => window.removeEventListener("click", block, true), 0);
    else window.removeEventListener("click", block, true);
  };
  const onUp = () => end(true);
  const onCancel = () => end(false);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onCancel, true);
  timer = window.setTimeout(() => end(false), 1000);
}

/** What a tile or the grip calls on `pointerdown`: the one entry point for every drag. */
export type StartDrag = (source: DropSource, event: ReactPointerEvent<HTMLElement>) => void;

/**
 * The drag controller, owned by the document editor (not the toolbar, which
 * re-renders as the selection moves). Returns `startDrag`, the ghost to
 * render, and the tile being dragged, which the palette draws dashed. Hit-testing runs at most once per animation frame; the document
 * changes only on release.
 */
export function useBlockDrag(
  editor: Editor | null,
  announce: (message: string) => void,
  { entryType, maxSections }: SectionDropOptions,
): { startDrag: StartDrag; ghost: ReactNode; draggingTile: DraggingTile } {
  const [ghost, setGhost] = useState<{
    kind: NonNullable<DraggingTile>;
    icon: ReactNode;
    name: string;
    fromTile: boolean;
  } | null>(null);
  const ghostElement = useRef<HTMLDivElement | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const stop = useRef<(() => void) | null>(null);
  const latestAnnounce = useRef(announce);
  useEffect(() => {
    latestAnnounce.current = announce;
  }, [announce]);

  // Unmounting mid-drag removes the listeners, the ghost and the gap.
  useEffect(() => () => stop.current?.(), []);

  const startDrag = useCallback<StartDrag>(
    (source, event) => {
      if (!editor || stop.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const current = editor;
      const target = event.currentTarget;
      const { pointerId } = event;
      const start = { x: event.clientX, y: event.clientY };
      point.current = start;
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // Not every element can capture (a detached one); the window still hears the pointer.
      }
      let dragging = false;
      // A section template lands between sections; a block source in a column.
      // `source` is narrowed with `"template" in source` where each path splits.
      let slot: DropSlot | null = null;
      let shown: DropSlot | null = null;
      let shownSection: SectionSlot | null = null;
      let frame = 0;
      let said = "";

      function say(message: string) {
        if (message === said) return;
        said = message;
        latestAnnounce.current(message);
      }

      function placeGhost() {
        const element = ghostElement.current;
        if (element) {
          element.style.translate = `${point.current.x + GHOST_OFFSET}px ${point.current.y + GHOST_OFFSET}px`;
        }
      }

      function begin() {
        dragging = true;
        document.documentElement.dataset.blockDragging = "";
        if ("template" in source) {
          const { template } = source;
          setGhost({
            kind: template,
            icon: SECTION_ICONS[template],
            name: SECTION_TEMPLATE_NAMES[template],
            fromTile: true,
          });
          setGap(current, { ...NO_GAP, label: sectionDropZoneLabel(template) });
          return;
        }
        // A moved block exists at its position, as `dragName` and `drop` also assume.
        const kind =
          "pos" in source
            ? blockKind(current.state.doc.nodeAt(source.pos) as ProseMirrorNode)
            : source.kind;
        setGhost({
          kind,
          icon: KIND_ICONS[kind],
          name: dragName(current.state, source),
          fromTile: !("pos" in source),
        });
        setGap(current, {
          ...NO_GAP,
          label: dropZoneLabel(current.state, source),
          dragged: "pos" in source ? source.pos : null,
        });
      }

      /** One hit-test: the slot under the pointer, the gap there (none on the block's own place), and the status. */
      function update() {
        frame = 0;
        if (!dragging) return;
        placeGhost();
        // Near an edge the window scrolls every frame, the pointer still or
        // not, and the slot is measured again after it.
        const speed = scrollSpeed(point.current.y);
        if (speed !== 0) {
          window.scrollBy(0, speed);
          frame = requestAnimationFrame(update);
        }
        if ("template" in source) {
          const { template } = source;
          const at = sectionSlotUnder(current, point.current.x, point.current.y);
          if (!sameSectionSlot(at, shownSection)) {
            shownSection = at;
            setGap(current, { ...(gapKey.getState(current.state) ?? NO_GAP), section: at });
          }
          say(sectionHoverAnnouncement(template, at, current.state.doc.childCount));
          return;
        }
        const next = blockSlotUnder(current, point.current.x, point.current.y);
        if (sameSlot(next, slot) && said) return;
        slot = next;
        const result = next ? drop(current.state, source, next) : null;
        const visible = result && typeof result === "object" ? next : null;
        if (!sameSlot(visible, shown)) {
          shown = visible;
          const gap = gapKey.getState(current.state) ?? NO_GAP;
          setGap(current, { ...gap, slot: visible });
        }
        say(hoverAnnouncement(current.state, source, next));
      }

      function finish(clearGap: boolean) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        current.off("transaction", onTransaction);
        try {
          if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
        } catch {
          // Already released.
        }
        delete document.documentElement.dataset.blockDragging;
        if (dragging) {
          setGhost(null);
          if (clearGap) setGap(current, NO_GAP);
        }
        stop.current = null;
      }

      function cancel(clearGap = true, pointerStillDown = false) {
        const wasDragging = dragging;
        finish(clearGap);
        dragging = false;
        if (wasDragging) {
          latestAnnounce.current(DRAG_CANCELLED);
          swallowClick(pointerStillDown);
        }
      }

      function onMove(moved: PointerEvent) {
        if (moved.pointerId !== pointerId) return;
        point.current = { x: moved.clientX, y: moved.clientY };
        if (!dragging) {
          if (Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < THRESHOLD) return;
          begin();
        }
        if (!frame) frame = requestAnimationFrame(update);
      }

      function onUp(released: PointerEvent) {
        if (released.pointerId !== pointerId) return;
        if (!dragging) {
          // A click: the element's own click handler runs.
          finish(true);
          return;
        }
        point.current = { x: released.clientX, y: released.clientY };
        const at =
          "template" in source ? sectionSlotUnder(current, point.current.x, point.current.y) : null;
        const final =
          "template" in source ? null : blockSlotUnder(current, point.current.x, point.current.y);
        finish(true);
        dragging = false;
        swallowClick(false);
        if ("template" in source) {
          if (at)
            dropSection(
              current,
              source.template,
              at,
              { entryType, maxSections },
              latestAnnounce.current,
            );
          else latestAnnounce.current(DRAG_CANCELLED);
          return;
        }
        if (!final) {
          latestAnnounce.current(DRAG_CANCELLED);
          return;
        }
        const before = current.state;
        const result = drop(before, source, final);
        if (result === "invalid") {
          latestAnnounce.current(DRAG_CANCELLED);
          return;
        }
        if (result === "in-place") return;
        if (result === "full") {
          latestAnnounce.current(CAP_SENTENCE);
          return;
        }
        current.view.dispatch(result.tr);
        latestAnnounce.current(dropAnnouncement(before, source, current.state.doc, result.pos));
        current.view.focus();
      }

      function onCancel(cancelled: PointerEvent) {
        if (cancelled.pointerId === pointerId) cancel();
      }

      function onKey(pressed: KeyboardEvent) {
        if (pressed.key !== "Escape" || !dragging) return;
        pressed.preventDefault();
        pressed.stopPropagation();
        cancel(true, true);
      }

      /** Any change to the document mid-drag (a Ctrl+Z, say) cancels, so a stale position is never used. */
      function onTransaction({ transaction }: { transaction: Transaction }) {
        if (!transaction.docChanged) return;
        // The plugin has already cleared the gap; dispatching here would nest.
        if (dragging) cancel(false, true);
        else finish(false);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      current.on("transaction", onTransaction);
      stop.current = () => finish(true);
    },
    [editor, entryType, maxSections],
  );

  const ghostNode = ghost
    ? createPortal(
        <div
          ref={(element) => {
            ghostElement.current = element;
            if (element) {
              element.style.translate = `${point.current.x + GHOST_OFFSET}px ${point.current.y + GHOST_OFFSET}px`;
            }
          }}
          className={styles.ghost}
          data-drag-ghost=""
          aria-hidden="true"
        >
          <svg
            className={styles.ghostIcon}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
          >
            {ghost.icon}
          </svg>
          {ghost.name}
        </div>,
        document.body,
      )
    : null;

  return { startDrag, ghost: ghostNode, draggingTile: ghost?.fromTile ? ghost.kind : null };
}
