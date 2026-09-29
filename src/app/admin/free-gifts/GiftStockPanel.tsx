"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Boxes, Loader2, RefreshCw } from "lucide-react";
import { Panel } from "@/components/admin/layout-kit";

// What is left of the gifts the shop gives away.
//
// The giving is done by an app on Shopify's side — order lines carry its
// _aovCampId — and neither it nor this console was watching the shelf behind
// the promise. On the day this was written four gifts were down to one or none
// while campaigns were still handing them out, and the only way to know was to
// read the orders one at a time.
//
// Read-only on purpose. Stock is Shopify's to hold; this is the window onto it.

type Gift = {
  variantId: string;
  title: string;
  status: string;
  image: string | null;
  price: number;
  stock: number;
};

type Data = { lowStock: number; totals: { all: number; out: number; low: number }; gifts: Gift[] };

/** "[Free Gift] Smooth E …" is a naming habit; the prefix is noise in a list of gifts. */
const name = (t: string) => t.replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim() || t;

function StockChip({ n, low }: { n: number; low: number }) {
  const tone =
    n <= 0
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : n < low
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-surface-soft text-slate-600 ring-surface-line";
  return (
    <span className={`inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ${tone}`}>
      {n <= 0 ? "หมด" : n.toLocaleString("th-TH")}
    </span>
  );
}

export default function GiftStockPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/free-gifts/stock", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดสต็อกของแถมไม่สำเร็จ");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสต็อกของแถมไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Emptiest first from the server, so the ones worth acting on are the ones
  // shown before anybody presses anything.
  const gifts = data?.gifts ?? [];
  const needsAttention = gifts.filter((g) => g.stock < (data?.lowStock ?? 10));
  const shown = showAll ? gifts : needsAttention;

  return (
    <Panel
      padded
      icon={<Boxes size={16} className="text-brand-emerald" />}
      title="สต็อกของแถม"
      toolbar={
        <button
          type="button"
          onClick={load}
          aria-label="โหลดใหม่"
          disabled={loading}
          className="grid size-8 place-items-center rounded-full text-slate-400 ring-1 ring-surface-line hover:bg-surface-mist hover:text-brand-ink disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      }
    >
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        ของแถมทั้งหมดที่ติดแท็ก <code className="rounded bg-surface-soft px-1">free-gift</code> ใน Shopify พร้อมจำนวนคงเหลือจริง —
        ของแถมแจกโดยแอปฝั่ง Shopify ระบบนี้อ่านอย่างเดียว ไม่ได้แก้สต็อก
      </p>

      {error && <p className="rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      {data && (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                ["ของแถมทั้งหมด", data.totals.all, "text-brand-ink"],
                ["ใกล้หมด", data.totals.low, data.totals.low > 0 ? "text-amber-700" : "text-brand-ink"],
                ["หมดแล้ว", data.totals.out, data.totals.out > 0 ? "text-rose-600" : "text-brand-ink"],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-xl2 bg-surface-soft px-3 py-2">
                <dt className="text-[11px] text-slate-500">{label}</dt>
                <dd className={`mt-0.5 text-xl font-extrabold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {data.totals.out > 0 && (
            <p className="mb-3 flex items-start gap-1.5 rounded-l border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-relaxed text-rose-900">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              มีของแถม {data.totals.out} รายการที่หมดแล้ว — ถ้าแคมเปญในแอปยังแจกอยู่ ลูกค้าจะได้ของไม่ครบ
              ต้องไปปิดหรือเปลี่ยนของแถมในแอปเอง
            </p>
          )}

          {shown.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">ของแถมทุกรายการยังมีพอ</p>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-line">
              {shown.map((g) => (
                <li key={g.variantId} className="flex items-center gap-3 py-2.5">
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-l bg-surface-soft">
                    {g.image ? (
                      <Image src={g.image} alt="" fill sizes="36px" className="object-contain" />
                    ) : (
                      <Boxes size={15} className="absolute inset-0 m-auto text-slate-300" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-brand-ink">{name(g.title)}</span>
                    <span className="block text-[11px] text-slate-400">
                      มูลค่า ฿{g.price.toLocaleString("th-TH")}
                      {g.status !== "UNLISTED" && ` · ${g.status}`}
                    </span>
                  </span>
                  <StockChip n={g.stock} low={data.lowStock} />
                </li>
              ))}
            </ul>
          )}

          {gifts.length > needsAttention.length && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-semibold text-brand-800 hover:underline"
            >
              {showAll ? "ดูเฉพาะที่ใกล้หมด" : `ดูทั้งหมด ${gifts.length} รายการ`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
