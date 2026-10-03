import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type Direction,
  deleteAnnouncement,
  deleteBlock,
  kindName,
  mainHeading,
  mainHeadingAnnouncement,
  moveAnnouncement,
  moveBlock,
  selectedBlock,
  setMainHeading,
  shortQuote,
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
  entryType,
  onLink,
}: {
  editor: Editor;
  canvas: RefObject<HTMLDivElement | null>;
  announce: (message: string) => void;
  /** A page has one Main heading; a post has none. */
  entryType: "post" | "page";
  /** Opens the link dialog, which the editor draws (unchanged from the format bar). */
  onLink: () => void;
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
        kind: selected.kind,
        name: kindName(selected.node),
        // The document's ends, not the cap: at the cap the button still works
        // and says why nothing moved.
        canUp: moveBlock(state, "up", Number.POSITIVE_INFINITY) !== null,
        canDown: moveBlock(state, "down", Number.POSITIVE_INFINITY) !== null,
        // Main heading is for one block, never a range.
        isRange: !state.selection.$from.sameParent(state.selection.$to),
        main: mainHeading(state.doc)?.textContent ?? null,
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        link: current.isActive("link"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
      };
    },
  });
  const [active, setActive] = useState(0);
  const [isStyleOpen, setStyleOpen] = useState(false);

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

  /** Runs a formatting command, then returns focus to the writing area at once
   *  (not TipTap's `focus()`, which waits a frame). */
  function format(command: () => void) {
    command();
    editor.view.focus();
  }

  const hasStyle = block.kind === "text" || block.kind === "heading";
  const hasText = hasStyle || block.kind === "list" || block.kind === "quote";
  const lists: Tool[] =
    block.kind === "list"
      ? [
          {
            key: "bullet",
            label: "Bulleted list",
            pressed: block.bulletList,
            run: () => format(() => editor.commands.toggleBulletList()),
            icon: (
              <>
                <path d="M9 6h11M9 12h11M9 18h11" />
                <circle cx="4.5" cy="6" r="1" />
                <circle cx="4.5" cy="12" r="1" />
                <circle cx="4.5" cy="18" r="1" />
              </>
            ),
          },
          {
            key: "ordered",
            label: "Numbered list",
            pressed: block.orderedList,
            run: () => format(() => editor.commands.toggleOrderedList()),
            icon: <path d="M10 6h10M10 12h10M10 18h10M4 4h1.5v4M4 8h3M4 11.5h3l-3 4h3" />,
          },
        ]
      : [];
  const marks: Tool[] = hasText
    ? [
        {
          key: "bold",
          label: "Bold",
          pressed: block.bold,
          run: () => format(() => editor.commands.toggleBold()),
          icon: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />,
        },
        {
          key: "italic",
          label: "Italic",
          pressed: block.italic,
          run: () => format(() => editor.commands.toggleItalic()),
          icon: <path d="M10 5h8M6 19h8M14 5l-4 14" />,
        },
        {
          key: "link",
          label: "Link",
          pressed: block.link,
          run: onLink,
          icon: (
            <>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </>
          ),
          separatorAfter: true,
        },
      ]
    : [];
  const tools: Tool[] = [
    {
      key: "up",
      label: "Move up",
      disabled: !block.canUp,
      run: () => move("up"),
      icon: <path d="M12 19V5M5 12l7-7 7 7" />,
    },
    {
      key: "down",
      label: "Move down",
      disabled: !block.canDown,
      run: () => move("down"),
      icon: <path d="M12 5v14M19 12l-7 7-7-7" />,
      separatorAfter: true,
    },
    ...(hasStyle ? [{ key: "style", label: block.name, menu: true as const }] : []),
    ...lists,
    ...marks,
    {
      key: "delete",
      label: `Delete ${block.name.toLowerCase()}`,
      run: remove,
      icon: (
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      ),
    },
  ];
  const current = Math.min(active, tools.length - 1);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(
      toolbar.current?.querySelectorAll<HTMLButtonElement>("[data-tool]") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
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
      // Leaving the toolbar starts its tab stop at Move up again, so an index
      // kept from one block never lands on another block's Delete (F-183).
      onBlur={(event) => {
        if (!toolbar.current?.contains(event.relatedTarget as Node | null)) setActive(0);
      }}
    >
      {tools.map((tool, index) => (
        <span key={tool.key} className={styles.group}>
          {"menu" in tool ? (
            <TextStyleButton
              editor={editor}
              current={tool.label}
              offerMain={entryType === "page" && !block.isRange}
              main={block.main}
              announce={announce}
              isOpen={isStyleOpen}
              setOpen={setStyleOpen}
              tabIndex={index === current ? 0 : -1}
              onFocus={() => setActive(index)}
            />
          ) : (
            <button
              type="button"
              data-tool=""
              className={styles.button}
              aria-label={tool.label}
              title={tool.label}
              aria-disabled={tool.disabled ? "true" : undefined}
              aria-pressed={tool.pressed}
              tabIndex={index === current ? 0 : -1}
              // A pointer press leaves focus and the caret in the writing area.
              onMouseDown={(event) => event.preventDefault()}
              onFocus={() => setActive(index)}
              onClick={() => {
                if (!tool.disabled) tool.run();
              }}
            >
              <Icon>{tool.icon}</Icon>
            </button>
          )}
          {tool.separatorAfter ? <span className={styles.separator} aria-hidden="true" /> : null}
        </span>
      ))}
    </div>
  );
}

type Tool =
  | {
      key: string;
      label: string;
      disabled?: boolean;
      pressed?: boolean;
      run: () => void;
      icon: ReactNode;
      separatorAfter?: boolean;
    }
  | { key: string; label: string; menu: true; separatorAfter?: boolean };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** The Text style menu's choices, each drawn at its own size (design.md, Editor decisions). */
const STYLES = [
  { label: "Text", level: 0, className: styles.styleText },
  { label: "Main heading", level: 1, className: styles.styleMain },
  { label: "Heading", level: 2, className: styles.styleHeading },
  { label: "Subheading", level: 3, className: styles.styleSubheading },
  { label: "Small heading", level: 4, className: styles.styleSmall },
] as const;

/**
 * The Text style menu button and its menu (the ARIA menu button pattern): the
 * button shows the current style; Enter, Space or Down opens the menu with
 * focus on the checked item, arrows, Home and End move, Enter chooses and
 * returns to the writing area, Escape closes back to the button.
 */
function TextStyleButton({
  editor,
  current,
  offerMain,
  main,
  announce,
  isOpen,
  setOpen,
  tabIndex,
  onFocus,
}: {
  editor: Editor;
  current: string;
  /** Whether Main heading is offered: on a page, for one block. */
  offerMain: boolean;
  /** The page's main heading's text, for the hint, or null. */
  main: string | null;
  announce: (message: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  tabIndex: number;
  onFocus: () => void;
}) {
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Opening puts focus on the checked item, before the next key arrives.
  useLayoutEffect(() => {
    if (!isOpen) return;
    // The first item when none matches (a range in the main heading, F-181).
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    (
      menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? items?.[0]
    )?.focus();
  }, [isOpen]);

  function close(focusButton: boolean) {
    setOpen(false);
    if (focusButton) button.current?.focus();
  }

  function choose(level: number) {
    setOpen(false);
    if (level === 1) {
      const result = setMainHeading(editor.state);
      if (result) {
        editor.view.dispatch(result.tr);
        if (result.demoted) announce(mainHeadingAnnouncement(result.demoted));
      }
      editor.view.focus();
      return;
    }
    if (level === 0) editor.commands.setParagraph();
    else editor.commands.setHeading({ level: level as 2 | 3 | 4 });
    // Now, not TipTap's `focus()`, which waits a frame and can take focus back
    // from wherever a quick Tab has already moved it.
    editor.view.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (at + 1) % items.length;
    else if (event.key === "ArrowUp") next = (at - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    // Every other key stays out of the toolbar's own arrow handling.
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    items[next]?.focus();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        data-tool=""
        className={`${styles.button} ${styles.styleButton}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onMouseDown={(event) => event.preventDefault()}
        // Closing from the button keeps focus on it, not on an item it removes (F-182).
        onClick={() => (isOpen ? close(true) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="visually-hidden">Text style: </span>
        {current}
        <Icon>
          <path d="m6 9 6 6 6-6" />
        </Icon>
      </button>
      {isOpen ? (
        <div
          ref={menu}
          id={menuId}
          className={styles.menu}
          role="menu"
          aria-label="Text style"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          onBlur={(event) => {
            if (!menu.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          {STYLES.filter((style) => style.level !== 1 || offerMain).map((style) => (
            <button
              key={style.label}
              type="button"
              role="menuitemradio"
              aria-checked={style.label === current}
              tabIndex={-1}
              className={styles.menuItem}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(style.level)}
            >
              {style.level === 1 ? (
                <span>
                  <span className={style.className}>{style.label}</span>
                  <span className={styles.hint}>
                    {main === null || current === "Main heading"
                      ? "One per page."
                      : `One per page. Now: "${shortQuote(main)}"`}
                  </span>
                </span>
              ) : (
                <span className={style.className}>{style.label}</span>
              )}
              <Icon>
                <path d="M5 12l5 5L20 7" />
              </Icon>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
