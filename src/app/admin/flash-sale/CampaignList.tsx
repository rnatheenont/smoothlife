"use client";

// The campaigns an admin has actually created.
//
// This is why a saved campaign looked lost: the page it lands on after
// saving only ever showed the walk-through demo and a link to the create
// form, so there was nowhere to see what existed, nowhere to open its sale
// page, and no way to tell a scheduled campaign from a live one. The API
// has returned all of this since the create route was written — nothing
// called it.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Panel, SectionTitle, adminTable } from "@/components/admin/layout-kit";

type Campaign = {
  id: string;
  title: string;
  kind: "regular" | "special";
  productSlugs: string[];
  stockPerProduct: number;
  startsAt: number;
  endsAt: number | null;
  endedManuallyAt: number | null;
};

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

/** What the admin needs to know at a glance, in the shop's own words. */
function phaseOf(c: Campaign, now: number) {
  if (c.endedManuallyAt) return { label: "ปิดด้วยมือ", tone: "bg-slate-100 text-slate-600" };
  if (c.endsAt && now >= c.endsAt) return { label: "จบแล้ว", tone: "bg-slate-100 text-slate-600" };
  if (now < c.startsAt) return { label: "รอเปิด", tone: "bg-amber-100 text-amber-800" };
  return { label: "กำลังขาย", tone: "bg-emerald-100 text-emerald-800" };
}

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flash-sale/campaigns", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดรายการแคมเปญไม่สำเร็จ");
      setCampaigns(data.campaigns as Campaign[]);
      // The server's clock decides which campaign is live, not the admin's.
      setNow(typeof data.serverNow === "number" ? data.serverNow : Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการแคมเปญไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  const sorted = campaigns ? [...campaigns].sort((a, b) => b.startsAt - a.startsAt) : null;

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>แคมเปญที่สร้างไว้</SectionTitle>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden /> รีเฟรช
        </button>
      </div>

      {error && <p className="rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      {!error && sorted === null && <p className="text-[13px] text-slate-400">กำลังโหลด…</p>}

      {!error && sorted?.length === 0 && (
        <p className="text-[13px] text-slate-500">ยังไม่มีแคมเปญ — กด “สร้างแคมเปญจริง” ด้านบนเพื่อเริ่ม</p>
      )}

      {!error && sorted && sorted.length > 0 && (
        <div className={adminTable.scroll}>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th>แคมเปญ</th>
                <th>สถานะ</th>
                <th>เริ่ม</th>
                <th>ปิด</th>
                <th>สต็อก/ชิ้น</th>
                <th>หน้าขาย</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const phase = phaseOf(c, now);
                return (
                  <tr key={c.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{c.title}</span>
                      <span className="mt-0.5 block text-[12px] text-slate-400">
                        {c.kind === "special" ? "หน้าแบบมีแบนเนอร์" : "หน้าขายแบบเรียบ"} · {c.productSlugs.length} สินค้า
                      </span>
                    </td>
                    <td className={adminTable.cell}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${phase.tone}`}>
                        {phase.label}
                      </span>
                    </td>
                    <td className={adminTable.muted}>{dateTime(c.startsAt)}</td>
                    <td className={adminTable.muted}>{c.endsAt ? dateTime(c.endsAt) : "จนกว่าของจะหมด"}</td>
                    <td className={adminTable.mono}>{c.stockPerProduct}</td>
                    <td className={adminTable.cell}>
                      <Link
                        href={`/flash-sale/${c.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800 hover:underline"
                      >
                        เปิดดู <ArrowUpRight size={13} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
