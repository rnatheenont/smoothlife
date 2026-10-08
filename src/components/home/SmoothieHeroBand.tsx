"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { HaloField } from "@/components/Halo";
import QuestionSuggestions from "@/components/home/QuestionSuggestions";
import clsx from "clsx";
import { useLang } from "@/lib/lang-context";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { getProductBySlug } from "@/data/products";
import { interestsFromProducts, pickSuggestions } from "@/lib/chat-suggestions";
import { resizeForUpload } from "@/lib/image-utils";
import { HERO_PHOTO_KEY } from "@/lib/chat-handoff";
import SkyClouds from "@/components/SkyClouds";
import SmoothieMascot from "@/components/home/SmoothieMascot";

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

/** Bumped after each mount — see the `seed` note inside the component. */
let visitSeed = 0;

// The headline is an invitation that keeps rephrasing itself.
//
// Split into three parts rather than one string so the mascot's name stays
// the coloured anchor wherever it falls in the sentence — and so the spacing
// around it can be exact. The gaps are baked into these strings rather than
// added by the markup, including the one in front of "น้อง": Thai would not
// normally space its own words, but at display size the name reads as a name
// rather than as the tail of the verb in front of it.
//
// Every line is one line at every width this band is used at; nothing here
// may wrap, or the band changes height five times a minute.
type HeadLine = { pre: string; mark: string; post: string };

const HEADLINES_TH: HeadLine[] = [
  { pre: "คุยกับ ", mark: "น้อง Smoothie", post: "" },
  { pre: "ให้ ", mark: "น้อง Smoothie", post: " ช่วยเลือก" },
  { pre: "เล่าให้ ", mark: "น้อง Smoothie", post: " ฟัง" },
  { pre: "ส่งรูปให้ ", mark: "น้อง Smoothie", post: " ดู" },
  { pre: "ถาม ", mark: "น้อง Smoothie", post: " ก่อนซื้อ" },
];

const HEADLINES_EN: HeadLine[] = [
  { pre: "Chat with ", mark: "Smoothie", post: "" },
  { pre: "Let ", mark: "Smoothie", post: " pick for you" },
  { pre: "Tell ", mark: "Smoothie", post: " what's up" },
  { pre: "Show ", mark: "Smoothie", post: " a photo" },
  { pre: "Ask ", mark: "Smoothie", post: " before you buy" },
];

const HEADLINE_MS = 3800;

export default function SmoothieHeroBand() {
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t, lang } = useLang();
  const { slugs: recentSlugs } = useRecentlyViewed();

  // Rotates between visits so coming back to the home page does not open on
  // the same three lines somebody already decided not to tap. The counter
  // lives outside React and is read once, at first render: it is 0 on the
  // server and 0 on the client's first paint, so hydration agrees, and the
  // step happens after the paint rather than as a second render of it.
  const [seed] = useState(() => visitSeed);
  useEffect(() => {
    visitSeed += 1;
  }, []);

  // The headline always opens on the first line — the one with the plain
  // invitation — and only then starts moving. It holds still while somebody
  // is typing: a sentence rearranging itself above the box you are writing
  // in is the one moment it is not charming.
  const headlines = lang === "en" ? HEADLINES_EN : HEADLINES_TH;
  // Which line is showing and which one just left, so they can move the same
  // way: the new one rises into place and the old one keeps rising out of it,
  // rather than the old one sinking back down past the new one.
  const [{ cur, prev }, setLine] = useState({ cur: 0, prev: -1 });
  const [typing, setTyping] = useState(false);
  // One character in, the field starts offering questions it already knows
  // how to answer — written by an admin, or taken from what customers have
  // actually asked. It is a guide to the wording, not a search: Enter still
  // sends whatever has been typed.
  const [showHits, setShowHits] = useState(false);
  const askRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!showHits) return;
    function outside(e: MouseEvent) {
      if (askRef.current && !askRef.current.contains(e.target as Node)) setShowHits(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [showHits]);
  useEffect(() => {
    if (typing) return;
    const timer = setInterval(
      () => setLine((n) => ({ prev: n.cur, cur: (n.cur + 1) % headlines.length })),
      HEADLINE_MS
    );
    return () => clearInterval(timer);
  }, [typing, headlines.length]);

  const suggestions = useMemo(() => {
    const seen = recentSlugs
      .map((slug) => getProductBySlug(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    const { categories, concerns } = interestsFromProducts(seen);
    return pickSuggestions({ lang, categories, concerns, seed, count: 3 });
  }, [lang, recentSlugs, seed]);

  function go(text: string, photo = false) {
    const params = new URLSearchParams();
    if (text) params.set("q", text);
    if (photo) params.set("photo", "1");
    const qs = params.toString();
    router.push(qs ? `/chat?${qs}` : "/chat");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setShowHits(false);
    go(q.trim());
  }

  // The photo is shrunk here rather than in the chat so that what crosses
  // into sessionStorage is the ~1024px version, not a 6MB camera original
  // that would blow the quota on the way.
  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const resized = await resizeForUpload(file);
      sessionStorage.setItem(HERO_PHOTO_KEY, resized.dataUrl);
      go(q.trim(), true);
    } catch {
      setUploading(false);
      setPhotoError(t("ไม่สามารถอ่านรูปนี้ได้ ลองใหม่อีกครั้ง", "Couldn't read that photo, please try again."));
    }
  }

  return (
    // Pale at the top and white by the bottom edge, so the banner row that
    // follows meets it without a seam. isolate keeps the sky and the wordmark
    // — both on negative z — above this background rather than behind the
    // page.
    // overflow-x-clip, not overflow-hidden: the sky and the drifting
    // wordmark still may not widen the page, but the search results under
    // the field have to be able to hang below the band. `hidden` on one axis
    // forces the other to clip too; `clip` does not.
    // The band lifts above the banner row only while results are open, so
    // they can hang over it. It cannot stay lifted: the middle banner below
    // is scaled up and overhangs its own row by about 18px, and a band
    // parked on top of that clipped the top off it. `isolate` keeps the sky
    // and the wordmark on their negative layers inside the band either way.
    <section
      className={clsx(
        "relative isolate overflow-x-clip bg-[linear-gradient(180deg,#cbe8f7_0%,#e2f3fb_40%,#f5fbfe_72%,#ffffff_100%)]",
        showHits && "z-20"
      )}
    >
      <SkyClouds />
      {/* The wordmark drifts left on a loop rather than sitting still.
          Two identical copies inside a track as wide as they are, moving
          exactly -50%: the second copy is where the first was when the
          animation restarts, so there is no seam to see. One pass takes 45
          seconds — slow enough to be weather rather than a thing going past. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 flex w-full items-center overflow-hidden select-none"
      >
        <span className="flex w-max animate-marquee" style={{ animationDuration: "45s" }}>
          {[0, 1].map((copy) => (
            <span
              key={copy}
              className="whitespace-nowrap pr-[0.25em] font-bold leading-none tracking-tight text-white/55 text-[clamp(7rem,27vw,17rem)]"
            >
              Smoothlife.com
            </span>
          ))}
        </span>
      </span>

      {/* The heading is centred on the band, not on the space left over
          beside the mascot — as a flex sibling the mascot took 320px out of
          the row and pushed the whole question a third of that to the left of
          the page's own centre line. It is positioned instead, so it sits
          beside the question without being measured into it. */}
      <div className="relative mx-auto flex max-w-[1512px] flex-col justify-center px-4 md:min-h-[360px] md:px-6 lg:min-h-[403px]">
        <div className="mx-auto w-full max-w-[720px] py-10 text-center md:py-0">
          <p className="text-sm text-slate-500 md:text-base lg:text-lg">
            {t("ผู้ช่วยหาสินค้าที่ใช่สำหรับคุณ", "Your personal product finder")}
          </p>
          {/* All five stacked in one grid cell, so the band's height is the
              tallest of them from the first paint and nothing below it ever
              moves. Only the line on show is readable; the rest are hidden
              from assistive tech rather than announced on a timer. */}
          <h2 className="mt-2 grid text-[26px] font-bold leading-tight text-brand-ink md:text-[34px] lg:text-[42px]">
            {headlines.map((h, i) => (
              <span
                key={h.pre + h.post}
                aria-hidden={i !== cur || undefined}
                // translate, not transform: Tailwind v4 writes translate-y-*
                // to the `translate` property, and a transition that only
                // lists `transform` leaves the slide to snap.
                className={`col-start-1 row-start-1 whitespace-nowrap transition-[opacity,translate,filter] duration-500 ease-out ${
                  i === cur
                    ? "opacity-100 blur-0 translate-y-0"
                    : i === prev
                      ? "pointer-events-none opacity-0 blur-[3px] -translate-y-3"
                      : "pointer-events-none opacity-0 blur-[3px] translate-y-3"
                }`}
              >
                {h.pre}
                <span translate="no" className="text-brand-teal">
                  {h.mark}
                </span>
                {h.post}
              </span>
            ))}
          </h2>

          <form ref={askRef} onSubmit={submit} className="relative z-20 mx-auto mt-5 w-full max-w-[460px] md:mt-7">
            <label htmlFor="smoothie-hero-ask" className="sr-only">
              {t("ถามน้อง Smoothie", "Ask Smoothie")}
            </label>
            <HaloField focused={typing}>
              <input
                id="smoothie-hero-ask"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowHits(true);
                }}
                onFocus={() => {
                  setTyping(true);
                  if (q.trim()) setShowHits(true);
                }}
                onBlur={() => setTyping(false)}
                type="text"
                autoComplete="off"
                placeholder={t("วันนี้คุณรู้สึกยังไง", "How are you feeling today?")}
                // Opaque, and above the lights: the ring works by letting only
                // the one pixel around this box show through.
                className="relative block h-12 w-full rounded-full bg-white pl-5 pr-24 text-sm text-brand-ink shadow-xs outline-hidden placeholder:text-slate-400 md:h-14 md:text-base"
              />
            </HaloField>
            {/* Two buttons share the right edge: the photo first because it
                is the longer road (pick, shrink, hand over), then send. */}
            <span className="absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 items-center md:right-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={pickPhoto}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label={t("ส่งรูปให้น้อง Smoothie ดู", "Send Smoothie a photo")}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-800 disabled:opacity-60 md:h-11 md:w-11"
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              </button>
              <button
                type="submit"
                aria-label={t("ถามน้อง Smoothie", "Ask Smoothie")}
                className="grid h-9 w-9 place-items-center rounded-full text-brand-teal transition-colors hover:bg-brand-50 md:h-11 md:w-11"
              >
                <Sparkles size={22} className="fill-current" />
              </button>
            </span>
            {showHits && (
              <QuestionSuggestions
                query={q}
                onPick={(text) => {
                  setShowHits(false);
                  go(text);
                }}
              />
            )}
          </form>

          {photoError && (
            <p role="alert" className="mt-2 text-xs text-sale">
              {photoError}
            </p>
          )}

          {/* Starter questions, picked from what this visitor has been
              looking at — the same pool and the same rules the chat panel
              uses, so tapping one is the conversation already started rather
              than a different set of canned lines. */}
          {suggestions.length > 0 && (
            // One line that scrolls on a phone, three wrapped lines
            // anywhere wider. Each of these questions is a full sentence, so
            // on a 375px screen every one of them took a line of its own and
            // the three together pushed the banners below the fold. A rail
            // says the same thing in a third of the height and reads as
            // something to flick through rather than a list to read.
            <ul className="scrollbar-none -mx-4 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0">
              {suggestions.map((s) => (
                <li key={s} className="shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => go(s)}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-xs text-slate-600 transition-colors hover:border-brand-teal hover:text-brand-800 md:whitespace-normal md:text-[13px]"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* xl and up, because that is where it fits beside the question
            rather than on top of it. The heading is centred on the band and
            the mascot is pinned to the right edge, so the gap between them is
            (width/2 - half the heading) - 300 - 24: positive from about
            1200px, and 86px at xl. Narrower than that it was sitting across
            the word "Smoothie", and a mascot small enough to clear it at
            768px is a thumbnail. */}
        <SmoothieMascot className="absolute bottom-0 right-6 hidden h-[300px] w-[300px] xl:block" />
      </div>
    </section>
  );
}
