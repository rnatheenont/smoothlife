import clsx from "clsx";

// Small status pill. Tones are named by meaning rather than colour so that a
// later change to what "warning" looks like happens in one place instead of
// in every file that happened to pick amber.

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

const TONE: Record<Tone, string> = {
  // dark:bg-none — see the same note on Button's soft variant.
  brand: "bg-brand-gradient-soft text-brand-800 dark:bg-none dark:bg-slate-800 dark:text-brand-200",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

export default function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
