import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import { useEffect, useRef } from "react";
import { type Block, toEditorJs } from "./blocks.ts";

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
  contentRef,
  onChange,
}: {
  initialBlocks: Block[];
  contentRef: { current: (() => Promise<OutputData>) | null };
  onChange: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
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
      // Wording from design.md: plain language, no CMS jargon.
      placeholder: "Write your post…",
      // No inline toolbar in v1: bold, italic and links arrive in item 2b, and
      // offering them now would mean quietly dropping them on save.
      inlineToolbar: false,
      tools: {
        header: { class: Header as never, config: { levels: [2, 3], defaultLevel: 2 } },
        list: { class: List as never, inlineToolbar: false },
      },
      data: toEditorJs(initialBlocks) as OutputData,
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

  return <div ref={holder} className="editor-canvas" />;
}
