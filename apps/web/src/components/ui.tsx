import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The approved design patterns from /style, as reusable pieces. Layout uses logical properties
// (ms/me/ps/pe, text-start) so right-to-left languages work without changes.

type ButtonKind = "primary" | "secondary" | "quiet" | "danger";

const buttonStyles: Record<ButtonKind, string> = {
  primary: "bg-accent text-accent-ink",
  secondary: "border-2 border-outline text-ink",
  quiet: "text-accent underline underline-offset-4",
  danger: "border-2 border-danger text-danger",
};

const buttonBase =
  "inline-flex min-h-tap-target items-center justify-center gap-2 rounded-full px-5 font-semibold disabled:opacity-60";

export function Button({
  kind = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { kind?: ButtonKind }) {
  return (
    <button
      type="button"
      className={`${buttonBase} ${buttonStyles[kind]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  kind = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { kind?: ButtonKind }) {
  return <Link className={`${buttonBase} ${buttonStyles[kind]} ${className}`} {...props} />;
}

export function PageShell({
  title,
  back,
  actions,
  wide = false,
  children,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  /** For screens that put two things side by side on a desktop, like a recording beside its recipe. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      <header className="flex flex-col gap-3">
        {back && (
          <Link href={back.href} className="flex items-center gap-1 self-start text-muted">
            <span aria-hidden className="rtl:rotate-180">
              ←
            </span>
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {actions}
        </div>
      </header>
      {children}
    </main>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-lg bg-surface p-4 ${className}`} />;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-outline px-5 py-8">
      <h3 className="text-xl">{title}</h3>
      <p className="text-muted">{body}</p>
      {action}
    </div>
  );
}

/** Initials, or the photo when there is one. Initials take the first grapheme of each word. */
export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "size-20 text-2xl" : "size-12 text-lg";
  if (photoUrl) {
    return (
      // Signed, short-lived private URLs: next/image would proxy and cache them.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      aria-hidden
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-sunken font-serif font-semibold text-accent`}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? "")
    .join("");
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-medium">
        {label}
        {optional && <span className="ms-2 text-sm font-normal text-muted">{optional}</span>}
      </span>
      {children}
      {hint && !error && <span className="text-sm text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-sm font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

const inputBase =
  "min-h-tap-target w-full rounded-md border-2 border-outline bg-surface px-3 text-lg aria-invalid:border-danger";

export function TextInput(props: ComponentProps<"input">) {
  return <input className={inputBase} {...props} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea className={`${inputBase} py-2`} rows={4} {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select className={inputBase} {...props} />;
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-md px-4 py-3 ${kind === "error" ? "bg-sunken text-danger" : "bg-sunken text-success"}`}
    >
      {children}
    </p>
  );
}
