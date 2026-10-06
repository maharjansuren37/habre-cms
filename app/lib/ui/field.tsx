import { type ComponentProps, useId } from "react";
import styles from "./field.module.css";

type FieldProps = Omit<ComponentProps<"input">, "name"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  /** Fixed text after the input, such as the sites domain. Announced with the field. */
  suffix?: string;
};

/** A labelled input. The label is always visible; hint and error are announced with it. */
export function Field({
  label,
  name,
  hint,
  error,
  suffix,
  className,
  id: givenId,
  ...inputProps
}: FieldProps) {
  const generatedId = useId();
  // A caller passes an id when something else links to the field (an error summary).
  const id = givenId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const suffixId = `${id}-suffix`;
  const describedBy = [suffix && suffixId, hint && hintId, error && errorId]
    .filter(Boolean)
    .join(" ");

  const input = (
    <input
      {...inputProps}
      id={id}
      name={name}
      className={styles.input}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
    />
  );

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {suffix ? (
        <div className={styles.inputGroup}>
          {input}
          <span className={styles.addon} id={suffixId}>
            {suffix}
          </span>
        </div>
      ) : (
        input
      )}
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
