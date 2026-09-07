"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Truck, RefreshCw, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { TrackingSyncRow } from "@/app/api/admin/tracking-sync/route";

// The dry-run report. The number that matters is "conflict": every one is
// either a tracking number keyed onto the wrong order by hand, or a mapping
// bug in the sync. Until that column reads zero for a stretch of normal days,
// nothing should be allowed to write to Shopify.

const ACTION: Record<string, { label: string; tone: "success" | "neutral" | "danger" | "warning" | "info" }> = {
  fill: { label: "พร้อมเติม", tone: "info" },
  "already-set": { label: "ตรงกันอยู่แล้ว", tone: "success" },
  conflict: { label: "ไม่ตรงกัน", tone: "danger" },
  "no-order": { label: "ไม่พบออเดอร์", tone: "warning" },
  "not-eligible": { label: "ไม่เข้าเงื่อนไข", tone: "neutral" },
};

type Payload = {
  mode: string;
  configured: boolean;
  app: string | null;
  canWrite: boolean;
  counts: Record<string, number>;
  rows: TrackingSyncRow[];
};

export default function AdminTrackingSyncPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tracking-sync");
      const json = await res.json();
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const conflicts = data?.counts.conflict ?? 0;
  const dryRun = data?.mode === "dry-run";

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <Truck size={20} className="text-brand-600" /> ซิงก์เลขพัสดุ
        </h1>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </Button>
      </div>

      <div
        className={clsx(
          "mb-4 flex items-start gap-2 rounded-xl2 border p-4 text-sm",
          dryRun ? "border-sky-200 bg-sky-50/60" : "border-amber-200 bg-amber-50/60"
        )}
      >
        {dryRun ? (
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-600" />
        ) : (
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-brand-ink">
            โหมดปัจจุบัน: {dryRun ? "ทดลอง (dry run)" : data?.mode}
          </p>
          <p className="mt-0.5 text-body-xs text-slate-600">
            {dryRun
              ? "รับข้อมูลเข้ามา ตัดสินใจ และบันทึกไว้เท่านั้น — ยังไม่เขียนอะไรลง Shopify และไม่มีอีเมลถึงลูกค้า"
              : "โหมดนี้เขียนลง Shopify จริง"}
          </p>
          {data && !data.configured && (
            <p className="mt-1 text-body-xs text-rose-600">
              ยังไม่ได้ตั้ง TRACKING_WEBHOOK_SECRET — endpoint จะปฏิเสธทุกคำขอจนกว่าจะตั้งค่า
            </p>
          )}
          {data && (
            <p className="mt-1 text-body-xs text-slate-500">
              เว็บใช้แอป Shopify: <b>{data.app ?? "ไม่ทราบ"}</b> · สิทธิ์เขียน fulfillment:{" "}
              {data.canWrite ? (
                <b className="text-brand-800">มี ✅</b>
              ) : (
                <b className="text-rose-600">ยังไม่มี ❌ (เปิดโหมดเขียนไม่ได้จนกว่าจะเพิ่ม write_fulfillments)</b>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(ACTION).map(([key, meta]) => (
          <Card key={key} padded={false} className="p-3 text-center">
            <p className="text-h4 font-bold text-brand-ink">{data?.counts[key] ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{meta.label}</p>
          </Card>
        ))}
      </div>

      {conflicts > 0 && (
        <p className="mb-4 flex items-start gap-1.5 rounded-m bg-rose-50 p-3 text-[12px] leading-relaxed text-rose-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          มี {conflicts} รายการที่เลขไม่ตรงกัน — แต่ละรายการคือเลขที่คีย์มือผิด หรือการจับคู่ผิดพลาด
          ต้องตรวจให้หมดก่อนเปิดโหมดเขียนจริง
        </p>
      )}

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : !data?.rows.length ? (
        <p className="flex items-start gap-1.5 rounded-xl2 border border-slate-100 p-4 text-body-xs text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
          ยังไม่มีข้อมูลเข้ามา — ให้ระบบต้นทางยิง POST มาที่ <code className="rounded bg-surface-soft px-1">/api/webhooks/tracking</code>{" "}
          พร้อม header <code className="rounded bg-surface-soft px-1">x-tracking-secret</code>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-slate-100">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead className="bg-surface-soft text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">เวลา</th>
                <th className="px-3 py-2 font-semibold">ออเดอร์</th>
                <th className="px-3 py-2 font-semibold">เลขที่ส่งมา</th>
                <th className="px-3 py-2 font-semibold">ผล</th>
                <th className="px-3 py-2 font-semibold">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const meta = ACTION[r.action] ?? { label: r.action, tone: "neutral" as const };
                return (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {new Date(r.received_at).toLocaleString("th-TH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-brand-ink">{r.resolved_order_name || r.order_ref}</span>
                      {!r.resolved_order_name && (
                        <span className="ml-1 text-[10px] text-slate-400">(ไม่พบ)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.tracking_number}</td>
                    <td className="px-3 py-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.reason}
                      {r.existing_numbers?.length ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-rose-600">
                          ใน Shopify: {r.existing_numbers.join(", ")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
