import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation, useSubmit } from "react-router";
import type { Block, ImageMediaSummary } from "#app/features/blocks/blocks.ts";
import { BlockEditor } from "#app/features/blocks/editor.client.tsx";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import "#app/lib/zod-jitless.client.ts";
import { isReadableEditorContent } from "./editor-content.ts";
import styles from "./entry-form.module.css";

/** What the editor screen shows about the last save attempt. */
export type SaveProblem = { kind: "invalid"; message: string } | { kind: "stale" } | null;

const STATUS_LABEL = { draft: "Draft", published: "Published" } as const;

// The handful of things a post and a page editor say differently. Shared
// rather than copied (item 6a's own Decisions): the save/publish state
// machine below is complex and has a history of subtle bugs fixed once in one
// place (F-34, F-42, D64) - duplicating it risks a fix landing in only one copy.
const ENTRY_COPY = {
  post: { backHref: "/admin/posts", backLabel: "Posts", titlePlaceholder: "Post title" },
  page: { backHref: "/admin/pages", backLabel: "Pages", titlePlaceholder: "Page title" },
} as const;

/** A page is served at the site root; a post keeps its `/posts/` prefix. */
function addressFor(entryType: "post" | "page", slug: string): string {
  return entryType === "post" ? `/posts/${slug}` : `/${slug}`;
}

type EntryFormProps = {
  entryType: "post" | "page";
  title: string;
  /** Empty for an entry that has not been saved yet. */
  slug: string;
  blocks: Block[];
  /** Resolves each image block's media id, so reopening an entry shows its
   *  images immediately - a new entry has none to resolve. */
  mediaById?: Record<string, ImageMediaSummary>;
  status: "draft" | "published";
  version: number;
  problem: SaveProblem;
};

export function EntryForm({
  entryType,
  title,
  slug,
  blocks,
  mediaById = {},
  status,
  version,
  problem,
}: EntryFormProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const copy = ENTRY_COPY[entryType];
  // An entry with no address yet has never been saved, so there is nothing to
  // publish - only Save, which creates it (as a draft, as today).
  const isSaved = slug !== "";
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

  // Which button was pressed, while its submission is in flight - read from
  // the navigation rather than component state, since the redirect on publish
  // or unpublish unmounts this form before any local state could show it.
  const pendingIntent = isSaving ? navigation.formData?.get("intent") : null;

  const saveState =
    pendingIntent === "publish"
      ? "Publishing…"
      : pendingIntent === "unpublish"
        ? "Unpublishing…"
        : isSaving
          ? "Saving…"
          : problem || hasUnreadableContent
            ? "Not saved - see message below"
            : hasUnsavedChanges
              ? "Not saved yet"
              : "Saved";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Every submit here goes through JS (the buttons only render once the
    // editor has mounted), so the plain `FormData(form)` constructor never
    // sees which button was pressed - it has to be told the submitter.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
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
          <Link to={copy.backHref} className={styles.back}>
            ← {copy.backLabel}
          </Link>
          <span className={[styles.badge, styles[status]].join(" ")}>{STATUS_LABEL[status]}</span>
          <span className={styles.saveState} aria-live="polite">
            {saveState}
          </span>
        </div>
        <div className={styles.topbarActions}>
          {/* Save appears only once the editor has mounted: a native submit
              carries no blocks field, which reads as an empty post and wipes
              the body (F-34). Publish/Unpublish wait on the post existing too
              - there is nothing to publish before the first save creates it. */}
          {isEditorReady ? (
            <Button type="submit" name="intent" value="save" isPending={isSaving}>
              {pendingIntent === "save"
                ? "Saving…"
                : status === "published"
                  ? "Save"
                  : "Save draft"}
            </Button>
          ) : null}
          {isEditorReady && isSaved ? (
            <Button
              type="submit"
              name="intent"
              value={status === "published" ? "unpublish" : "publish"}
              variant={status === "published" ? "default" : "primary"}
              isPending={isSaving}
            >
              {status === "published"
                ? pendingIntent === "unpublish"
                  ? "Unpublishing…"
                  : "Unpublish"
                : pendingIntent === "publish"
                  ? "Publishing…"
                  : "Publish"}
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
        <label className={styles.titleLabel} htmlFor="entry-title">
          Title
        </label>
        <input
          id="entry-title"
          className={styles.title}
          name="title"
          defaultValue={title}
          placeholder={copy.titlePlaceholder}
          autoComplete="off"
          onChange={() => setUnsavedChanges(true)}
        />
        <p className={styles.address}>
          Web address:{" "}
          <span>{slug === "" ? "chosen when you first save" : addressFor(entryType, slug)}</span>
        </p>

        {isEditorReady ? (
          <BlockEditor
            initialBlocks={blocks}
            mediaById={mediaById}
            contentRef={readEditor}
            onChange={() => setUnsavedChanges(true)}
          />
        ) : (
          <p className={styles.needsJs}>
            The editor needs JavaScript. Turn it on and reload to write your {entryType}.
          </p>
        )}
      </div>
    </Form>
  );
}
