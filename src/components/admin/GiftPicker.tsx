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
};

/** "[Free Gift] Smooth E …" is a naming habit; the prefix is noise in a picker of gifts. */
export const giftName = (t: string) =>
  t.replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim() || t;

export default function GiftPicker({
  onSelect,
}: {
  onSelect: (gift: GiftChoice) => void;
}) {
  const [gifts, setGifts] = useState<GiftChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/free-gifts/stock", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok)
          throw new Error(json?.error || "โหลดรายการของแถมไม่สำเร็จ");
        setGifts(json.gifts);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "โหลดรายการของแถมไม่สำเร็จ",
        ),
      );
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = gifts ?? [];
    // In stock first: an empty gift is still listed, because a campaign can be
    // written for a restock, but it should never be the easy thing to click.
    const sorted = [...all].sort(
      (a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0),
    );
    return term
      ? sorted.filter((g) => g.title.toLowerCase().includes(term))
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
          placeholder={`ค้นหาของแถม (${gifts.length} รายการ)`}
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
                <span className="min-w-0 flex-1 truncate text-xs text-brand-ink">
                  {giftName(g.title)}
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
