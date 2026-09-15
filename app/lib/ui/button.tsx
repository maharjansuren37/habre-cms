import type { ComponentProps } from "react";
import styles from "./button.module.css";

type ButtonProps = ComponentProps<"button"> & {
  /** primary: the one main action in a view; default: secondary; quiet: inline. */
  variant?: "primary" | "default" | "quiet";
  /** Set while the action runs; the caller also changes the label ("Saving…"). */
  isPending?: boolean;
};

export function Button({
  variant = "default",
  isPending = false,
  className,
  disabled,
  ...buttonProps
}: ButtonProps) {
  const classes = [styles.button, variant !== "default" && styles[variant], className];
  return (
    <button
      {...buttonProps}
      className={classes.filter(Boolean).join(" ")}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
    />
  );
}
