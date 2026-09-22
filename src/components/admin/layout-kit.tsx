import clsx from "clsx";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

// The parts every admin screen is made of.
//
// Twenty-one pages each hand-wrote their own header: some text-lg, some
// text-xl md:text-2xl, some with an icon, some with the subtitle above the
// title, and the gap under it anywhere between 12 and 20px. Nobody chose
// that — it is what happens when a pattern lives in twenty-one copies. These
// are the copies, merged, so a page says what it is and the console decides
// how that looks.
//
// The shapes come from /admin/tracking-sync, which is the one screen that has
// been through this: a header that fits on one line, health as a strip of
// small tiles rather than stacked banners, counts that double as the filter,
// and a table that becomes cards on a phone instead of scrolling sideways.

/** The title block: what this page is, and its primary actions. */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  /** One line on what the page is for. Skipped when the title says it all. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-body-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * A number worth watching, optionally a link to the page that explains it.
 *
 * `tone` is about attention, not decoration: "alert" is for a count that
 * means somebody has work to do, and a zero of the same count is deliberately
 * quiet rather than green — a console where nothing is wrong should look like
 * nothing is wrong.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "plain",
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "plain" | "alert";
  href?: string;
}) {
  const alert = tone === "alert";
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={clsx("text-h4 font-bold tabular-nums", alert ? "text-amber-700" : "text-brand-ink")}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
    </>
  );
  const shell = clsx(
    "block min-w-0 rounded-xl2 border p-4 transition-colors",
    alert ? "border-amber-200 bg-amber-50/60" : "border-slate-100 bg-white",
    href && (alert ? "hover:border-amber-300" : "hover:border-slate-200"),
  );
  return href ? (
    <a href={href} className={shell}>
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** One line of the health strip: same shape whatever it reports. */
export function StatusTile({
  icon,
  label,
  value,
  tone,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone: "ok" | "warn" | "bad" | "info";
  children?: ReactNode;
}) {
  const ring = {
    ok: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
    warn: "text-amber-600 bg-amber-50 dark:bg-amber-950",
    bad: "text-rose-600 bg-rose-50 dark:bg-rose-950",
    info: "text-sky-600 bg-sky-50 dark:bg-sky-950",
  }[tone];
  return (
    <Card padded={false} className="flex min-w-0 items-start gap-3 p-4">
      <span className={clsx("grid size-9 shrink-0 place-items-center rounded-l", ring)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-brand-ink">{value}</p>
        {children}
      </div>
    </Card>
  );
}

/**
 * A count that is also the filter.
 *
 * Five tiles that could only be read, above a list that had to be scrolled
 * to find the one they described, is two controls doing half a job each.
 */
export function FilterChip({
  label,
  count,
  active,
  dot,
  onClick,
}: {
  label: ReactNode;
  count?: number;
  active: boolean;
  /** A colour that means "these need attention", shown when not selected. */
  dot?: "danger" | "warning";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {dot && !active && (
        <span
          className={clsx("size-1.5 rounded-full", dot === "danger" ? "bg-rose-500" : "bg-amber-500")}
          aria-hidden
        />
      )}
      {label}
      {count !== undefined && (
        <span className={clsx("font-bold tabular-nums", active ? "text-brand-800" : "text-slate-400")}>{count}</span>
      )}
    </button>
  );
}

/** A titled panel with an optional toolbar on its own row. */
export function Panel({
  title,
  icon,
  toolbar,
  padded = false,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  toolbar?: ReactNode;
  /** Panels holding a table keep their own padding off so it reaches the edge. */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card padded={false} className={clsx("overflow-hidden", className)}>
      {(title || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          {title && (
            <h2 className="mr-1 flex items-center gap-1.5 text-sm font-bold text-brand-ink">
              {icon}
              {title}
            </h2>
          )}
          {toolbar}
        </div>
      )}
      <div className={clsx(padded && "p-4")}>{children}</div>
    </Card>
  );
}

/**
 * The table's own look, as class names rather than a component.
 *
 * A generic <DataTable> would have to guess at every column these pages
 * need; what they actually share is the rhythm — one height per row, 13px
 * for words and 12px mono for numbers, small caps headers that stay put
 * while the body scrolls, and a hover tint so a row holds together across a
 * wide screen.
 */
export const adminTable = {
  /** Wraps the table. Add a max-height to keep the page itself from scrolling. */
  scroll: "overflow-y-auto",
  table: "w-full text-left text-[13px]",
  thead:
    "sticky top-0 z-10 bg-surface-soft text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 [&_tr]:border-b [&_tr]:border-slate-200 [&_th]:px-3 [&_th]:py-2.5",
  row: "align-middle border-t border-slate-100 transition-colors hover:bg-brand-50/40",
  cell: "px-3 py-2.5",
  /** For a tracking number, an id, an amount — anything read digit by digit. */
  mono: "px-3 py-2.5 font-mono text-[12px] text-slate-700",
  muted: "px-3 py-2.5 text-[12px] text-slate-400",
} as const;
