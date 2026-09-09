"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Truck, RefreshCw, ShieldCheck, AlertTriangle, Info, Play, Loader2, ExternalLink } from "lucide-react";
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
  "run-empty": { label: "รันแล้ว ไม่มีของใหม่", tone: "neutral" },
  "run-failed": { label: "รันไม่สำเร็จ", tone: "danger" },
};

type Payload = {
  mode: string;
  configured: boolean;
  app: string | null;
  canWrite: boolean;
  canFulfil: boolean;
  counts: Record<string, number>;
  shopDomain: string | null;
  connection: {
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
    consecutiveFailures: number;
  };
  testRowCount: number;
  rows: TrackingSyncRow[];
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  const [showTests, setShowTests] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/tracking-sync/run", { method: "POST" });
      // A run that overruns Vercel's 60s limit comes back as an HTML error
      // page, and calling .json() on that surfaced a raw SyntaxError to staff
      // instead of saying what happened.
      const raw = await res.text();
      let r: Record<string, unknown>;
      try {
        r = JSON.parse(raw);
      } catch {
        setRunResult(
          res.status === 504 || /timed out/i.test(raw)
            ? "หมดเวลา 60 วินาที — soko ตอบช้ากว่าปกติ ลองกดใหม่อีกครั้ง"
            : `ไม่สำเร็จ (HTTP ${res.status}) — ${raw.slice(0, 120)}`
        );
        return;
      }
      if (!r.ok) {
        setRunResult(`ไม่สำเร็จ: ${r.error ?? "ไม่ทราบสาเหตุ"}`);
      } else if (!r.found) {
        const d = r.diagnostics as
          | { pagesScanned?: number; candidates?: number; skipped?: number; ranOutOfTime?: boolean }
          | undefined;
        setRunResult(
          `ไม่มีรายการใหม่ — อ่าน ${d?.pagesScanned ?? "?"} หน้า พบ ${d?.candidates ?? "?"} ออเดอร์ ` +
            `ข้ามที่ทำไปแล้ว ${d?.skipped ?? 0} รายการ` +
            (d?.ranOutOfTime ? " (อ่านไม่ครบ เพราะใกล้หมดเวลา — กดอีกครั้งเพื่ออ่านต่อ)" : "")
        );
      } else {
        setRunResult(
          `ดึงมา ${r.found} รายการ · เขียนลง Shopify ${r.applied ?? 0} · ต้องตรวจสอบ ${r.conflicts ?? 0}` +
            (Number(r.unfinished) > 0 ? ` · เหลืออีก ${r.unfinished} รายการ กดอีกครั้งเพื่อทำต่อ` : "")
        );
      }
    } catch (err) {
      setRunResult(`ไม่สำเร็จ: ${err}`);
    } finally {
      setRunning(false);
      // The table is the record; whatever the run did should be visible in it.
      load();
    }
  }

  const [resolving, setResolving] = useState<string | null>(null);

  async function resolve(row: TrackingSyncRow, resolution: "overwritten" | "ignored") {
    const order = row.resolved_order_name || row.order_ref;
    const message =
      resolution === "overwritten"
        ? `เขียนทับเลขพัสดุของ ${order}\n\nของเดิม: ${(row.existing_numbers ?? []).join(", ") || "—"}\nเลขใหม่: ${row.tracking_number}\n\nลูกค้าจะได้รับอีเมลแจ้งเลขใหม่ ยืนยันหรือไม่?`
        : `เก็บเลขเดิมของ ${order} ไว้ และเพิกเฉยเลข ${row.tracking_number} ที่ soko ส่งมา ยืนยันหรือไม่?`;
    if (!window.confirm(message)) return;

    setResolving(row.id);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/tracking-sync/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, resolution }),
      });
      const r = await res.json();
      setRunResult(
        r.ok
          ? resolution === "overwritten"
            ? `เขียนทับ ${order} เป็น ${row.tracking_number} แล้ว${r.notified ? " · แจ้งลูกค้าทางอีเมลแล้ว" : ""}`
            : `เก็บเลขเดิมของ ${order} ไว้แล้ว`
          : `ไม่สำเร็จ: ${r.error ?? "ไม่ทราบสาเหตุ"}`
      );
    } catch (err) {
      setRunResult(`ไม่สำเร็จ: ${err}`);
    } finally {
      setResolving(null);
      load();
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <Truck size={20} className="text-brand-600" /> ซิงก์เลขพัสดุ
        </h1>
        <div className="flex items-center gap-2">
          {/* CRON_SECRET is stored on Vercel as a sensitive value, so nobody
              can read it back — triggering a run by hand meant rotating it and
              redeploying. Staff are already signed in here; that is the key. */}
          <Button variant="secondary" size="sm" onClick={runNow} disabled={running || loading}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? "กำลังดึง..." : "ดึงจาก soko เดี๋ยวนี้"}
          </Button>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </Button>
        </div>
      </div>

      {runResult && (
        <p className="mb-3 rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-2.5 text-body-xs text-slate-700">
          {runResult}
        </p>
      )}

      {/* Kept apart from the mode card below on purpose. "Can the scraper get
          into soko" and "what is it allowed to write" are different questions,
          and when one sentence answered both, a login that had been failing
          for an hour read as a note about write mode. */}
      {data && (
        <div
          className={clsx(
            "mb-3 flex items-start gap-2 rounded-xl2 border p-4 text-sm",
            data.connection.consecutiveFailures >= 2
              ? "border-rose-200 bg-rose-50/70"
              : "border-emerald-200 bg-emerald-50/50"
          )}
        >
          {data.connection.consecutiveFailures >= 2 ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          ) : (
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-brand-ink">
              {data.connection.consecutiveFailures >= 2
                ? `เชื่อมต่อ soko ไม่ได้ — ล้มเหลวติดกัน ${data.connection.consecutiveFailures} รอบ`
                : "เชื่อมต่อ soko ได้ปกติ"}
            </p>
            <p className="mt-0.5 text-body-xs text-slate-600">
              ดึงข้อมูลสำเร็จล่าสุด: {data.connection.lastSuccessAt ? fmt(data.connection.lastSuccessAt) : "ยังไม่เคย"}
              {data.connection.lastFailureAt && ` · ล้มเหลวล่าสุด: ${fmt(data.connection.lastFailureAt)}`}
            </p>
            {data.connection.consecutiveFailures >= 2 && data.connection.lastFailureReason && (
              <p className="mt-1 text-body-xs text-rose-700">{data.connection.lastFailureReason}</p>
            )}
          </div>
        </div>
      )}

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
              เว็บใช้แอป Shopify: <b>{data.app ?? "ไม่ทราบ"}</b>
              <br />
              เขียนเลขพัสดุ (write_fulfillments):{" "}
              {data.canWrite ? <b className="text-brand-800">มี ✅</b> : <b className="text-rose-600">ยังไม่มี ❌</b>}
              <br />
              สั่ง fulfill เองได้ (merchant_managed_fulfillment_orders):{" "}
              {data.canFulfil ? <b className="text-brand-800">มี ✅</b> : <b className="text-rose-600">ยังไม่มี ❌</b>}
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
          {/* This used to say "check them all before turning on real writing"
              regardless of mode — while the mode was already write-notify and
              writing. Staff read it as "nothing has been written yet". */}
          <span>
            มี {conflicts} รายการที่เลขไม่ตรงกัน — แต่ละรายการคือเลขที่คีย์มือผิด หรือการจับคู่ผิดพลาด
            {dryRun
              ? " ต้องตรวจให้หมดก่อนเปิดโหมดเขียนจริง"
              : " ระบบข้ามเฉพาะรายการเหล่านี้ไว้ ไม่ได้เขียนทับของเดิม ส่วนออเดอร์อื่นเขียนตามปกติ — ต้องมีคนตัดสินว่าเลขไหนถูก"}
          </span>
        </p>
      )}

      {data && data.testRowCount > 0 && (
        <button
          onClick={() => setShowTests((v) => !v)}
          className={clsx(
            "mb-3 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            showTests
              ? "border-brand-200 bg-brand-50 text-brand-800"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          )}
        >
          {showTests ? "ซ่อน" : "แสดง"}รายการทดสอบ ({data.testRowCount})
        </button>
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
              {data.rows.filter((r) => showTests || !r.is_test).map((r) => {
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

                      {/* A mismatch used to end here: the page named the
                          problem and offered nothing to do about it, so
                          settling one meant opening Shopify and keying the
                          number in — the manual step this replaces. */}
                      {r.action === "conflict" && !r.resolved_at && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => resolve(r, "overwritten")}
                            disabled={resolving === r.id}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            ใช้เลขใหม่ทับ
                          </button>
                          <button
                            onClick={() => resolve(r, "ignored")}
                            disabled={resolving === r.id}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            เก็บเลขเดิมไว้
                          </button>
                        </span>
                      )}
                      {r.resolved_at && (
                        <span className="mt-1 block text-[11px] font-medium text-slate-400">
                          {r.resolution === "overwritten" ? "เขียนทับแล้ว" : "เก็บเลขเดิมไว้"} · {fmt(r.resolved_at)}
                        </span>
                      )}

                      {/* "Not found" is usually a number keyed against the
                          wrong order, so the useful next step is a search, not
                          a second message saying it is still not found. */}
                      {r.action === "no-order" && data.shopDomain && (
                        <a
                          href={`https://admin.shopify.com/store/${data.shopDomain}/orders?query=${encodeURIComponent(r.order_ref.replace(/^#/, ""))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          ค้นหาใน Shopify <ExternalLink size={10} />
                        </a>
                      )}
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
