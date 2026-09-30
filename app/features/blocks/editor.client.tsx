import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import { useEffect, useRef } from "react";
import { type Block, type ImageMediaSummary, toEditorJs } from "./blocks.ts";
import { ImageTool } from "./image-tool.client.ts";

// Built into Editor.js; the names are its own. Shortcuts: Ctrl/Cmd+B, I, K.
const INLINE_TOOLS = ["bold", "italic", "link"];

/**
 * Editor.js, mounted in the browser only - it reaches for `document` as it is
 * constructed, so this file is `.client.tsx` and the build refuses any server
 * module that imports it.
 *
 * The component holds no React state: Editor.js owns the DOM inside its
 * container, and React re-rendering that subtree would fight it. The current
 * content is read on demand through the `contentRef` the parent passes in.
 */
export function BlockEditor({
  initialBlocks,
  mediaById = {},
  contentRef,
  onChange,
  label = "Post content",
  placeholder = "Write your post…",
}: {
  initialBlocks: Block[];
  /** Resolves each image block's media id - read once, at mount, the same as
   *  `initialBlocks`. */
  mediaById?: Record<string, ImageMediaSummary>;
  // Deliberately not Editor.js's own OutputData: the caller only forwards what
  // comes back to the server, and this keeps its types off the server side.
  contentRef: { current: (() => Promise<unknown>) | null };
  onChange: () => void;
  /** The writing area's accessible name. */
  label?: string;
  /** Shown in an empty editor. Wording from design.md: plain language. */
  placeholder?: string;
}) {
  const holder = useRef<HTMLElement>(null);
  // The editor is created once, so it would otherwise hold the first render's
  // onChange forever. Reading it through a ref keeps the latest one reachable.
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  // Mounting once is the point: re-running this would throw away whatever has been typed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate mount-once effect
  useEffect(() => {
    if (!holder.current) return;
    const editor = new EditorJS({
      holder: holder.current,
      placeholder,
      // Exactly what blocks_format v2 can store (inline-runs.ts), named so the
      // toolbar offers nothing a save would have to refuse or drop. `true` below
      // inherits this list; in 2.31.6 a tool given its own list also gets
      // Editor.js's "Convert to" menu prepended.
      inlineToolbar: INLINE_TOOLS,
      tools: {
        header: {
          class: Header as never,
          // No Bold: headings are already bold, so Editor.js's Bold un-bolds
          // them with a <span> no save can keep (F-43). The "Convert to" menu
          // this brings only offers block types that can be stored.
          inlineToolbar: ["italic", "link"],
          config: { levels: [2, 3], defaultLevel: 2 },
        },
        list: {
          class: List as never,
          inlineToolbar: true,
          // One menu entry, not three: the tool offers ordered, unordered and
          // checklist by default, and a checklist cannot be stored in v1 (F-35).
          // maxLevel 1 keeps nesting out of a format that has no place for it.
          toolbox: { title: "List" },
          config: { defaultStyle: "unordered", maxLevel: 1 },
        },
        // No inline toolbar: the block holds no text to select. Its own
        // toolbox title and icon are a static getter on the class.
        image: {
          class: ImageTool as never,
          inlineToolbar: false,
        },
      },
      data: toEditorJs(initialBlocks, mediaById) as OutputData,
      onChange: () => latestOnChange.current(),
    });

    contentRef.current = async () => {
      await editor.isReady;
      return editor.save();
    };

    return () => {
      contentRef.current = null;
      // Editor.js's destroy is async in practice; ignore a teardown race on an
      // editor that never finished starting.
      editor.isReady.then(() => editor.destroy()).catch(() => {});
    };
    // Mount once: re-running this would throw away what the writer has typed.
  }, []);

  // Named for screen readers: Editor.js's contenteditable exposes a textbox role
  // with no name of its own, so tabbing from the title would reach an
  // unlabelled edit area (WCAG 2.2, 4.1.2 Name, Role, Value - F-29).
  return <section ref={holder} aria-label={label} />;
}
