import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation, useSubmit } from "react-router";
import type { Block } from "#app/features/blocks/blocks.ts";
import { BlockEditor } from "#app/features/blocks/editor.client.tsx";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import { isReadableEditorContent } from "./editor-content.ts";
import styles from "./post-form.module.css";

/** What the editor screen shows about the last save attempt. */
export type SaveProblem = { kind: "invalid"; message: string } | { kind: "stale" } | null;

type PostFormProps = {
  title: string;
  /** Empty for a post that has not been saved yet. */
  slug: string;
  blocks: Block[];
  version: number;
  problem: SaveProblem;
};

export function PostForm({ title, slug, blocks, version, problem }: PostFormProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  // Editor.js owns its DOM, so its content is read on demand rather than held in
  // React state; this is the function it hands back.
  const readEditor = useRef<(() => Promise<{ blocks: unknown[] }>) | null>(null);
  const [isEditorReady, setEditorReady] = useState(false);
  const [hasUnsavedChanges, setUnsavedChanges] = useState(false);
  const [hasUnreadableContent, setUnreadableContent] = useState(false);

  // Editor.js reaches for `document` as it is constructed, so it mounts only
  // after the first client render. On the server this renders the notice below.
  useEffect(() => setEditorReady(true), []);

  const isSaving = navigation.state === "submitting";
  useEffect(() => {
    if (isSaving) setUnsavedChanges(false);
  }, [isSaving]);

  const saveState = isSaving
    ? "Saving…"
    : problem || hasUnreadableContent
      ? "Not saved - see message below"
      : hasUnsavedChanges
        ? "Not saved yet"
        : "Saved";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Four ways this can give nothing usable: Editor.js's save() resolves
    // undefined when a tool throws inside it; the ref is null before the editor
    // mounts; the result can lack `blocks`; and `editor.isReady` rejects when
    // the editor never started - which the Save button does not wait for, so
    // that click would otherwise reject silently and do nothing at all.
    // Defaulting any of them to an empty list saved over a real post (F-42).
    let content: unknown;
    try {
      content = await readEditor.current?.();
    } catch {
      content = undefined;
    }
    if (!isReadableEditorContent(content)) {
      setUnreadableContent(true);
      return;
    }
    setUnreadableContent(false);
    form.set("blocks", JSON.stringify(content));
    submit(form, { method: "post" });
  }

  return (
    <Form method="post" onSubmit={handleSubmit} className={styles.editor}>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          {/* The posts list arrives in item 3; until then, back to the admin home. */}
          <Link to="/admin" className={styles.back}>
            ← Posts
          </Link>
          <span className={styles.badge}>Draft</span>
          <span className={styles.saveState} aria-live="polite">
            {saveState}
          </span>
        </div>
        <div className={styles.topbarActions}>
          {/* Publish arrives with item 4. Save appears only once the editor has
              mounted: a native submit carries no blocks field, which reads as an
              empty post and wipes the body (F-34). */}
          {isEditorReady ? (
            <Button type="submit" isPending={isSaving}>
              {isSaving ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* One message at a time. The client-side guard wins: it describes the
          save that was just refused, while `problem` describes an earlier one
          the writer has already read. */}
      {hasUnreadableContent ? (
        <Message tone="error" title="Your changes were not saved.">
          The editor's content could not be read. Copy anything you want to keep, then reload.
        </Message>
      ) : problem?.kind === "stale" ? (
        <Message tone="error" title="Your changes were not saved.">
          Copy anything you want to keep, then reload to see the latest version.
        </Message>
      ) : problem?.kind === "invalid" ? (
        <Message tone="error" title="Your changes were not saved.">
          {problem.message}
        </Message>
      ) : null}

      <input type="hidden" name="version" value={version} />

      <div className={styles.canvas}>
        <label className={styles.titleLabel} htmlFor="post-title">
          Title
        </label>
        <input
          id="post-title"
          className={styles.title}
          name="title"
          defaultValue={title}
          placeholder="Post title"
          autoComplete="off"
          onChange={() => setUnsavedChanges(true)}
        />
        <p className={styles.address}>
          Web address: <span>{slug === "" ? "chosen when you first save" : `/posts/${slug}`}</span>
        </p>

        {isEditorReady ? (
          <BlockEditor
            initialBlocks={blocks}
            contentRef={readEditor}
            onChange={() => setUnsavedChanges(true)}
          />
        ) : (
          <p className={styles.needsJs}>
            The editor needs JavaScript. Turn it on and reload to write your post.
          </p>
        )}
      </div>
    </Form>
  );
}
