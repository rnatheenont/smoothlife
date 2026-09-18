"use client";

import Image from "next/image";

// The parts that make a "special" campaign look like a ticket drop rather than
// a plain flash sale: the full-bleed key visual, the big countdown, and the
// Q&A at the foot of the page. Everything here is presentation only — the
// queue, the stock and the payment rules are the same for both kinds
// (see src/lib/flash-sale-campaigns.ts).

export type CampaignTheme = {
  kind: "regular" | "special";
  heroImage: string | null;
  heroHeadline: string | null;
  heroNote: string | null;
  accent: string;
  faq: { q: string; a: string }[];
};

/**
 * The key visual, edge to edge, with the curve the artwork has in the design
 * file. The headline sits on the image, so it is kept short and given a shadow
 * rather than a scrim: the artwork is the point of the page.
 */
export function SpecialHero({ image, headline, note }: { image: string | null; headline: string; note: string | null }) {
  return (
    <header className="relative isolate overflow-hidden bg-[#01010c] [clip-path:ellipse(140%_100%_at_50%_0%)]">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[1440px] sm:aspect-[21/9] lg:aspect-[3/1]">
        {image ? (
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_120%,var(--fs-accent),#01010c_65%)]" aria-hidden />
        )}
        <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/55 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-6 pt-8 text-center md:pt-14">
          <h1 className="text-2xl font-extrabold uppercase tracking-[0.18em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-4xl lg:text-5xl">
            {headline}
          </h1>
          {note && <p className="text-xs text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-sm">{note}</p>}
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
