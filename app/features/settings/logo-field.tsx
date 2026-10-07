import { useEffect, useId, useRef, useState } from "react";
import {
  openMediaPickerDialog,
  type PickedMedia,
} from "#app/features/media/media-picker-dialog.client.ts";
import { Button } from "#app/lib/ui/button.tsx";
import styles from "./settings.module.css";
import { isSvg, svgToPng } from "./svg-to-png.client.ts";

export type Logo = Pick<PickedMedia, "id" | "url" | "filename" | "colours">;

const SVG_FAILED = "This SVG could not be read. Try a PNG instead.";
const FAILED = "The logo could not be uploaded. Try again.";

/** Posts one file to the logo route; the problem to show, or the stored item. */
async function uploadLogo(file: File): Promise<{ media: PickedMedia } | { problem: string }> {
  try {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/admin/settings/logo", { method: "POST", body });
    const answer: unknown = await response.json();
    if (response.ok && answer && typeof answer === "object" && "media" in answer) {
      return { media: answer.media as PickedMedia };
    }
    if (answer && typeof answer === "object" && "problem" in answer) {
      if (typeof answer.problem === "string") return { problem: answer.problem };
    }
  } catch {
    // A network failure or a reply that is not JSON reads the same to the person.
  }
  return { problem: FAILED };
}

/** Settings' Logo field: the logo shown, Upload / Choose from the library, Remove. Nothing is
 *  saved here - the parent's form posts `logo`'s id with Save settings. */
export function LogoField({
  logo,
  onChange,
}: {
  logo: Logo | null;
  onChange: (logo: Logo | null) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [wasSvg, setWasSvg] = useState(false);
  const hintId = useId();
  const problemId = useId();

  // The picker's dialog closes before it hands back a pick (media-picker-dialog.client.ts),
  // which restores focus to whatever opened it - but that element is the exact
  // one this re-render is about to remove (placeholder <-> preview swap the
  // button's own root element), so the browser's restored focus lands on a node
  // that is gone by the time it paints. The fix (F-76): re-focus a button by
  // hand once the new content exists. Skipped on mount so loading an already-set logo
  // does not steal focus from nothing.
  const fieldRef = useRef<HTMLFieldSetElement>(null);
  const hasMountedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on `logo` to re-run on every change, though the body only reads refs
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    fieldRef.current?.querySelector("button")?.focus();
  }, [logo]);

  async function onFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setProblem(null);
    setWasSvg(false);
    setIsSending(true);
    let upload = file;
    if (isSvg(file)) {
      try {
        upload = await svgToPng(file);
      } catch {
        setIsSending(false);
        input.value = "";
        setProblem(SVG_FAILED);
        return;
      }
    }
    const result = await uploadLogo(upload);
    setIsSending(false);
    // So the same file can be chosen again.
    input.value = "";
    if ("media" in result) {
      onChange(result.media);
      setWasSvg(upload !== file);
    } else setProblem(result.problem);
  }

  // Choose and Remove clear the messages about the last upload, and are unavailable while one is
  // sending, so a late upload cannot replace a newer pick. aria-disabled, not disabled, so a
  // focused button keeps focus (F-322).
  function change(next: Logo | null) {
    setProblem(null);
    setWasSvg(false);
    onChange(next);
  }

  const choose = (
    <Button
      type="button"
      variant={logo ? "quiet" : "default"}
      aria-disabled={isSending || undefined}
      onClick={() => {
        if (!isSending) openMediaPickerDialog("Choose a logo", change);
      }}
    >
      {logo ? "Change logo" : "Choose logo"}
    </Button>
  );
  const upload = (
    <label className={styles.uploadButton}>
      {isSending ? "Uploading…" : logo ? "Replace logo" : "Upload logo"}
      <input
        type="file"
        className="visually-hidden"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        aria-disabled={isSending || undefined}
        aria-busy={isSending || undefined}
        onClick={(event) => {
          if (isSending) event.preventDefault();
        }}
        aria-describedby={[hintId, problem && problemId].filter(Boolean).join(" ")}
        onChange={(event) => {
          if (!isSending) onFile(event.currentTarget);
        }}
      />
    </label>
  );

  return (
    <fieldset className={styles.logoField} ref={fieldRef}>
      <legend className={styles.logoLabel}>Logo</legend>
      {logo ? (
        <div className={styles.logoPreview}>
          <img src={logo.url} alt="" className={styles.logoImage} />
          <div className={styles.logoActions}>
            {choose}
            {upload}
            <Button
              type="button"
              variant="quiet"
              aria-disabled={isSending || undefined}
              onClick={() => {
                if (!isSending) change(null);
              }}
            >
              Remove logo
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.logoActions}>
          {choose}
          {upload}
        </div>
      )}
      <p id={hintId} className={styles.navHint}>
        PNG, JPEG, WebP, GIF or SVG, up to 10 MB.
      </p>
      {wasSvg && <p className={styles.navHint}>Saved as a PNG for the web.</p>}
      {problem && (
        <p id={problemId} className={styles.logoProblem} role="alert">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
