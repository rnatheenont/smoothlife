"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useLang } from "@/lib/lang-context";

// The first thing on the page is a question, not a banner.
//
// The campaign artwork still runs directly underneath; this sits above it
// because the one thing this shop has that a marketplace does not is somebody
// to ask. Typing here hands the question straight to the full-screen chat,
// so the first message is the shopper's own words rather than a greeting they
// have to reply to.
//
// The wordmark behind it is decoration, drawn once at a size that runs off
// both edges and clipped by the band. It is aria-hidden and unselectable: a
// screen reader announcing "Smoothlife.com" between the header and the
// heading is noise, and a cursor dragging across the headline should not
// highlight a word nobody can see.

export default function SmoothieHeroBand() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const { t } = useLang();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    router.push(text ? `/chat?q=${encodeURIComponent(text)}` : "/chat");
  }

  return (
    <section className="relative isolate overflow-hidden bg-white">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-bold leading-none tracking-tight text-[#dff0ea] text-[clamp(7rem,27vw,17rem)]"
      >
        Smoothlife.com
      </span>

      {/* The heading is centred on the band, not on the space left over
          beside the mascot — as a flex sibling the mascot took 320px out of
          the row and pushed the whole question a third of that to the left of
          the page's own centre line. It is positioned instead, so it sits
          beside the question without being measured into it. */}
      <div className="relative mx-auto flex max-w-[1512px] flex-col justify-center px-4 md:min-h-[360px] md:px-6 lg:min-h-[403px]">
        <div className="mx-auto w-full max-w-[560px] py-10 text-center md:py-0">
          <p className="text-sm text-slate-500 md:text-base lg:text-lg">
            {t("ผู้ช่วยหาสินค้าที่ใช่สำหรับคุณ", "Your personal product finder")}
          </p>
          <h2 className="mt-2 text-[28px] font-bold leading-tight text-brand-ink md:text-[40px] lg:text-[48px]">
            {t("คุยกับน้อง", "Chat with")}{" "}
            <span translate="no" className="text-brand-teal">
              Smoothie
            </span>
          </h2>

          <form onSubmit={submit} className="relative mx-auto mt-5 w-full max-w-[460px] md:mt-7">
            <label htmlFor="smoothie-hero-ask" className="sr-only">
              {t("ถามน้อง Smoothie", "Ask Smoothie")}
            </label>
            <input
              id="smoothie-hero-ask"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="text"
              autoComplete="off"
              placeholder={t("วันนี้คุณรู้สึกยังไง", "How are you feeling today?")}
              className="h-12 w-full rounded-full border border-slate-200 bg-white pl-5 pr-14 text-sm text-brand-ink shadow-xs outline-hidden transition-colors placeholder:text-slate-400 focus:border-brand-teal md:h-14 md:text-base"
            />
            <button
              type="submit"
              aria-label={t("ถามน้อง Smoothie", "Ask Smoothie")}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-brand-teal transition-colors hover:bg-brand-50 md:right-2 md:h-11 md:w-11"
            >
              <Sparkles size={22} className="fill-current" />
            </button>
          </form>
        </div>

        {/* Below md the mascot would have to share about 200px with a 28px
            headline, so it steps out rather than being shrunk to a thumbnail
            or laid over the words. */}
        <div className="pointer-events-none absolute bottom-0 right-4 hidden h-[240px] w-[240px] md:block md:right-6 lg:h-[300px] lg:w-[300px]">
          {/* The character in the design is a full-body one in a lab coat
              that public/mascot does not have — every file there is a head.
              This is the same head the chat widget uses, so at least it is
              the mascot the shopper meets next. */}
          <Image
            src="/mascot/smoothie-new.png"
            alt=""
            fill
            sizes="320px"
            className="object-contain object-bottom"
          />
        </div>
      </div>
    </section>
  );
}
