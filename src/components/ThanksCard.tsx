import type { ReactNode } from "react";
import { BellRing, PartyPopper } from "lucide-react";

// What a campaign leaves on screen after it is over.
//
// Both endings used to be a sentence in grey: the receipt campaign closed
// with "ปิดรับใบเสร็จแล้ว" and a date, the flash sale with "ปิดการขายแล้ว".
// Correct, and the last thing hundreds of people who did take part ever see
// from it — a notice that the door is shut, with no thanks in it and no
// answer to the only question they still have, which is what happens next.
//
// So the ending gets a card: thanks first, then the one thing they are
// waiting to hear, told as a notice rather than buried in a paragraph. The
// draw date for the receipt campaign; the next round for the flash sale.
//
// No "use client" and no HeroUI here on purpose. The receipt campaign page is
// a server component and the flash sale is a client one, and this has to be
// the same card on both — a client-only card would have forced the campaign
// page to hand its whole ending over to the browser for a box that never
// changes after it renders.
//
// Colour comes from --thanks-accent, which each page sets to its own: the
// receipt campaign's ink, the flash sale's per-campaign accent. A card that
// hardcoded the shop's green would be the one green thing on a purple page.

export type ThanksNotice = { title: string; body: ReactNode };

export default function ThanksCard({
  eyebrow,
  title,
  body,
  notice,
  actions,
  accent,
  compact = false,
  className = "",
}: {
  /** The status in two or three words — "ปิดรับใบเสร็จแล้ว", "สินค้าหมดแล้ว". */
  eyebrow?: string;
  /** The thanks. This is the headline; the status above it is the small print. */
  title: string;
  body: ReactNode;
  /** The one thing they are still waiting to hear. */
  notice?: ThanksNotice;
  actions?: ReactNode;
  /** The page's own colour, as a CSS value — "var(--rc-ink)". */
  accent?: string;
  /** For the flash sale's queue panel, which is a narrow column. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        // Rounded on every corner, including where the notice meets the
        // bottom edge — the notice is inset rather than flush for that
        // reason.
        "rounded-2xl bg-[color-mix(in_srgb,var(--thanks-accent,var(--color-brand-800))_7%,white)] ring-1 ring-[color-mix(in_srgb,var(--thanks-accent,var(--color-brand-800))_18%,transparent)]",
        compact ? "p-4" : "p-5 sm:p-6",
        className,
      ].join(" ")}
      style={
        accent
          ? ({ "--thanks-accent": accent } as React.CSSProperties)
          : undefined
      }
    >
      <div className={compact ? "flex gap-3" : "flex gap-3 sm:gap-4"}>
        <span
          aria-hidden
          className={[
            "grid shrink-0 place-items-center rounded-full text-white",
            compact ? "size-9" : "size-10 sm:size-11",
          ].join(" ")}
          style={{
            backgroundColor: "var(--thanks-accent, var(--color-brand-800))",
          }}
        >
          <PartyPopper size={compact ? 17 : 20} />
        </span>

        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--thanks-accent, var(--color-brand-800))" }}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className={[
              "mt-0.5 font-extrabold text-brand-ink",
              compact
                ? "text-[17px] leading-snug"
                : "text-xl leading-snug sm:text-2xl",
            ].join(" ")}
          >
            {title}
          </h2>
          <p
            className={[
              "mt-1.5 leading-relaxed text-slate-600",
              compact ? "text-[13px]" : "text-[14px] sm:text-[15px]",
            ].join(" ")}
          >
            {body}
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={[
            "rounded-xl bg-white/80 ring-1 ring-black/5",
            compact ? "mt-3 p-3" : "mt-4 p-3.5 sm:p-4",
          ].join(" ")}
        >
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-ink">
            <BellRing
              size={14}
              aria-hidden
              className="shrink-0"
              style={{ color: "var(--thanks-accent, var(--color-brand-800))" }}
            />
            {notice.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {notice.body}
          </p>
        </div>
      )}

      {actions && (
        <div
          className={[
            "flex flex-wrap items-center gap-2",
            compact ? "mt-3" : "mt-4",
          ].join(" ")}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/** The card's own button shape, so both pages' links match without either of
 *  them inventing one. */
export const thanksAction = {
  primary:
    "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90",
  secondary:
    "inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-brand-ink ring-1 ring-black/10 transition-colors hover:bg-slate-50",
} as const;
