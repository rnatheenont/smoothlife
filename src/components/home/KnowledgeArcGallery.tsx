"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getProductBySlug } from "@/data/products";
import ProductCard from "@/components/ProductCard";

export type ArcItem = {
  key: string;
  href: string;
  title: string;
  image: string | null;
  /** What the brand this post talks about sells — see lib/article-products.
   *  Empty when the post names no brand, and then it gets no shelf. */
  productSlugs: string[];
};

// Article covers laid along a gentle arc that drifts sideways, after the
// "circular gallery" on fastwork.co/for-business. Theirs is a WebGL canvas;
// this is ordinary DOM so every card stays a real link — focusable, crawlable,
// and with Thai titles rendered as text rather than painted into a texture.
//
// A click on a cover that is not the chosen one chooses it and shows what the
// post is about underneath; a click on the chosen one opens the post. Same
// rule as the concern carousel: once something below is reading from a
// selection, the unselected ones are things to pick, not things to open.

const SPEED = 28; // px per second of auto-drift
const MIN_CARDS = 9; // enough to fill a 1920px row with no gap at the seam
const DRAG_THRESHOLD = 6; // px before a press becomes a drag (and not a click)

// Covers come from Shopify's CDN, which resizes on request. Cards are at most
// 280px wide, so 560 covers 2x screens at about 40% of the 900px original.
function cardImage(url: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.includes("/cdn/shop/") || u.hostname === "cdn.shopify.com") u.searchParams.set("width", "560");
    return u.toString();
  } catch {
    return url;
  }
}

export default function KnowledgeArcGallery({ items }: { items: ArcItem[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Opens on the first post that actually has something to show, so the shelf
  // is not empty on arrival.
  const [activeKey, setActiveKey] = useState(
    () => items.find((i) => i.productSlugs.length > 0)?.key ?? items[0]?.key
  );
  const active = items.find((i) => i.key === activeKey) ?? items[0];
  const shelf = (active?.productSlugs ?? [])
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // Repeated until the row is long enough to loop without a visible seam; the
  // repeats are hidden from assistive tech and the tab order.
  const copies = items.length ? Math.max(1, Math.ceil(MIN_CARDS / items.length)) : 0;
  const cards = Array.from({ length: copies }, (_, c) => items.map((item) => ({ ...item, copy: c }))).flat();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || cards.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = {
      offset: 0,
      velocity: 0,
      target: null as number | null,
      hovered: false,
      focused: false,
      visible: true,
      drag: null as null | { startX: number; startOffset: number; lastX: number; lastT: number; moved: boolean },
      suppressClick: false,
      positions: [] as number[],
      cardW: 0,
      width: 0,
    };

    const layout = () => {
      const W = stage.clientWidth;
      const cardW = cardRefs.current[0]?.offsetWidth || 280;
      const step = cardW + (cardW >= 260 ? 20 : 14);
      const total = cards.length * step;
      const center = W / 2;
      // A circle twice the stage width: the edges drop ~W/16 and tilt ~14°,
      // close to the reference at every screen size.
      const R = Math.max(W * 2, 600);
      const start = center - total / 2;
      s.cardW = cardW;
      s.width = W;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const x = ((((i * step - s.offset - start) % total) + total) % total) + start;
        const dx = x + cardW / 2 - center;
        const clamped = Math.max(-R, Math.min(R, dx));
        const y = R - Math.sqrt(R * R - clamped * clamped);
        const angle = Math.asin(clamped / R);
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad)`;
        s.positions[i] = x;
      });
    };

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.drag) {
        if (s.target !== null) {
          s.offset += (s.target - s.offset) * Math.min(1, dt * 10);
          if (Math.abs(s.target - s.offset) < 0.5) s.target = null;
        } else if (Math.abs(s.velocity) > 5) {
          s.offset += s.velocity * dt;
          s.velocity *= Math.pow(0.04, dt); // flick coasts to a stop in about a second
        } else if (!reduced && !s.hovered && !s.focused && s.visible) {
          s.offset += SPEED * dt;
        }
      }
      layout();
      raf = requestAnimationFrame(tick);
    };

    layout();
    // Shown only once every card has a position — before that they all sit
    // stacked at the left edge. Set on the element, not through state, so
    // nothing re-renders for it.
    stage.style.opacity = "1";
    raf = requestAnimationFrame(tick);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // A drag released off the cards produces no click, so the flag it set
      // would otherwise swallow the next real one.
      s.suppressClick = false;
      s.target = null;
      s.velocity = 0;
      s.drag = { startX: e.clientX, startOffset: s.offset, lastX: e.clientX, lastT: performance.now(), moved: false };
    };
    const onMove = (e: PointerEvent) => {
      const d = s.drag;
      if (!d) return;
      const delta = e.clientX - d.startX;
      if (!d.moved && Math.abs(delta) > DRAG_THRESHOLD) {
        d.moved = true;
        stage.setPointerCapture(e.pointerId);
      }
      if (!d.moved) return;
      const now = performance.now();
      const dtm = Math.max(1, now - d.lastT);
      s.velocity = (-(e.clientX - d.lastX) / dtm) * 1000;
      d.lastX = e.clientX;
      d.lastT = now;
      s.offset = d.startOffset - delta;
    };
    const onUp = () => {
      if (s.drag?.moved) s.suppressClick = true;
      s.drag = null;
    };
    // A drag that ends on a card must not open it.
    const onClick = (e: MouseEvent) => {
      if (s.suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        s.suppressClick = false;
      }
    };
    // Tabbing to a card brings it to the middle, where it can be read.
    const onFocusIn = (e: FocusEvent) => {
      s.focused = true;
      const i = cardRefs.current.indexOf(e.target as HTMLAnchorElement);
      if (i < 0) return;
      s.target = s.offset + (s.positions[i] + s.cardW / 2 - s.width / 2);
    };
    const onFocusOut = () => {
      s.focused = false;
    };
    const onEnter = () => (s.hovered = true);
    const onLeave = () => (s.hovered = false);

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("click", onClick, true);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);

    // Off screen, or in a background tab, there is nothing to animate for.
    const io = new IntersectionObserver(([entry]) => (s.visible = entry.isIntersecting));
    io.observe(stage);
    const ro = new ResizeObserver(layout);
    ro.observe(stage);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("click", onClick, true);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <>
    <div
      ref={stageRef}
      // pan-y: a sideways swipe moves the row, an up/down swipe still scrolls the page.
      className="relative h-[230px] cursor-grab touch-pan-y select-none overflow-hidden opacity-0 transition-opacity duration-500 active:cursor-grabbing sm:h-[340px]"
    >
      {cards.map((a, i) => {
        const repeat = a.copy > 0;
        return (
          <Link
            key={`${a.key}-${a.copy}`}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            href={a.href}
            draggable={false}
            aria-hidden={repeat || undefined}
            tabIndex={repeat ? -1 : undefined}
            aria-current={a.key === activeKey ? "true" : undefined}
            title={a.title}
            onClick={(e) => {
              if (a.key === activeKey) return;
              e.preventDefault();
              setActiveKey(a.key);
            }}
            className={`absolute left-0 top-5 block aspect-[16/10] w-[200px] origin-center overflow-hidden rounded-2xl bg-surface-mist shadow-[0_14px_32px_-14px_rgba(15,23,42,0.45)] outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-brand-800 sm:w-[280px] ${
              a.key === activeKey ? "ring-2 ring-brand-teal" : "ring-1 ring-black/5"
            }`}
          >
            {a.image && (
              <Image
                src={cardImage(a.image)}
                alt=""
                fill
                sizes="280px"
                draggable={false}
                className="pointer-events-none object-cover"
              />
            )}
            <span className="absolute bottom-2.5 left-2.5 max-w-[85%] truncate rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm sm:text-[12px]">
              {a.title}
            </span>
          </Link>
        );
      })}
    </div>

    {/* What the chosen post's brand sells. Hidden outright when the post
        names no brand: an empty panel under an article says the feature is
        broken, where no panel just says this one has nothing to sell. */}
    {shelf.length > 0 && active && (
      <div className="mx-auto mt-6 max-w-[1512px] px-4 md:px-6">
        <div className="rounded-2xl bg-white p-3 shadow-card md:p-6">
          <ul // -m-2 p-2: overflow-x-auto clips on both axes, so without room
                  // inside it the cards' shadows and rounded corners were being
                  // sliced flat against the top and bottom of the rail.
                  className="-m-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4">
            {shelf.map((p) => (
              <li
                key={p.slug}
                className="w-[calc((100%-1.5rem)/2.5)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] lg:w-[calc((100%-4rem)/4.5)]"
              >
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
          <Link
            href={active.href}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600"
          >
            อ่านบทความนี้
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    )}
    </>
  );
}
