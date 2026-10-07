"use client";

import { useEffect, useState } from "react";
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

export default function FlashSaleBar() {
  const { settings, loaded } = useWidgetSettings();
  const widget = settings.flash_sale_bar;
  const cfg = widget.config as {
    titleTh?: string;
    subtitleTh?: string;
    endsAt?: string;
    code?: string;
    href?: string;
  };

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

  return (
    <section className="bg-[linear-gradient(90deg,#0b6b4f_0%,#13a06a_55%,#1bb57a_100%)] text-white">
      <div className="mx-auto flex max-w-[1512px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:flex-nowrap md:px-6 md:py-4">
        <p className="shrink-0 leading-tight">
          <span className="block text-lg font-extrabold italic md:text-2xl">{title}</span>
          <span className="block text-xs italic opacity-90 md:text-sm">{subtitle}</span>
        </p>

        {cfg.endsAt && (
          // tabular-nums so the digits do not jitter the layout every second.
          <p
            aria-label="เวลาที่เหลือ"
            className="order-last w-full text-center text-lg font-bold tabular-nums tracking-[0.12em] md:order-none md:w-auto md:flex-1 md:text-2xl"
          >
            {left ? `${pad(left.d)} : ${pad(left.h)} : ${pad(left.m)} : ${pad(left.s)}` : "-- : -- : -- : --"}
          </p>
        )}

        {code && (
          <Link
            href={href}
            className="ml-auto shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-800 transition-transform hover:scale-105 active:scale-95 md:px-7 md:text-base"
          >
            Use Code : <span translate="no">{code}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
