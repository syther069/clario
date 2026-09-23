import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "small";
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "ai";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  loadingLabel = "Working",
  size = "default",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={cx(
        "btn",
        `btn-${variant}`,
        size === "small" && "btn-sm",
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading ? loadingLabel : children}
    </button>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({
  children,
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "badge",
        tone === "ai" ? "badge-ai" : `badge-${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={cx("card", className)}>
      {children}
    </section>
  );
}

export interface StatusSentenceProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: Tone;
}

const toneSymbol: Record<Tone, string> = {
  neutral: "Status:",
  success: "Passed:",
  warning: "Review:",
  danger: "Failed:",
  info: "Info:",
  ai: "AI suggested:",
};

export function StatusSentence({
  children,
  className,
  tone = "neutral",
  ...props
}: StatusSentenceProps) {
  const toneClass = tone === "ai" ? "badge-ai" : `badge-${tone}`;
  return (
    <p {...props} className={cx("callout-box", className)}>
      <span className={cx("badge", toneClass)}>{toneSymbol[tone]}</span>{" "}
      {children}
    </p>
  );
}

export function Skeleton({
  className,
  label = "Loading",
  ...props
}: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div
      {...props}
      aria-label={label}
      aria-busy="true"
      className={cx("skeleton", className)}
      role="status"
    />
  );
}

export function FieldLabel({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} className={cx("form-label", className)}>
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("form-input", className)} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("form-textarea", className)} />;
}

export function EmptyState({
  action,
  children,
  className,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  title: string;
}) {
  return (
    <div {...props} className={cx("card", "empty-state", className)}>
      <h2 className="empty-state-title">{title}</h2>
      {children ? <p className="empty-state-copy">{children}</p> : null}
      {action}
    </div>
  );
}
