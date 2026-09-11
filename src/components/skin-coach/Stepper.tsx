import clsx from "clsx";

export const SCAN_STEPS = ["ถ่ายรูป", "เพิ่มมุม", "คำถาม", "ผลลัพธ์"] as const;

/**
 * Where you are in the scan and how much is left. Numbered because the
 * steps really are a sequence; the optional ones say so in their own screen.
 */
export default function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="ขั้นตอนสแกนผิว" className="mb-6">
      <p className="mb-2 text-xs text-slate-600">
        ขั้นที่ {current + 1} จาก {SCAN_STEPS.length} · <span className="font-semibold text-brand-ink">{SCAN_STEPS[current]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-1.5">
        {SCAN_STEPS.map((label, i) => (
          <li key={label} aria-current={i === current ? "step" : undefined}>
            <span className="sr-only">
              {label}
              {i < current ? " (เสร็จแล้ว)" : ""}
            </span>
            <span
              aria-hidden="true"
              className={clsx(
                "block h-1.5 rounded-full transition-colors",
                i < current ? "bg-brand-action" : i === current ? "bg-brand-800" : "bg-surface-line"
              )}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
