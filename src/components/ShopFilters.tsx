"use client";

import { useRouter, usePathname } from "next/navigation";
import { categories, concerns } from "@/data/categories";
import type { BrandOption } from "@/lib/brand-options";
import { multi, PROMO_FILTERS, RATING_STEPS, type FilterCounts, ShopSearchParams } from "@/lib/shop-params";
import { SlidersHorizontal, Check, X, ChevronDown, Search, Star } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import Dropdown from "@/components/shop/Dropdown";

// Fewer than this and there's nothing to collapse — the toggle would just
// be a "show more" button that reveals one extra row.
const VISIBLE_BRANDS = 10;

/** The number beside an option: what ticking it would leave you with, given
 *  everything already ticked. Zero is shown rather than hidden — it says the
 *  option exists and something else you chose rules it out, which is not the
 *  same message as the option being missing. */
function OptionCount({ n }: { n: number }) {
  return <span className={clsx("text-xs tabular-nums", n === 0 ? "text-slate-300" : "text-slate-400")}>({n})</span>;
}

/**
 * One filter, as a pill that opens a panel.
 *
 * The column these came from is gone: five stacked groups took a 224px
 * gutter off every screen for controls most shoppers touch once, and the
 * grid is what they came for. As a row above the grid the same five read as
 * one line of choices, and the page is as wide as the products.
 *
 * The count sits on the pill rather than inside the panel, because a closed
 * panel still has to say whether it is doing anything.
 */
/**
 * One filter, as a pill that opens a panel under it.
 *
 * The column these came from is gone: five stacked groups took a 224px
 * gutter off every screen for controls most shoppers touch once, and the
 * grid is what they came for. On the toolbar the same five read as one line
 * of choices, and the page is as wide as the products.
 *
 * The shell — the pill, the panel, closing on an outside press or Escape —
 * is shared with the sort menu beside it; see components/shop/Dropdown.
 */
function FilterMenu({
  label,
  count,
  children,
  openMenu,
  setOpenMenu,
}: {
  label: string;
  count: number;
  children: ReactNode;
  /** Which menu is showing. Held by the row, not by each menu: two panels
   *  open at once overlap, and the brand panel is tall enough to sit on top
   *  of whichever one was opened next. */
  openMenu: string | null;
  setOpenMenu: (next: (prev: string | null) => string | null) => void;
}) {
  return (
    <Dropdown
      label={label}
      count={count}
      open={openMenu === label}
      onToggle={() => setOpenMenu((prev) => (prev === label ? null : label))}
      // Only clears the row's value while this menu is still the open one.
      // Pressing a neighbour closes this one after that one has opened, and
      // an unconditional clear would shut the menu that had just opened.
      onClose={() => setOpenMenu((prev) => (prev === label ? null : prev))}
    >
      {children}
    </Dropdown>
  );
}

export default function ShopFilters({
  current,
  mobileExtra,
  counts,
  houseBrands,
  otherBrands,
}: {
  current: ShopSearchParams;
  /** The shop's own brands, then the rest — from the server, because the
   *  list is built by counting the catalogue (see lib/brand-options). */
  houseBrands: BrandOption[];
  otherBrands: BrandOption[];
  mobileExtra?: ReactNode;
  counts?: FilterCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Which filter menu is showing, or none. One at a time.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  // Price boxes are typed into, so they hold their own value until applied —
  // pushing a new URL on every keystroke would reload the grid mid-number.
  const [minPrice, setMinPrice] = useState(current.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ?? "");
  // A brand filter reached directly by URL (not by clicking the toggle
  // first) should never be hidden behind a collapsed "show more" — force
  // the full list open whenever the active selection lives past the fold.
  const selectedBrandIndex = Math.max(
    -1,
    ...multi(current.brand).map((slug) => otherBrands.findIndex((b) => b.slug === slug))
  );
  const brandsExpanded = showAllBrands || (selectedBrandIndex >= 0 && selectedBrandIndex >= VISIBLE_BRANDS);
  const visibleOtherBrands =
    brandsExpanded || otherBrands.length <= VISIBLE_BRANDS ? otherBrands : otherBrands.slice(0, VISIBLE_BRANDS);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  // The price boxes apply themselves, a breath after the typing stops.
  //
  // Not on every keystroke: "500" is three keystrokes and would be three
  // navigations, the last two of which land on a list nobody asked for. Not
  // on blur either — a shopper who types a number and then reaches for the
  // scrollbar never blurs the field, and would sit looking at an unfiltered
  // list wondering what they did wrong.
  //
  // The guard above the timer is what keeps it quiet: when the boxes already
  // say what the URL says there is nothing to do, which is the state after
  // every navigation this effect itself causes, and after "ล้างทั้งหมด"
  // empties both. `?? ""` because a parameter that is absent and a box that
  // is empty mean the same thing here.
  useEffect(() => {
    const urlMin = current.minPrice ?? "";
    const urlMax = current.maxPrice ?? "";
    if (minPrice === urlMin && maxPrice === urlMax) return;
    const id = setTimeout(() => {
      updateParams({ minPrice: minPrice || null, maxPrice: maxPrice || null });
    }, 600);
    return () => clearTimeout(id);
    // updateParams is rebuilt on every render, so listing it here would
    // restart the timer on every render and the debounce would never land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPrice, maxPrice, current.minPrice, current.maxPrice]);

  function updateParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/shop?${params.toString()}`);
  }

  // Brand, concern and promo all hold a comma-separated list now. Brand and
  // concern used to hold one value, so picking a second silently dropped the
  // first — with 52 brands on the site, "Smooth E and Eucerin" is an ordinary
  // thing to want and there was no way to ask for it.
  const activeBrands = multi(current.brand);
  const activeConcerns = multi(current.concern);
  const activePromos = multi(current.promo);

  function toggleIn(param: "brand" | "concern" | "promo", value: string) {
    const list = multi(current[param]);
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    updateParams({ [param]: next.join(",") || null });
  }
  function togglePromo(key: string) {
    toggleIn("promo", key);
  }

  function clearSecondaryFilters() {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page" && k !== "brand" && k !== "concern") params.set(k, v);
    });
    router.push(`/shop?${params.toString()}`);
  }

  // How many filters are on. Brand, concern and promo are comma lists, so
  // three brands is three filters, not one — the number has to match what a
  // shopper can see ticked or it is worse than no number.
  const activeFilterCount =
    activeBrands.length +
    activeConcerns.length +
    activePromos.length +
    (current.category ? 1 : 0) +
    (current.rating ? 1 : 0) +
    (current.minPrice || current.maxPrice ? 1 : 0);

  function clearAllFilters() {
    setMinPrice("");
    setMaxPrice("");
    router.push(pathname);
  }

  const brandPanel = (
    // Wider than the trigger and capped to the viewport: 52 brand names in
    // two groups need the room, and a panel wider than a phone would hang
    // off the screen on the one size that cannot scroll sideways.
    <div className="max-h-[22rem] w-[21rem] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain">
      <div>
        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          แบรนด์ในเครือ
        </p>
        <label className="mb-2 flex items-center gap-2 rounded-lg border border-surface-line px-2.5 py-1.5">
          <Search size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder="ค้นหาแบรนด์…"
            className="w-full bg-transparent text-sm outline-hidden"
          />
        </label>
        <div className="flex flex-col gap-0.5">
          {houseBrands.map((b) => {
            const selected = activeBrands.includes(b.slug);
            // Nothing behind it to show. Still listed, because a brand that
            // vanishes when another filter is on is a brand the shopper
            // thinks the shop stopped carrying — but not pressable, because
            // pressing it could only ever produce an empty page. A selected
            // one stays pressable whatever the count, or there would be no
            // way back out of it.
            const empty = Boolean(counts) && !selected && (counts!.brand[b.slug] ?? 0) === 0;
            return (
              <button
                key={b.slug}
                onClick={() => toggleIn("brand", b.slug)}
                disabled={empty}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold transition-colors",
                  empty && "cursor-not-allowed opacity-40",
                  selected ? "bg-brand-gradient-soft text-brand-800" : "text-brand-ink hover:bg-surface-soft"
                )}
              >
                <span
                  className={clsx(
                    // A square, like every other brand below. It was a circle,
                    // which is the shape the whole web uses for "pick exactly
                    // one" — and these three multi-select exactly like the
                    // rest, through the same toggleIn. The shape was telling
                    // shoppers the opposite of what the control did.
                    "grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 transition-colors",
                    selected ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                  )}
                >
                  {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span translate="no" className="flex-1">{b.name}</span>
                {counts ? <OptionCount n={counts.brand[b.slug] ?? 0} /> : null}
              </button>
            );
          })}
          {/* A rule with nothing written on it made the split look like a
              rule about *how* the two groups behave. It is only about whose
              brands they are, so it says so. */}
          <p className="mt-3 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            แบรนด์อื่น
          </p>
          <div className="flex flex-col gap-0.5">
            {visibleOtherBrands
              .filter((b) => !brandQuery || b.name.toLowerCase().includes(brandQuery.toLowerCase()))
              .map((b) => {
              const selected = activeBrands.includes(b.slug);
              const empty = Boolean(counts) && !selected && (counts!.brand[b.slug] ?? 0) === 0;
              return (
                <button
                  key={b.slug}
                  onClick={() => toggleIn("brand", b.slug)}
                  disabled={empty}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm shrink-0 transition-colors",
                    empty && "cursor-not-allowed opacity-40",
                    selected ? "bg-brand-gradient-soft font-semibold text-brand-800" : "text-slate-600 hover:bg-surface-soft"
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 transition-colors",
                      selected ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                    )}
                  >
                    {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span translate="no" className="flex-1">{b.name}</span>
                  {counts ? <OptionCount n={counts.brand[b.slug] ?? 0} /> : null}
                </button>
              );
            })}
          </div>
          {otherBrands.length > VISIBLE_BRANDS && (
            <button
              onClick={() => setShowAllBrands((v) => !v)}
              className="mt-1 flex items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold text-brand-800 hover:text-brand-800 transition-colors"
            >
              <ChevronDown size={13} className={clsx("transition-transform", brandsExpanded && "rotate-180")} />
              {brandsExpanded ? "แสดงน้อยลง" : `แสดงเพิ่มเติม (${otherBrands.length - VISIBLE_BRANDS})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /** Takes its width from the caller: w-72 in the dropdown, the full
   *  column in the phone sheet. */
  const pricePanel = (width: string) => (
    <div className={width}>
      <div>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-1 rounded-lg border border-surface-line px-2.5 py-1.5 text-sm">
            <span className="text-slate-400">฿</span>
            <input
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              aria-label="ราคาต่ำสุด"
              className="w-full bg-transparent outline-hidden"
            />
          </label>
          <span className="text-slate-400">-</span>
          <label className="flex flex-1 items-center gap-1 rounded-lg border border-surface-line px-2.5 py-1.5 text-sm">
            <span className="text-slate-400">฿</span>
            <input
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="5,000"
              aria-label="ราคาสูงสุด"
              className="w-full bg-transparent outline-hidden"
            />
          </label>
        </div>
        {/* No apply button. Every other control on this column takes effect
            the moment it is touched, and a pair of boxes that needed a second
            press to count was the one that behaved differently — a shopper
            who typed a number and saw nothing happen had no way to tell
            whether the filter was on. It applies itself; see the effect that
            watches these two values. */}
      </div>

    </div>
  );

  /** Takes its width from the caller: w-64 in the dropdown, the full
   *  column in the phone sheet. */
  const promoPanel = (width: string) => (
    <div className={width}>
      <div>
        <div className="flex flex-col gap-0.5">
          {PROMO_FILTERS.map((f) => {
            const on = activePromos.includes(f.key);
            // Same rule as the brands above: an option that can only produce
            // an empty page is shown, so the shopper can see the shop has
            // the idea of it, but not pressed.
            const empty = Boolean(counts) && !on && (counts!.promo[f.key] ?? 0) === 0;
            return (
              <button
                key={f.key}
                onClick={() => togglePromo(f.key)}
                disabled={empty}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  empty && "cursor-not-allowed opacity-40",
                  on ? "bg-brand-gradient-soft font-semibold text-brand-800" : "text-slate-600 hover:bg-surface-soft"
                )}
              >
                <span
                  className={clsx(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 transition-colors",
                    on ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                  )}
                >
                  {on && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1">{f.label}</span>
                {counts ? <OptionCount n={counts.promo[f.key] ?? 0} /> : null}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );

  /** Takes its width from the caller: w-56 in the dropdown, the full
   *  column in the phone sheet. */
  const ratingPanel = (width: string) => (
    <div className={width}>
      <div>
        <div className="flex flex-col gap-0.5">
          {RATING_STEPS.map((min) => {
            const on = current.rating === String(min);
            return (
              <button
                key={min}
                onClick={() => updateParams({ rating: on ? null : String(min) })}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  on ? "bg-brand-gradient-soft font-semibold text-brand-800" : "text-slate-600 hover:bg-surface-soft"
                )}
              >
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i <= Math.round(min) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
                    />
                  ))}
                </span>
                <span className="flex-1">{min} ขึ้นไป</span>
                {counts ? <OptionCount n={counts.rating[String(min)] ?? 0} /> : null}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );

  // Categories, as a menu rather than the row of circles that used to sit in
  // the banner. The circles were seven targets across the top of every shop
  // page, which is a lot of furniture for a choice most shoppers make once —
  // and the other five ways of narrowing the list were already a row of
  // pills ten pixels below them, saying the same kind of thing in a
  // different shape.
  //
  // Single-select, unlike its neighbours: a product is in one category, so
  // picking a second replaces the first rather than adding to it. "ทั้งหมด"
  // is the way back out, which a pill with no options cannot be.
  const categoryPanel = (
    <div className="w-56">
      <div className="flex flex-col gap-0.5">
        {[{ slug: null as string | null, nameTh: "ทั้งหมด" }, ...categories].map((c) => {
          const on = (current.category ?? null) === c.slug;
          return (
            <button
              key={c.slug ?? "all"}
              onClick={() => updateParam("category", c.slug)}
              className={clsx(
                "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                on ? "bg-brand-gradient-soft font-semibold text-brand-800" : "text-slate-600 hover:bg-surface-soft",
              )}
            >
              <span>{c.nameTh}</span>
              {on && <Check size={14} className="shrink-0 text-brand-emerald" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const concernPanel = (
    <div className="w-64">
      <div>
        <div className="flex flex-col gap-0.5">
          {concerns.map((c) => {
            const on = activeConcerns.includes(c.slug);
            const empty = Boolean(counts) && !on && (counts!.concern[c.slug] ?? 0) === 0;
            return (
              <button
                key={c.slug}
                onClick={() => toggleIn("concern", c.slug)}
                disabled={empty}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  empty && "cursor-not-allowed opacity-40",
                  on ? "bg-brand-gradient-soft font-semibold text-brand-800" : "text-slate-600 hover:bg-surface-soft"
                )}
              >
                <span
                  className={clsx(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 transition-colors",
                    on ? "border-brand-emerald bg-brand-emerald" : "border-slate-300"
                  )}
                >
                  {on && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1">{c.nameTh}</span>
                {counts ? <OptionCount n={counts.concern[c.slug] ?? 0} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Mobile filter sheet: category now lives in its own always-visible chip
  // row on the page (rendered directly below, before the sheet trigger), so
  // this sheet only holds the secondary filters — brand and concern.
  // Values, not dimensions: three brands and a concern reads as "4", which is
  // what a shopper would say if asked how many filters they had on.
  const activeSecondaryCount = activeBrands.length + activeConcerns.length;

  // What the badge on the "ตัวกรอง" button counts. Wider than the sheet's own
  // tally, because the button speaks for every filter in force — a price
  // range set on desktop and carried to a phone by the URL was invisible
  // here, and an unexplained short list is how a shopper decides the shop is
  // out of stock.

  const mobileContent = (
    <div className="flex flex-col gap-7">
      {/* First, and on the phone it has to be here at all: the circles that
          used to carry the categories are gone, and this sheet is the only
          thing a phone has. A category nobody can reach is a seventh of the
          shop nobody can reach. */}
      <div data-sec="category">
        <h4 className="mb-3 text-xs font-bold text-slate-500">หมวดหมู่</h4>
        <div className="flex flex-col rounded-xl border border-slate-200">
          {[{ slug: null as string | null, nameTh: "ทั้งหมด" }, ...categories].map((c) => {
            const on = (current.category ?? null) === c.slug;
            return (
              <button
                key={c.slug ?? "all"}
                onClick={() => updateParam("category", c.slug)}
                className={`flex items-center justify-between border-b border-slate-50 px-3.5 py-3 text-left text-sm last:border-0 ${
                  on ? "bg-brand-gradient-soft font-bold text-brand-800" : "text-brand-ink"
                }`}
              >
                <span className="flex-1">{c.nameTh}</span>
                {on && <Check size={16} className="shrink-0 text-brand-emerald" />}
              </button>
            );
          })}
        </div>
      </div>
      <div data-sec="brand">
        <h4 className="text-xs font-bold text-slate-500 mb-3">แบรนด์ในเครือ · Life So Smooth</h4>
        <div className="flex flex-col rounded-xl border border-brand-emerald/30 mb-4">
          {houseBrands.map((b) => {
            const selected = activeBrands.includes(b.slug);
            return (
              <button
                key={b.slug}
                onClick={() => toggleIn("brand", b.slug)}
                className={`flex items-center justify-between px-3.5 py-3 text-sm text-left font-bold border-b border-slate-50 last:border-0 ${
                  selected ? "text-brand-800 bg-brand-gradient-soft" : "text-brand-ink"
                }`}
              >
                <span translate="no" className="flex-1">{b.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {counts ? <OptionCount n={counts.brand[b.slug] ?? 0} /> : null}
                  {selected && <Check size={16} className="text-brand-emerald" />}
                </span>
              </button>
            );
          })}
        </div>
        <h4 className="text-xs font-bold text-slate-500 mb-3">แบรนด์อื่นๆ</h4>
        <div className="flex flex-col rounded-xl border border-slate-100">
          {otherBrands.map((b) => {
            const selected = activeBrands.includes(b.slug);
            return (
              <button
                key={b.slug}
                onClick={() => toggleIn("brand", b.slug)}
                className={`flex items-center justify-between px-3.5 py-3 text-sm text-left border-b border-slate-50 last:border-0 ${
                  selected ? "font-semibold text-brand-800 bg-brand-gradient-soft" : "text-slate-600"
                }`}
              >
                <span translate="no" className="flex-1">{b.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {counts ? <OptionCount n={counts.brand[b.slug] ?? 0} /> : null}
                  {selected && <Check size={16} className="text-brand-emerald" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div data-sec="concern">
        <h4 className="text-xs font-bold text-slate-500 mb-3">ปัญหาผิวที่กังวล</h4>
        <div className="flex flex-wrap gap-2">
          {concerns.map((c) => {
            const on = activeConcerns.includes(c.slug);
            return (
              <button
                key={c.slug}
                onClick={() => toggleIn("concern", c.slug)}
                className={`flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                  on ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-600"
                }`}
              >
                {c.nameTh}
                {counts ? (
                  <span className={clsx("text-xs tabular-nums", on ? "text-white/75" : "text-slate-400")}>
                    ({counts.concern[c.slug] ?? 0})
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {/* These three had nowhere to live on a phone. They were built as
          dropdown panels and the dropdowns are desktop-only, so price,
          promotion and rating were filters the shop offered and half its
          visitors could not reach. */}
      <div data-sec="price">
        <h4 className="text-xs font-bold text-slate-500 mb-3">ช่วงราคา</h4>
        {pricePanel("w-full")}
      </div>
      <div data-sec="promo">
        <h4 className="text-xs font-bold text-slate-500 mb-3">โปรโมชัน</h4>
        {promoPanel("w-full")}
      </div>
      <div data-sec="rating">
        <h4 className="text-xs font-bold text-slate-500 mb-3">คะแนนสินค้า</h4>
        {ratingPanel("w-full")}
      </div>
      {activeSecondaryCount > 0 && (
        <button
          onClick={clearSecondaryFilters}
          className="rounded-full border border-rose-200 text-rose-700 font-semibold text-sm py-2.5"
        >
          ล้างตัวกรองแบรนด์และปัญหาผิว
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* One row of menus, at every width.
          
          The phone used to get a scrolling row of chips that opened a
          bottom sheet instead, on the reasoning that five menus on a 375px
          screen is a sidebar again, only sideways. The objection to that
          was simpler than the reasoning: the phone was the only place where
          tapping "แบรนด์" did not open แบรนด์. It wraps here rather than
          scrolls, so every facet is on screen at once instead of hiding
          past the right edge, and Dropdown already caps its panel at the
          window width. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu
          label="หมวดหมู่"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={current.category ? 1 : 0}>
          {categoryPanel}
        </FilterMenu>
        <FilterMenu
          label="แบรนด์"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={activeBrands.length}>
          {brandPanel}
        </FilterMenu>
        <FilterMenu
          label="ช่วงราคา"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={current.minPrice || current.maxPrice ? 1 : 0}>
          {pricePanel("w-72")}
        </FilterMenu>
        <FilterMenu
          label="โปรโมชัน"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={activePromos.length}>
          {promoPanel("w-64")}
        </FilterMenu>
        <FilterMenu
          label="คะแนนสินค้า"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={current.rating ? 1 : 0}>
          {ratingPanel("w-56")}
        </FilterMenu>
        <FilterMenu
          label="ปัญหาผิวที่กังวล"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          count={activeConcerns.length}>
          {concernPanel}
        </FilterMenu>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="ms-1 shrink-0 text-xs font-bold text-brand-800 underline underline-offset-2 hover:text-brand-1000"
          >
            ล้างทั้งหมด ({activeFilterCount})
          </button>
        )}
        {/* Ordering is not a filter, and on a desktop the page puts the sort
            menu at the far end of the toolbar itself. On a phone there is no
            far end, so it comes in here, last. */}
        {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
      </div>
    </>
  );
}
