import type { ReactNode } from "react";
import styles from "./message.module.css";

type MessageProps = {
  /** `notice` is a standing fact about the site, not an action's outcome: the
   *  error look, and no role, so it is read in order and never interrupts. */
  tone: "error" | "success" | "notice";
  /** One sentence saying what happened, shown in bold. */
  title: string;
  /** What to do about it. */
  children?: ReactNode;
  /** An optional button or link that fixes it. */
  action?: ReactNode;
  className?: string;
};

/** A banner for the outcome of an action. Errors interrupt; successes are announced politely.
 *  A notice is announced not at all. */
export function Message({ tone, title, children, action, className }: MessageProps) {
  return (
    <div
      className={[styles.message, styles[tone], className].filter(Boolean).join(" ")}
      role={ROLES[tone]}
    >
      {tone === "success" ? <SuccessIcon /> : <ErrorIcon />}
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

const ROLES = { error: "alert", success: "status", notice: undefined } as const;

function ErrorIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
