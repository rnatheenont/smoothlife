"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useWidgetSettings } from "@/lib/use-widget-settings";

// The countdown band under the category row.
//
// Everything in it — the words, the code, the deadline, whether it is there
// at all — comes from the widget the admin edits, so a campaign starts and
// ends without a deploy. When the deadline passes the band removes itself:
// a flash sale still counting "00 : 00 : 00 : 00" the morning after is worse
// than no flash sale.
//
// The clock is the one thing that cannot be server-rendered, because the
// server's "now" is whenever the page was built or cached. It renders as
// placeholder dashes and fills in on the first tick, which is also what
// keeps hydration from mismatching.

type Parts = { d: number; h: number; m: number; s: number };

function remaining(endsAt: string): Parts | null {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The two ends of the band's gradient, as the admin may set them. Only a
 *  plain hex is accepted: this goes straight into an inline style, and a
 *  field an admin types into is not a place to accept arbitrary CSS. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const hex = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;

/** Stacked offsets, darkest first, then one soft drop. Reads as the digits
 *  standing off the band rather than as a blur behind them. */
const DIGIT_3D =
  "0 1px 0 rgba(0,0,0,0.22), 0 2px 0 rgba(0,0,0,0.18), 0 3px 0 rgba(0,0,0,0.12), 0 7px 16px rgba(0,0,0,0.35)";

export default function FlashSaleBar() {
  const { settings, loaded } = useWidgetSettings();
  const widget = settings.flash_sale_bar;
  const cfg = widget.config as {
    titleTh?: string;
    subtitleTh?: string;
    endsAt?: string;
    code?: string;
    href?: string;
    colorFrom?: string;
    colorTo?: string;
  };

  const [copied, setCopied] = useState(false);

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // No clipboard (insecure origin, or the browser said no). Saying
      // nothing is better than claiming a copy that did not happen.
      return;
    }
    setCopied(true);
  }

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // null = not counted yet (first render), undefined = the deadline is past.
  const [left, setLeft] = useState<Parts | null | undefined>(null);

  useEffect(() => {
    if (!cfg.endsAt) return;
    const tick = () => setLeft(remaining(cfg.endsAt!) ?? undefined);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cfg.endsAt]);

  // Nothing is drawn until the settings have actually arrived, so a disabled
  // band never flashes up on its way to being hidden.
  if (!loaded || !widget.enabled) return null;
  if (cfg.endsAt && left === undefined) return null;

  const title = cfg.titleTh || "Flash Sale";
  const subtitle = cfg.subtitleTh || "now on!";
  const code = cfg.code;
  const href = cfg.href || "/promotions";

  const from = hex(cfg.colorFrom, "#0b6b4f");
  const to = hex(cfg.colorTo, "#1bb57a");

  return (
    <section
      className="text-white"
      // The band's colours are the campaign's, set in the admin panel. The
      // middle stop is derived rather than asked for: two fields are a
      // decision an admin can make in a second, three is a gradient editor.
      style={{ background: `linear-gradient(90deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="container-page flex flex-wrap items-center gap-x-6 gap-y-3 py-3 md:flex-nowrap md:py-4">
        <Link href={href} className="shrink-0 leading-tight">
          <span className="block text-lg font-extrabold italic md:text-2xl">{title}</span>
          <span className="block text-xs italic opacity-90 md:text-sm">{subtitle}</span>
        </Link>

        {cfg.endsAt && (
          // tabular-nums so the digits do not jitter the layout every second.
          <p
            aria-label="เวลาที่เหลือ"
            className="order-last w-full text-center text-2xl font-extrabold tabular-nums tracking-[0.1em] md:order-none md:w-auto md:flex-1 md:text-4xl"
            style={{ textShadow: DIGIT_3D }}
          >
            {left ? `${pad(left.d)} : ${pad(left.h)} : ${pad(left.m)} : ${pad(left.s)}` : "-- : -- : -- : --"}
          </p>
        )}

        {code && (
          // Tapping the code copies it. A code is something you take somewhere
          // else, so the one thing to do with it is have it on the clipboard —
          // the band's own title carries the link to the campaign.
          <button
            type="button"
            onClick={() => copyCode(code)}
            aria-label={`คัดลอกโค้ด ${code}`}
            className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-800 transition-transform hover:scale-105 active:scale-95 md:px-7 md:text-base"
          >
            {copied ? (
              <>
                <Check size={16} strokeWidth={3} /> คัดลอกแล้ว
              </>
            ) : (
              <>
                <Copy size={15} /> Use Code : <span translate="no">{code}</span>
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
