import { useId } from "react";
import styles from "./meter.module.css";

type MeterProps = {
  label: string;
  text: string;
  value: number;
  /** `null` is no limit: the text is shown without a meter. */
  max: number | null;
  className?: string;
};

/** A labelled usage meter, the kit's `.meter` on a native `<meter>`. The text describes it; with no limit there is nothing to measure, so no meter. */
export function Meter({ label, text, value, max, className }: MeterProps) {
  const id = useId();
  const textId = `${id}-text`;
  const wrapperClass = [styles.meter, className].filter(Boolean).join(" ");

  if (max === null) {
    return (
      <div className={wrapperClass}>
        <span className={styles.label}>{label}</span>
        <p className={styles.text}>{text}</p>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <p className={styles.text} id={textId}>
        {text}
      </p>
      <meter
        className={styles.bar}
        id={id}
        min={0}
        max={max}
        value={value}
        aria-describedby={textId}
      />
    </div>
  );
}
