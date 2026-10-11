import { type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "#app/lib/ui/button.tsx";
import fieldStyles from "#app/lib/ui/field.module.css";
import {
  type LinkablePage,
  MAX_CONTACT_BUTTON_LENGTH,
  MAX_CONTACT_THANKS_LENGTH,
} from "./document-nodes.ts";
import { isSafeHref, LINK_ERRORS } from "./inline-runs.ts";
import styles from "./settings-panel.module.css";

/**
 * The settings panel (design.md, *Settings panel*): an `aside` headed by what
 * it edits, 17rem on the right from 1024px and a bottom sheet below it. It is
 * drawn only for a block that has settings - an image or a section; text is
 * edited where it sits. Close settings and Escape inside it call `onClose`,
 * which hides the panel and returns focus to the writing area.
 *
 * Below 1024px the sheet covers the bottom of the page, so while it is open it
 * publishes its height as `--settings-sheet` on `<body>` (the canvas pads its
 * bottom by it) and scrolls the selected block above it (`keepVisible`).
 */
export function SettingsPanel({
  title,
  onClose,
  keepVisible,
  children,
}: {
  title: string;
  onClose: () => void;
  /** The selected block's element, kept above the bottom sheet. */
  keepVisible?: () => Element | null;
  children: ReactNode;
}) {
  const headingId = useId();
  const aside = useRef<HTMLElement>(null);
  const latestKeepVisible = useRef(keepVisible);
  useLayoutEffect(() => {
    latestKeepVisible.current = keepVisible;
  }, [keepVisible]);

  useLayoutEffect(() => {
    const element = aside.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      const isSheet = getComputedStyle(element).position === "fixed";
      const height = isSheet ? element.offsetHeight : 0;
      document.body.style.setProperty("--settings-sheet", `${height}px`);
      const block = latestKeepVisible.current?.();
      if (height === 0 || !block) return;
      const rect = block.getBoundingClientRect();
      const visibleBottom = window.innerHeight - height - 16;
      // Never so far that the block's own top leaves the screen.
      const shift = Math.min(rect.bottom - visibleBottom, rect.top - 16);
      if (shift > 0) window.scrollBy({ top: shift });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.body.style.removeProperty("--settings-sheet");
    };
  }, []);

  return (
    <aside
      ref={aside}
      className={styles.panel}
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        <Button
          type="button"
          variant="quiet"
          className={styles.close}
          aria-label="Close settings"
          title="Close settings"
          onClick={onClose}
        >
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.fields}>{children}</div>
    </aside>
  );
}

/** A section's settings: Columns 1 / 2 / 3 (D119 - the editor's `setColumns` does the work). */
export function SectionSettings({
  columns,
  onColumns,
}: {
  columns: number;
  onColumns: (columns: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Columns
      </label>
      <select
        id={id}
        className={styles.select}
        value={columns}
        onChange={(event) => onColumns(Number(event.currentTarget.value))}
      >
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
      </select>
    </div>
  );
}

/**
 * An image's settings: Choose / Replace image, and its alt text read-only -
 * it is set when the image is uploaded (D55). `media` is undefined for an
 * image with no file or one whose file was deleted.
 */
export function ImageSettings({
  mediaId,
  media,
  onChoose,
}: {
  mediaId: string;
  media: { altText: string } | undefined;
  onChoose: () => void;
}) {
  return (
    <>
      <div className={styles.field}>
        <Button type="button" onClick={onChoose}>
          {mediaId === "" ? "Choose image" : "Replace image"}
        </Button>
      </div>
      {mediaId !== "" && !media ? (
        <p className={styles.note}>This image is no longer available.</p>
      ) : null}
      {media ? (
        <div className={styles.field}>
          <dl className={styles.alt}>
            <dt className={styles.label}>Alt text</dt>
            <dd className={styles.readonly}>{media.altText}</dd>
          </dl>
          <p className={styles.note}>Alt text is set when the image is uploaded.</p>
        </div>
      ) : null}
    </>
  );
}

const MAX_LABEL_LENGTH = 80;
const MAX_HREF_LENGTH = 2_048;

/** What "Goes to" shows: nothing yet, a page (its `/<slug>`), or one of the two typed kinds. */
type Destination = "" | "web" | "email" | (string & {});

/** Reads a stored address back into the select's choice and the typed field's text. */
function readHref(href: string, pages: LinkablePage[]): { choice: Destination; address: string } {
  if (href === "") return { choice: "", address: "" };
  if (pages.some((page) => `/${page.slug}` === href)) return { choice: href, address: "" };
  if (href.startsWith("mailto:")) return { choice: "email", address: href.slice("mailto:".length) };
  return { choice: "web", address: href };
}

/**
 * A button's settings: its text, where it goes and its style. A page is stored
 * as `/<slug>`, an email address as `mailto:<address>`. A typed address is
 * checked with the allowlist the server uses - when the person presses Enter or
 * leaves the field, never on each keystroke - and a refused one is explained
 * beside the field and is not applied.
 *
 * The panel never sits inside the writing area (D169), but it does sit inside
 * the entry form, so Enter in the address field is handled here instead of
 * submitting the entry. Its controls carry no `name` (the radios share one only
 * to be a group), so nothing here reaches the saved form but the editor's own
 * `blocks`.
 */
export function ButtonSettings({
  label,
  href,
  style,
  pages,
  onLabel,
  onHref,
  onStyle,
}: {
  label: string;
  href: string;
  style: "filled" | "outline";
  pages: LinkablePage[];
  onLabel: (label: string) => void;
  onHref: (href: string) => void;
  onStyle: (style: "filled" | "outline") => void;
}) {
  const id = useId();
  const stored = readHref(href, pages);
  // The panel remounts for each button, so these start from what is stored.
  const [choice, setChoice] = useState<Destination>(stored.choice);
  const [address, setAddress] = useState(stored.address);
  const [error, setError] = useState<string | undefined>();
  const typedKind = choice === "web" || choice === "email" ? choice : null;

  function choose(next: Destination) {
    setChoice(next);
    setError(undefined);
    if (next === "web" || next === "email") {
      // Reopening an address of the same kind shows it; switching kind starts empty.
      setAddress(stored.choice === next ? stored.address : "");
    } else {
      setAddress("");
      if (next !== "") onHref(next);
    }
  }

  /** Applies the typed address if it passes the check; otherwise explains and leaves the stored one alone. */
  function commit() {
    const value = address.trim();
    const candidate = typedKind === "email" ? `mailto:${value}` : value;
    if (candidate.length > MAX_HREF_LENGTH) return setError(LINK_ERRORS.tooLong);
    if (typedKind === "email" && (value === "" || !value.includes("@"))) {
      return setError(LINK_ERRORS.unsafe);
    }
    if (!isSafeHref(candidate)) return setError(LINK_ERRORS.unsafe);
    setError(undefined);
    if (candidate !== href) onHref(candidate);
  }

  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const addressText = typedKind === "email" ? "Email address" : "Web address";
  return (
    <>
      <div className={fieldStyles.field}>
        <label className={fieldStyles.label} htmlFor={labelId}>
          Button text
        </label>
        <input
          id={labelId}
          className={fieldStyles.input}
          type="text"
          maxLength={MAX_LABEL_LENGTH}
          autoComplete="off"
          value={label}
          onChange={(event) => onLabel(event.currentTarget.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-goes`}>
          Goes to
        </label>
        <select
          id={`${id}-goes`}
          className={styles.select}
          value={choice}
          onChange={(event) => choose(event.currentTarget.value)}
        >
          {href === "" ? <option value="">Choose where it goes</option> : null}
          {pages.map((page) => (
            <option key={page.id} value={`/${page.slug}`}>
              {page.status === "draft" ? `${page.title} (not published)` : page.title}
            </option>
          ))}
          <option value="web">A web address…</option>
          <option value="email">An email address…</option>
        </select>
      </div>
      {typedKind ? (
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`${id}-address`}>
            {addressText}
          </label>
          <input
            id={`${id}-address`}
            className={fieldStyles.input}
            type="text"
            inputMode={typedKind === "email" ? "email" : "url"}
            autoComplete="off"
            value={address}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setAddress(event.currentTarget.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commit();
            }}
            onBlur={() => {
              // Leaving an untouched field says nothing; a typed value is checked.
              if (address !== stored.address || error) commit();
            }}
          />
          {error ? (
            <p className={fieldStyles.error} id={errorId}>
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <fieldset className={styles.group}>
        <legend className={styles.label}>Style</legend>
        {(["filled", "outline"] as const).map((value) => (
          <label key={value} className={styles.choice}>
            <input
              type="radio"
              name={`${id}-style`}
              checked={style === value}
              onChange={() => onStyle(value)}
            />
            {value === "filled" ? "Filled" : "Outline"}
          </label>
        ))}
      </fieldset>
    </>
  );
}

/**
 * A contact form's settings: the button's text and the thanks message the
 * visitor reads after a send. Both are required (1 to 40 and 1 to 200
 * characters), so an emptied field keeps what is stored until something is
 * typed. Like the button's, the panel remounts for each block and its controls
 * carry no `name`.
 */
export function ContactFormSettings({
  buttonLabel,
  thanks,
  onButtonLabel,
  onThanks,
}: {
  buttonLabel: string;
  thanks: string;
  onButtonLabel: (label: string) => void;
  onThanks: (thanks: string) => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(buttonLabel);
  const [message, setMessage] = useState(thanks);
  return (
    <>
      <div className={fieldStyles.field}>
        <label className={fieldStyles.label} htmlFor={`${id}-label`}>
          Button text
        </label>
        <input
          id={`${id}-label`}
          className={fieldStyles.input}
          type="text"
          maxLength={MAX_CONTACT_BUTTON_LENGTH}
          autoComplete="off"
          value={label}
          onChange={(event) => {
            setLabel(event.currentTarget.value);
            if (event.currentTarget.value.trim() !== "") onButtonLabel(event.currentTarget.value);
          }}
          onBlur={() => setLabel(buttonLabel)}
        />
      </div>
      <div className={fieldStyles.field}>
        <label className={fieldStyles.label} htmlFor={`${id}-thanks`}>
          Thanks message
        </label>
        <input
          id={`${id}-thanks`}
          className={fieldStyles.input}
          type="text"
          maxLength={MAX_CONTACT_THANKS_LENGTH}
          autoComplete="off"
          value={message}
          onChange={(event) => {
            setMessage(event.currentTarget.value);
            if (event.currentTarget.value.trim() !== "") onThanks(event.currentTarget.value);
          }}
          onBlur={() => setMessage(thanks)}
        />
      </div>
    </>
  );
}
