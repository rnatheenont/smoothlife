"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { Input, Spinner } from "@heroui/react";
import AdminSearch from "@/components/admin/AdminSearch";
import { Search } from "lucide-react";

// Choosing the gift from the shop's own free-gift shelf.
//
// The other picker on this page lists the catalogue, and the gifts are not in
// it: every one of them is UNLISTED in Shopify on purpose, so a promo could
// name any product in the shop except the twenty-five actually kept for
// giving away. This lists those, with what is left of each, because picking a
// gift that ran out last week is the mistake worth making impossible.

export type GiftChoice = {
  variantId: string;
  title: string;
  image: string | null;
  stock: number;
  /** The warehouse's name for it. Whoever is setting a campaign up is often
   *  holding a stock sheet, where the product has a code and not a name. */
  sku?: string | null;
};

/** "[Free Gift] Smooth E …" is a naming habit; the prefix is noise in a picker of gifts. */
export const giftName = (t: string) =>
  t.replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim() || t;

// The shelf itself, fetched once per page rather than once per picker.
//
// A tiered promo draws one picker per level, and each of them used to fetch
// the whole shelf on mount — three levels, three identical requests. It is
// also the only place the admin side knows what a gift is called, so the form
// reads it to put a name on the gifts a promo already has: the admin API
// returns variant ids and nothing else.
let shelfPromise: Promise<GiftChoice[]> | null = null;

function loadShelf(): Promise<GiftChoice[]> {
  shelfPromise ??= fetch("/api/admin/free-gifts/stock", { cache: "no-store" })
    .then((r) => r.json())
    .then((json) => {
      if (!json?.ok) throw new Error(json?.error || "โหลดรายการของแถมไม่สำเร็จ");
      return json.gifts as GiftChoice[];
    })
    .catch((err) => {
      // A failed load must not be remembered as the answer, or every later
      // picker on the page inherits the failure.
      shelfPromise = null;
      throw err;
    });
  return shelfPromise;
}

export function useGiftShelf() {
  const [gifts, setGifts] = useState<GiftChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadShelf()
      .then((g) => alive && setGifts(g))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "โหลดรายการของแถมไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, []);

  return { gifts, error };
}

export default function GiftPicker({
  onSelect,
}: {
  onSelect: (gift: GiftChoice) => void;
}) {
  const { gifts, error } = useGiftShelf();
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = gifts ?? [];
    // In stock first: an empty gift is still listed, because a campaign can be
    // written for a restock, but it should never be the easy thing to click.
    const sorted = [...all].sort(
      (a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0),
    );
    // Name or SKU. A gift's display name is written for shoppers and a stock
    // sheet never carries it, so searching by name alone meant reading the
    // list for a code that was right there on the row.
    return term
      ? sorted.filter(
          (g) =>
            g.title.toLowerCase().includes(term) ||
            (g.sku ?? "").toLowerCase().includes(term),
        )
      : sorted;
  }, [gifts, q]);

  if (error)
    return (
      <p className="rounded-l bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
        {error}
      </p>
    );
  if (!gifts) {
    return (
      <p className="flex items-center gap-2 py-3 text-xs text-slate-400">
        <Spinner size="sm" color="current" /> กำลังโหลดของแถมจาก Shopify…
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="border-b border-slate-100 p-2">
        <AdminSearch
          className="w-full"
          value={q}
          onChange={setQ}
          placeholder={`ค้นหาด้วยชื่อหรือ SKU (${gifts.length} รายการ)`}
        />
      </div>
      <ul className="max-h-64 overflow-y-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-3 text-xs text-slate-400">
            ไม่พบของแถมที่ค้นหา
          </li>
        ) : (
          shown.map((g) => (
            <li key={g.variantId}>
              <button
                type="button"
                onClick={() => onSelect(g)}
                disabled={g.stock <= 0}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-white">
                  {g.image && (
                    <Image
                      src={g.image}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-xs text-brand-ink">
                  <span className="block truncate">{giftName(g.title)}</span>
                  {/* Shown, not only searchable: the code is what gets read
                      back to the warehouse, and a picker that matches on it
                      silently leaves the operator unsure they picked right. */}
                  {g.sku && (
                    <span className="block truncate font-mono text-[11px] text-slate-400">{g.sku}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-[11px] font-bold tabular-nums ${
                    g.stock <= 0
                      ? "text-rose-600"
                      : g.stock < 10
                        ? "text-amber-700"
                        : "text-slate-400"
                  }`}
                >
                  {g.stock <= 0
                    ? "หมด"
                    : `เหลือ ${g.stock.toLocaleString("th-TH")}`}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
