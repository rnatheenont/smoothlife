"use client";

import { useRouter, usePathname } from "next/navigation";
import { concerns } from "@/data/categories";
import { houseBrands, otherBrands } from "@/data/brands";
import { multi, PROMO_FILTERS, RATING_STEPS, type FilterCounts, ShopSearchParams } from "@/lib/filter-products";
import { SlidersHorizontal, Check, X, ChevronDown, Search, Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

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

export default function ShopFilters({
  current,
  mobileExtra,
  counts,
  resultCount,
}: {
  current: ShopSearchParams;
  mobileExtra?: ReactNode;
  counts?: FilterCounts;
  /** How many products the filters currently leave, for the sheet's own
   *  button — so the sheet answers "and how many is that?" without closing. */
  resultCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock the page while the sheet is up. Without it the page carried on
  // scrolling behind a sheet that covers the whole screen, so closing it put
  // you somewhere you never chose to be — and overscroll-contain on the list
  // inside stops a flick past the last brand from doing the same thing.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);
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

  const content = (
    <div className="flex flex-col gap-6">
      {/* No category list here. The circle row at the top of the page is the
          category control on every screen size, and a second list in the
          sidebar meant two controls for one choice sitting 200px apart, each
          having to mirror the other's state. */}
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">แบรนด์</h4>
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
            return (
              <button
                key={b.slug}
                onClick={() => toggleIn("brand", b.slug)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold transition-colors",
                  selected ? "bg-brand-gradient-soft text-brand-800" : "text-brand-ink hover:bg-surface-soft"
                )}
              >
                <span
                  className={clsx(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors",
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
          <div className="my-1.5 border-t border-slate-100" />
          <div className="flex flex-col gap-0.5">
            {visibleOtherBrands
              .filter((b) => !brandQuery || b.name.toLowerCase().includes(brandQuery.toLowerCase()))
              .map((b) => {
              const selected = activeBrands.includes(b.slug);
              return (
                <button
                  key={b.slug}
                  onClick={() => toggleIn("brand", b.slug)}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm shrink-0 transition-colors",
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
      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">ช่วงราคา</h4>
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
        <button
          onClick={() => updateParams({ minPrice: minPrice || null, maxPrice: maxPrice || null })}
          className="mt-2 w-full rounded-lg bg-brand-gradient-soft py-1.5 text-xs font-semibold text-brand-800"
        >
          ใช้ช่วงราคานี้
        </button>
      </div>

      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">โปรโมชัน</h4>
        <div className="flex flex-col gap-0.5">
          {PROMO_FILTERS.map((f) => {
            const on = activePromos.includes(f.key);
            return (
              <button
                key={f.key}
                onClick={() => togglePromo(f.key)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
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

      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">คะแนนสินค้า</h4>
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

      <div>
        <h4 className="text-sm font-bold text-brand-ink mb-3">ปัญหาผิวที่กังวล</h4>
        <div className="flex flex-col gap-0.5">
          {concerns.map((c) => {
            const on = activeConcerns.includes(c.slug);
            return (
              <button
                key={c.slug}
                onClick={() => toggleIn("concern", c.slug)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
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
      {(current.category || current.brand || current.concern || current.promo || current.rating || current.minPrice || current.maxPrice) && (
        <button
          onClick={() => {
            setMinPrice("");
            setMaxPrice("");
            router.push(pathname);
          }}
          className="rounded-full bg-brand-800 py-2.5 text-sm font-semibold text-white"
        >
          ล้างตัวกรอง
        </button>
      )}
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
  const appliedCount =
    activeSecondaryCount +
    activePromos.length +
    (current.rating ? 1 : 0) +
    (current.minPrice || current.maxPrice ? 1 : 0);

  const mobileContent = (
    <div className="flex flex-col gap-7">
      <div>
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
      <div>
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
      <div className="lg:hidden flex items-center gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setMobileOpen(true)}
            className="relative h-10 w-full flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium active:scale-95 transition-transform"
          >
            <SlidersHorizontal size={15} /> ตัวกรอง
            {appliedCount > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white">
                {appliedCount}
              </span>
            )}
          </button>
        </div>
        <div className="min-w-0 flex-1">{mobileExtra}</div>
      </div>
      <aside className="hidden lg:block lg:sticky lg:top-[152px] lg:self-start w-56 shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-2xl bg-white shadow-xl animate-slideUp">
            <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
              <span className="h-1.5 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <h3 className="font-bold">ตัวกรองสินค้า</h3>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="ปิด"
                className="grid h-8 w-8 place-items-center rounded-full bg-surface-soft text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5">{mobileContent}</div>
            <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0">
              {/* The count belongs on the button, not only behind it. Filters
                  here apply the moment they are tapped, so this number is the
                  real answer to "how many did that leave me", and a shopper
                  who sees 3 can take a filter back off without closing the
                  sheet to find out. */}
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white shadow-card"
              >
                {typeof resultCount === "number"
                  ? `ดูสินค้า ${resultCount.toLocaleString("th-TH")} รายการ`
                  : "ดูสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
