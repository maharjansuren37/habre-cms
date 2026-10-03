import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef, useState } from "react";
import {
  type Direction,
  deleteAnnouncement,
  deleteBlock,
  kindName,
  moveAnnouncement,
  moveBlock,
  selectedBlock,
} from "./block-moves.ts";
import styles from "./block-toolbar.module.css";
import { MAX_DOCUMENT_BLOCKS } from "./document-nodes.ts";

/** What the palette says at the cap, so a refused move reads the same. */
const CAP_SENTENCE = `You can have at most ${MAX_DOCUMENT_BLOCKS} blocks.`;

/**
 * The selected block's toolbar (current-work.md, 14a3): drawn outside the
 * writing area, after it and before the chip in tab order, and placed over its
 * block by this code (CSSOM `style.top`, which `style-src 'self'` allows). One
 * tab stop: arrow keys, Home and End move within it (the ARIA toolbar
 * pattern), Escape returns to the writing area with the selection kept.
 */
export function BlockToolbar({
  editor,
  canvas,
  announce,
}: {
  editor: Editor;
  canvas: RefObject<HTMLDivElement | null>;
  announce: (message: string) => void;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  const block = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { state } = current;
      const selected = selectedBlock(state);
      if (!selected) return null;
      return {
        pos: selected.pos,
        name: kindName(selected.node),
        // The document's ends, not the cap: at the cap the button still works
        // and says why nothing moved.
        canUp: moveBlock(state, "up", Number.POSITIVE_INFINITY) !== null,
        canDown: moveBlock(state, "down", Number.POSITIVE_INFINITY) !== null,
      };
    },
  });
  const [active, setActive] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `block?.pos` is a trigger - the toolbar mounts after the transaction that selected its block, so it places itself again once drawn.
  useLayoutEffect(() => {
    /** Sits just above the selected block, kept inside the canvas. */
    function place() {
      const element = toolbar.current;
      const host = canvas.current;
      if (!element || !host || editor.isDestroyed) return;
      const selected = selectedBlock(editor.state);
      if (!selected) return;
      const dom = editor.view.nodeDOM(selected.pos);
      if (!(dom instanceof HTMLElement)) return;
      const box = dom.getBoundingClientRect();
      const frame = host.getBoundingClientRect();
      const left = Math.max(0, Math.min(box.left - frame.left, frame.width - element.offsetWidth));
      element.style.top = `${box.top - frame.top - element.offsetHeight - 8}px`;
      element.style.left = `${left}px`;
    }
    place();
    editor.on("transaction", place);
    const observer = new ResizeObserver(place);
    observer.observe(editor.view.dom);
    return () => {
      editor.off("transaction", place);
      observer.disconnect();
    };
  }, [editor, canvas, block?.pos]);

  if (!block) return null;

  function move(direction: Direction) {
    const { state } = editor;
    const selected = selectedBlock(state);
    if (!selected) return;
    const tr = moveBlock(state, direction);
    if (!tr) {
      if (moveBlock(state, direction, Number.POSITIVE_INFINITY)) announce(CAP_SENTENCE);
      return;
    }
    editor.view.dispatch(tr);
    const landed = selectedBlock(editor.state);
    if (landed) announce(moveAnnouncement(selected.node, direction, editor.state.doc, landed.pos));
  }

  function remove() {
    const { state } = editor;
    const selected = selectedBlock(state);
    const tr = deleteBlock(state);
    if (!selected || !tr) return;
    editor.view.dispatch(tr);
    announce(deleteAnnouncement(selected.node));
    editor.view.focus();
  }

  const tools = [
    {
      label: "Move up",
      disabled: !block.canUp,
      run: () => move("up"),
      icon: <path d="M12 19V5M5 12l7-7 7 7" />,
    },
    {
      label: "Move down",
      disabled: !block.canDown,
      run: () => move("down"),
      icon: <path d="M12 5v14M19 12l-7 7-7-7" />,
      separatorAfter: true,
    },
    {
      label: `Delete ${block.name.toLowerCase()}`,
      disabled: false,
      run: remove,
      icon: (
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      ),
    },
  ];
  const current = Math.min(active, tools.length - 1);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(
      toolbar.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % buttons.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      editor.view.focus();
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    setActive(next);
    buttons[next]?.focus();
  }

  return (
    <div
      ref={toolbar}
      className={styles.toolbar}
      role="toolbar"
      aria-label={block.name}
      onKeyDown={onKeyDown}
    >
      {tools.map((tool, index) => (
        <span
          key={tool.label.startsWith("Delete") ? "delete" : tool.label}
          className={styles.group}
        >
          <button
            type="button"
            className={styles.button}
            aria-label={tool.label}
            title={tool.label}
            aria-disabled={tool.disabled ? "true" : undefined}
            tabIndex={index === current ? 0 : -1}
            // A pointer press leaves focus and the caret in the writing area.
            onMouseDown={(event) => event.preventDefault()}
            onFocus={() => setActive(index)}
            onClick={() => {
              if (!tool.disabled) tool.run();
            }}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              {tool.icon}
            </svg>
          </button>
          {tool.separatorAfter ? <span className={styles.separator} aria-hidden="true" /> : null}
        </span>
      ))}
    </div>
  );
}
