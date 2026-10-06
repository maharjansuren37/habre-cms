import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation, useOutletContext, useSubmit } from "react-router";
import type { Document } from "#app/features/blocks/document.ts";
import { DocumentEditor } from "#app/features/blocks/document-editor.client.tsx";
import type { DocumentMedia, LinkablePage } from "#app/features/blocks/document-nodes.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import { isReadableDocumentContent } from "./editor-content.ts";
import type { EditorOutletContext } from "./editor-layout.tsx";
import { ENTRY_TOO_LONG_MESSAGE, isEntryFormSizeAllowed } from "./entry-body-size.ts";
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
  /** Search title and description (item 17); empty when not set. */
  seoTitle: string;
  seoDescription: string;
  /** Empty for an entry that has not been saved yet. */
  slug: string;
  /** The post or page's one document (item 14a1); a new entry's is empty. */
  document: Document;
  /** What the document's images need to draw (item 14a2): empty for a new entry. */
  mediaById: Record<string, DocumentMedia>;
  /** The pages a button can go to (item 14a2). */
  pages: LinkablePage[];
  status: "draft" | "published";
  version: number;
  problem: SaveProblem;
};

export function EntryForm({
  entryType,
  title,
  seoTitle,
  seoDescription,
  slug,
  document: initialDocument,
  mediaById,
  pages,
  status,
  version,
  problem,
}: EntryFormProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const { suspended } = useOutletContext<EditorOutletContext>();
  const copy = ENTRY_COPY[entryType];
  // An entry with no address yet has never been saved, so there is nothing to
  // publish - only Save, which creates it (as a draft, as today).
  const isSaved = slug !== "";
  // The editor's content is read on demand rather than held in React state;
  // this is the function it hands back.
  const readEditor = useRef<(() => Promise<unknown>) | null>(null);
  const [isEditorReady, setEditorReady] = useState(false);
  const [hasUnsavedChanges, setUnsavedChanges] = useState(false);
  // The title as typed, so the search title field can show it as its placeholder.
  const [titleNow, setTitleNow] = useState(title);
  const [hasUnreadableContent, setUnreadableContent] = useState(false);
  const [isTooLong, setTooLong] = useState(false);
  // Where the document editor draws Undo and Redo (in the top bar) and its palette.
  const [undoSlot, setUndoSlot] = useState<HTMLDivElement | null>(null);
  const [paletteSlot, setPaletteSlot] = useState<HTMLDivElement | null>(null);
  const [addSlot, setAddSlot] = useState<HTMLDivElement | null>(null);
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);

  // The editor reaches for the DOM as it is constructed, so it mounts only
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
          : problem || hasUnreadableContent || isTooLong
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
    // The ref is null before the editor mounts, and reading it can throw or
    // give something that is not a document. Defaulting any of those to an
    // empty one saved over a real post (F-42).
    let content: unknown;
    try {
      content = await readEditor.current?.();
    } catch {
      content = undefined;
    }
    if (!isReadableDocumentContent(content)) {
      setUnreadableContent(true);
      return;
    }
    setUnreadableContent(false);
    form.set("blocks", JSON.stringify(content));
    // The server refuses a body over its limit; checking first keeps that
    // round trip from happening (F-39). The server's check is the boundary.
    if (!isEntryFormSizeAllowed(form)) {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    submit(form, { method: "post" });
  }

  return (
    <Form method="post" onSubmit={handleSubmit} className={styles.editor}>
      {/* `data-sticky-bar`: dragging a block scrolls up near its lower edge (14b). */}
      <div className={styles.chrome} data-sticky-bar="">
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
            <div ref={setUndoSlot} className={styles.slot} />
            <div ref={setAddSlot} className={styles.slot} />
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
      </div>

      {/* The shell's standing notice (design.md), here too because the editor
          sits outside the shell (F-282). Not one of the save messages below. */}
      {suspended && (
        <Message tone="notice" title="This site is suspended.">
          Visitors see Not Found instead of its pages.
        </Message>
      )}

      {/* One message at a time. The client-side guards win: they describe the
          save that was just refused, while `problem` describes an earlier one
          the writer has already read. */}
      {hasUnreadableContent ? (
        <Message tone="error" title="Your changes were not saved.">
          The editor's content could not be read. Copy anything you want to keep, then reload.
        </Message>
      ) : isTooLong ? (
        <Message tone="error" title="Your changes were not saved.">
          {ENTRY_TOO_LONG_MESSAGE}
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

      <div className={styles.body}>
        <div ref={setPaletteSlot} className={styles.paletteSlot} />
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
            onChange={(event) => {
              setTitleNow(event.currentTarget.value);
              setUnsavedChanges(true);
            }}
          />
          <p className={styles.address}>
            Web address:{" "}
            <span>{slug === "" ? "chosen when you first save" : addressFor(entryType, slug)}</span>
          </p>
          <details className={styles.search}>
            <summary className={styles.searchSummary}>Search and sharing</summary>
            <div className={styles.searchBody}>
              <div className={styles.searchField}>
                <label className={styles.searchLabel} htmlFor="entry-seo-title">
                  Title in search results
                </label>
                <input
                  id="entry-seo-title"
                  className={styles.searchInput}
                  name="seoTitle"
                  defaultValue={seoTitle}
                  placeholder={titleNow.trim() === "" ? undefined : titleNow}
                  autoComplete="off"
                  aria-describedby="entry-seo-title-hint"
                  onChange={() => setUnsavedChanges(true)}
                />
                <p id="entry-seo-title-hint" className={styles.searchHint}>
                  Leave empty to use the title.
                </p>
              </div>
              <div className={styles.searchField}>
                <label className={styles.searchLabel} htmlFor="entry-seo-description">
                  Description
                </label>
                <textarea
                  id="entry-seo-description"
                  className={styles.searchTextarea}
                  name="seoDescription"
                  defaultValue={seoDescription}
                  rows={3}
                  aria-describedby="entry-seo-description-hint"
                  onChange={() => setUnsavedChanges(true)}
                />
                <p id="entry-seo-description-hint" className={styles.searchHint}>
                  Shown under the title in search results and when shared. Up to 300 characters.
                </p>
              </div>
            </div>
          </details>

          {isEditorReady ? (
            <DocumentEditor
              initialDocument={initialDocument}
              mediaById={mediaById}
              pages={pages}
              entryType={entryType}
              contentRef={readEditor}
              onChange={() => setUnsavedChanges(true)}
              undoSlot={undoSlot}
              paletteSlot={paletteSlot}
              addSlot={addSlot}
              settingsSlot={settingsSlot}
            />
          ) : (
            <p className={styles.needsJs}>
              The editor needs JavaScript. Turn it on and reload to write your {entryType}.
            </p>
          )}
        </div>
        {/* After the canvas, so the panel follows the writing area in tab order. */}
        <div ref={setSettingsSlot} className={styles.settingsSlot} />
      </div>
    </Form>
  );
}
