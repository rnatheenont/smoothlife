"use client";

import Image from "next/image";

// The parts that make a "special" campaign look like a ticket drop rather than
// a plain flash sale: the full-bleed key visual, the big countdown, and the
// Q&A at the foot of the page. Everything here is presentation only — the
// queue, the stock and the payment rules are the same for both kinds
// (see src/lib/flash-sale-campaigns.ts).

export type HeroAlign = "top" | "center" | "bottom";

export type CampaignTheme = {
  kind: "regular" | "special";
  heroImage: string | null;
  heroHeadline: string | null;
  heroNote: string | null;
  /** Where the headline sits on the artwork, so it never lands on a face. */
  heroAlign: HeroAlign;
  accent: string;
  faq: { q: string; a: string }[];
};

// Vertical placement in a column layout is justify-content, not items-*.
const HERO_POSITION: Record<HeroAlign, string> = {
  top: "justify-start pt-8 md:pt-14",
  center: "justify-center py-10",
  bottom: "justify-end pb-8 md:pb-14",
};

const HERO_SCRIM: Record<HeroAlign, string> = {
  top: "inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/55 to-transparent",
  center: "inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(0,0,0,0.55),transparent)]",
  bottom: "inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 to-transparent",
};

/**
 * The key visual, edge to edge, with the curve the artwork has in the design
 * file. The headline sits on the image, so it is kept short and given a shadow
 * rather than a scrim: the artwork is the point of the page.
 */
export function SpecialHero({
  image,
  headline,
  note,
  align = "top",
}: {
  image: string | null;
  headline: string;
  note: string | null;
  align?: HeroAlign;
}) {
  return (
    <header className="relative isolate overflow-hidden bg-[#01010c] [clip-path:ellipse(140%_100%_at_50%_0%)]">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[1440px] sm:aspect-[21/9] lg:aspect-[3/1]">
        {image ? (
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_120%,var(--fs-accent),#01010c_65%)]" aria-hidden />
        )}
        <div className={`absolute ${HERO_SCRIM[align]}`} aria-hidden />
        <div className={`absolute inset-0 flex flex-col items-center px-6 text-center ${HERO_POSITION[align]}`}>
          <h1 className="text-2xl font-extrabold uppercase tracking-[0.18em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-4xl lg:text-5xl">
            {headline}
          </h1>
          {note && <p className="mt-2 text-xs text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-sm">{note}</p>}
        </div>
      </div>
    </header>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Days / hours / minutes / seconds to the next thing that happens — the sale
 * opening, or closing. Seconds keep their own column width (tabular numbers)
 * so nothing shifts as they run.
 */
export function Countdown({ label, ms }: { label: string; ms: number }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const cells: [string, string][] = [
    [String(Math.floor(total / 86400)), "วัน"],
    [pad(Math.floor((total % 86400) / 3600)), "ชั่วโมง"],
    [pad(Math.floor((total % 3600) / 60)), "นาที"],
    [pad(total % 60), "วินาที"],
  ];
  return (
    <section aria-label={label} className="rounded-2xl border border-white bg-white/50 p-4 backdrop-blur-sm sm:p-6">
      <p className="text-center text-sm font-semibold text-slate-600">{label}</p>
      <div className="mt-3 flex items-start justify-center gap-1 sm:gap-4" suppressHydrationWarning>
        {cells.map(([value, unit], i) => (
          <div key={unit} className="flex items-start">
            {i > 0 && (
              <span className="mt-3 flex flex-col gap-2 px-1 sm:mt-6 sm:px-3" aria-hidden>
                <span className="size-1 rounded-full bg-[var(--fs-accent)] opacity-40 sm:size-2" />
                <span className="size-1 rounded-full bg-[var(--fs-accent)] opacity-40 sm:size-2" />
              </span>
            )}
            <div className="w-16 text-center sm:w-28 lg:w-36">
              <p className="text-4xl font-extrabold leading-none tabular-nums text-[var(--fs-accent)] sm:text-6xl lg:text-7xl">{value}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-[var(--fs-accent)] sm:mt-3 sm:text-sm">{unit}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export type PickerItem = {
  slug: string;
  /** What tells this set apart from the others (the shared prefix is dropped). */
  name: string;
  image: string;
  pay: number;
  was: number | null;
  remaining: number | null;
  soldOut: boolean;
  disabled: boolean;
};

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/**
 * Which set of the drop to buy. A phone gets one swipeable row so the sets
 * cost a single screen-height between the countdown and the queue button;
 * from tablet up they wrap, centred, since the whole row fits.
 */
export function SetPicker({ items, value, onChange }: { items: PickerItem[]; value: string; onChange: (slug: string) => void }) {
  if (items.length < 2) return null;
  return (
    <section className="mt-6">
      <h2 className="text-center text-sm font-semibold text-slate-600">เลือกเซ็ตที่ต้องการ</h2>
      <ul
        // A horizontal scroller clips vertically too, so the selected card's
        // ring and its badge need room inside the scroller, not outside it.
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-2 scrollbar-none sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
        role="radiogroup"
        aria-label="เลือกเซ็ตที่ต้องการ"
      >
        {items.map((item) => {
          const isOn = item.slug === value;
          return (
            <li key={item.slug} className="shrink-0 snap-start">
              <button
                type="button"
                role="radio"
                aria-checked={isOn}
                disabled={item.disabled}
                onClick={() => onChange(item.slug)}
                className={`flex h-full w-[8.5rem] flex-col overflow-hidden rounded-2xl bg-white text-left transition disabled:opacity-50 sm:w-44 ${
                  isOn ? "ring-2 ring-[var(--fs-accent)]" : "ring-1 ring-surface-line hover:ring-[var(--fs-accent)]/50"
                }`}
              >
                <span className="relative block aspect-square bg-[linear-gradient(160deg,#f7f1ff,#ffffff)]">
                  <Image src={item.image} alt="" fill sizes="176px" className="object-contain p-2" />
                  {item.soldOut && (
                    <span className="absolute inset-0 grid place-items-center bg-white/75 text-sm font-bold text-slate-600">หมดแล้ว</span>
                  )}
                  {isOn && !item.soldOut && (
                    <span className="absolute right-2 top-2 rounded-full bg-[var(--fs-accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                      เลือกอยู่
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="line-clamp-2 text-xs font-medium text-brand-ink">{item.name}</span>
                  <span className="mt-auto flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-sm font-bold text-sale">{baht(item.pay)}</span>
                    {item.was && <span className="text-[11px] text-slate-400 line-through">{baht(item.was)}</span>}
                  </span>
                  {item.remaining !== null && <span className="text-[11px] text-slate-500">เหลือ {item.remaining} ชิ้น</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Questions the shop answers before a drop — plain disclosure, no script. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-center text-xl font-extrabold text-brand-ink md:text-2xl">คำถามที่พบบ่อย</h2>
      <ul className="mx-auto mt-4 flex max-w-3xl flex-col gap-2">
        {items.map((item, i) => (
          <li key={i}>
            <details className="group rounded-xl2 bg-white px-4 ring-1 ring-surface-line open:ring-[var(--fs-accent)]">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-brand-ink marker:content-none">
                {item.q}
                <span className="shrink-0 text-lg text-[var(--fs-accent)] transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
