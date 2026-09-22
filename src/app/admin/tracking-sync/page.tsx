"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Truck,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Info,
  Play,
  Loader2,
  ExternalLink,
  PlugZap,
  KeyRound,
  Boxes,
  Bot,
  UserRound,
  PackagePlus,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { TrackingSyncRow } from "@/app/api/admin/tracking-sync/route";
import { useAdminAction } from "@/components/admin/header-action";
import { adminTable } from "@/components/admin/layout-kit";

// Three questions, in the order staff ask them: is the integration alive,
// is there anything for me to decide, and what happened. The page is laid out
// in that order — health strip, then the mismatches that need a person, then
// the log — because everything except the middle one is reading material.

/**
 * The order a parcel ref belongs to, with the warehouse's box suffix removed.
 *
 * soko numbers a second box of the same order by appending to the reference —
 * "#4157" and "#4157_F", "#4212" and "#4212_" — so the two boxes of one order
 * arrived in this log as two unrelated lines. They are one shipment going out
 * in two parcels, and reading them as two orders is how someone concludes a
 * customer was sent something twice.
 */
function baseOrderRef(row: TrackingSyncRow) {
  const raw = row.resolved_order_name || row.order_ref || "";
  const base = raw.replace(/^#/, "").split("_")[0].trim().toLowerCase();
  // A run-level row carries "-" as its ref, which is not an order: left as a
  // key it collected every such row into one bogus "set of 6 boxes".
  return /[a-z0-9]/.test(base) ? base : "";
}

type GroupedRow = { row: TrackingSyncRow; box: number; boxes: number; firstOfSet: boolean };

/**
 * Reorders the log so every box of one order sits together.
 *
 * Grouping adjacent rows was the first attempt and grouped nothing: the
 * warehouse does not pack an order's boxes in one go, so "#4157" arrived days
 * before "#4157_F" with a dozen other orders between them. The set has to be
 * assembled across the whole window.
 *
 * Newest-first still holds, at the level that now matters: a set takes the
 * position of its most recent box, and its earlier boxes follow directly
 * underneath. Rows with no order at all — a run that found nothing, a run
 * that failed — are their own group and keep their place in the timeline.
 */
function groupParcels(rows: TrackingSyncRow[]): GroupedRow[] {
  const buckets = new Map<string, TrackingSyncRow[]>();
  for (const row of rows) {
    const key = baseOrderRef(row) || `__row:${row.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const newest = (list: TrackingSyncRow[]) => Math.max(...list.map((r) => new Date(r.received_at).getTime()));

  return [...buckets.values()]
    .map((list) => [...list].sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at)))
    .sort((a, b) => newest(b) - newest(a))
    .flatMap((list) => list.map((row, i) => ({ row, box: i + 1, boxes: list.length, firstOfSet: i === 0 })));
}

const ACTION: Record<string, { label: string; tone: "success" | "neutral" | "danger" | "warning" | "info" }> = {
  fill: { label: "พร้อมเติม", tone: "info" },
  "already-set": { label: "ตรงกันอยู่แล้ว", tone: "success" },
  conflict: { label: "ไม่ตรงกัน", tone: "danger" },
  "no-order": { label: "ไม่พบออเดอร์", tone: "warning" },
  "not-eligible": { label: "ไม่เข้าเงื่อนไข", tone: "neutral" },
  "run-empty": { label: "รันแล้ว ไม่มีของใหม่", tone: "neutral" },
  "run-failed": { label: "รันไม่สำเร็จ", tone: "danger" },
};

/**
 * "The robot ran" rather than "a parcel happened".
 *
 * These carry no order and no tracking number, and they outnumbered the
 * parcels — 39 of 164 rows — so the log read as a list of cron ticks with
 * shipments scattered through it. What they are evidence of (a scraper that
 * has gone quiet, or one that keeps timing out) is what the connection tile
 * at the top of the page reports, so they stay out of the log until asked
 * for by their own chip.
 */
const RUN_ROW = new Set(["run-empty", "run-failed"]);

/**
 * A parcel sent after the order already shipped.
 *
 * soko files it as "#4161_F", and the sync leaves it alone on purpose: the
 * order is fulfilled and closed in Shopify, so there is nothing left to
 * fulfil and the only honest write is adding the number to the parcel list
 * the order already carries. That was being done by hand — #2055 has five
 * numbers on it, one a month — which is the work this queue replaces.
 */
const FOLLOW_UP = /_F|ของส่งตาม/;
const isFollowUp = (r: TrackingSyncRow) =>
  r.action === "not-eligible" && FOLLOW_UP.test(`${r.order_ref} ${r.reason ?? ""}`);

/** What a person decided about a row, in that person's words. */
const RESOLUTION: Record<string, { done: string; by: string }> = {
  overwritten: { done: "เขียนทับแล้ว", by: "คนเขียนทับ" },
  ignored: { done: "ไม่ใส่ให้ตามที่สั่ง", by: "คนสั่งไม่ใส่" },
  attached: { done: "ต่อเลขเข้าออเดอร์แล้ว", by: "คนต่อเลข" },
};

/**
 * The chips filter by what the sync *decided*, and a "fill" decision can have
 * ended three ways (written, refused, held back by the cap). The chip is
 * named for the decision so it does not claim an outcome its rows may not
 * share — the badge on each row says which one it was.
 */
const CHIP_LABEL: Record<string, string> = { fill: "เติมเลขพัสดุ" };

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

/** One line of the health strip: same shape whatever it is reporting. */
function HealthTile({
  icon,
  label,
  value,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "ok" | "warn" | "bad" | "info";
  children?: React.ReactNode;
}) {
  const ring = {
    ok: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
    warn: "text-amber-600 bg-amber-50 dark:bg-amber-950",
    bad: "text-rose-600 bg-rose-50 dark:bg-rose-950",
    info: "text-sky-600 bg-sky-50 dark:bg-sky-950",
  }[tone];
  return (
    <Card padded={false} className="flex min-w-0 items-start gap-3 p-4">
      <span className={clsx("grid size-9 shrink-0 place-items-center rounded-l", ring)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-brand-ink">{value}</p>
        {children}
      </div>
    </Card>
  );
}

/**
 * Who set this reading off.
 *
 * Every number in this log was read out of sokochan by the scraper — nobody
 * types them here. What differs is who started that run, and whether a person
 * has since overruled it, which is the question the column actually answers.
 */
function WhoTag({ row }: { row: TrackingSyncRow }) {
  // Nearly every row is the schedule, so the column used to be the same six
  // words repeated down the page. An icon says it at a glance and leaves the
  // eye free for the rows that differ.
  if (row.resolution)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-brand-800">
        <UserRound size={12} aria-hidden /> {RESOLUTION[row.resolution]?.by ?? "คนตัดสิน"}
      </span>
    );
  if (row.triggered_by === "admin")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-600">
        <UserRound size={12} aria-hidden /> คนกดซิงก์
      </span>
    );
  if (row.triggered_by === "cron")
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-400"
        title="รันอัตโนมัติตามเวลาที่ตั้งไว้"
      >
        <Bot size={12} aria-hidden /> บอท
      </span>
    );
  return <span className="text-[12px] text-slate-300">—</span>;
}

function ResultTag({ row }: { row: TrackingSyncRow }) {
  const meta = ACTION[row.action] ?? { label: row.action, tone: "neutral" as const };
  // "fill" is a decision, not an outcome, and one badge covered three of
  // them: a number written to Shopify, one held back by the hourly cap, and
  // one Shopify refused. Only the first is a success, so only the first is
  // green — and in dry-run nothing is written at all, which is why the plain
  // "พร้อมเติม" stays for a row with neither flag.
  const outcome =
    row.action !== "fill"
      ? meta
      : row.error
        ? { label: "เขียนไม่สำเร็จ", tone: "danger" as const }
        : row.applied
          ? { label: "เขียนแล้ว", tone: "success" as const }
          : meta;
  return (
    <>
      <Badge tone={outcome.tone} className="whitespace-nowrap">
        {outcome.label}
      </Badge>
      {row.action === "conflict" && (row.seen_count ?? 1) > 1 && (
        <span
          className="mt-1 block text-[10px] text-slate-400"
          title={row.last_seen_at ? `ล่าสุด ${fmt(row.last_seen_at)}` : undefined}
        >
          เจอซ้ำ {row.seen_count} รอบ
        </span>
      )}
    </>
  );
}

function Reason({ row }: { row: TrackingSyncRow }) {
  return (
    <>
      {row.reason}
      {row.existing_numbers?.length ? (
        <span className="mt-0.5 block font-mono text-[11px] text-rose-600">
          ใน Shopify: {row.existing_numbers.join(", ")}
        </span>
      ) : null}
      {/* Shown only when it says something the reason does not. A failed run
          stores the same sentence in both columns, so printing both put every
          one of those rows on the page twice. */}
      {row.error && row.error.trim() !== (row.reason ?? "").trim() && (
        <span className="mt-0.5 block text-[11px] text-rose-600">{row.error}</span>
      )}
    </>
  );
}

/** Whatever this row still lets someone do about it. */
function RowActions({
  row,
  shopDomain,
  resolving,
  onResolve,
  onAttach,
}: {
  row: TrackingSyncRow;
  shopDomain: string | null;
  resolving: string | null;
  onResolve: (row: TrackingSyncRow, resolution: "overwritten" | "ignored") => void;
  onAttach: (row: TrackingSyncRow, decision: "attach" | "skip") => void;
}) {
  // A mismatch used to end at its reason: the page named the problem and
  // offered nothing to do about it, so settling one meant opening Shopify and
  // keying the number in — the manual step this replaces.
  if (row.action === "conflict" && !row.resolved_at)
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onResolve(row, "overwritten")}
          disabled={resolving === row.id}
          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          ใช้เลขใหม่ทับ
        </button>
        <button
          onClick={() => onResolve(row, "ignored")}
          disabled={resolving === row.id}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          เก็บเลขเดิมไว้
        </button>
      </span>
    );

  // A follow-up parcel: the number belongs on an order that is already closed,
  // so the write adds it to that order's list rather than fulfilling anything.
  if (isFollowUp(row) && !row.resolved_at)
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onAttach(row, "attach")}
          disabled={resolving === row.id}
          className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
        >
          ต่อเลขเข้าออเดอร์
        </button>
        <button
          onClick={() => onAttach(row, "skip")}
          disabled={resolving === row.id}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          ไม่ต้องใส่
        </button>
      </span>
    );

  if (row.resolved_at)
    return (
      <span className="block text-[11px] font-medium text-slate-400">
        {RESOLUTION[row.resolution ?? ""]?.done ?? "จัดการแล้ว"} · {fmt(row.resolved_at)}
      </span>
    );

  // "Not found" is usually a number keyed against the wrong order, so the
  // useful next step is a search, not a second message saying it is still not
  // found.
  if (row.action === "no-order" && shopDomain)
    return (
      <a
        href={`https://admin.shopify.com/store/${shopDomain}/orders?query=${encodeURIComponent(row.order_ref.replace(/^#/, ""))}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
      >
        ค้นหาใน Shopify <ExternalLink size={10} />
      </a>
    );

  return <span className="text-[11px] text-slate-300">—</span>;
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

  const dryRun = data?.mode === "dry-run";

  const [showTests, setShowTests] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
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
            : `ไม่สำเร็จ (HTTP ${res.status}) — ${raw.slice(0, 120)}`,
        );
        return;
      }
      if (!r.ok) {
        setRunResult(`ไม่สำเร็จ: ${r.error ?? "ไม่ทราบสาเหตุ"}`);
      } else if (!r.found) {
        const d = r.diagnostics as
          { pagesScanned?: number; candidates?: number; skipped?: number; ranOutOfTime?: boolean } | undefined;
        setRunResult(
          `ไม่มีรายการใหม่ — อ่าน ${d?.pagesScanned ?? "?"} หน้า พบ ${d?.candidates ?? "?"} ออเดอร์ ` +
            `ข้ามที่ทำไปแล้ว ${d?.skipped ?? 0} รายการ` +
            (d?.ranOutOfTime ? " (อ่านไม่ครบ เพราะใกล้หมดเวลา — กดอีกครั้งเพื่ออ่านต่อ)" : ""),
        );
      } else {
        setRunResult(
          `ดึงมา ${r.found} รายการ · เขียนลง Shopify ${r.applied ?? 0} · ต้องตรวจสอบ ${r.conflicts ?? 0}` +
            (Number(r.unfinished) > 0 ? ` · เหลืออีก ${r.unfinished} รายการ กดอีกครั้งเพื่อทำต่อ` : ""),
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
          : `ไม่สำเร็จ: ${r.error ?? "ไม่ทราบสาเหตุ"}`,
      );
    } catch (err) {
      setRunResult(`ไม่สำเร็จ: ${err}`);
    } finally {
      setResolving(null);
      load();
    }
  }

  async function attach(row: TrackingSyncRow, decision: "attach" | "skip") {
    const order = row.resolved_order_name || row.order_ref;
    const message =
      decision === "attach"
        ? `เพิ่มเลข ${row.tracking_number} เข้าไปในออเดอร์ ${order} (กล่องส่งตาม ${row.order_ref})\n\nเลขเดิมของออเดอร์จะยังอยู่ครบ และไม่มีอีเมลถึงลูกค้า — ต้องแจ้งลูกค้าเอง ยืนยันหรือไม่?`
        : `ไม่ใส่เลข ${row.tracking_number} ให้ออเดอร์ ${order} และเอาออกจากคิว ยืนยันหรือไม่?`;
    if (!window.confirm(message)) return;

    setResolving(row.id);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/tracking-sync/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, decision }),
      });
      const r = await res.json();
      setRunResult(
        r.ok
          ? decision === "attach"
            ? `เพิ่ม ${row.tracking_number} เข้าออเดอร์ ${order} แล้ว (ไม่ได้ส่งอีเมล — แจ้งลูกค้าเองด้วย)`
            : `เอา ${row.tracking_number} ออกจากคิวแล้ว`
          : `ไม่สำเร็จ: ${r.error ?? "ไม่ทราบสาเหตุ"}`,
      );
    } catch (err) {
      setRunResult(`ไม่สำเร็จ: ${err}`);
    } finally {
      setResolving(null);
      load();
    }
  }

  useAdminAction({
    label: running ? "กำลังดึง…" : "ดึงจาก soko เดี๋ยวนี้",
    icon: running ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />,
    onClick: runNow,
    disabled: running || loading,
  });

  const visible = useMemo(() => (data?.rows ?? []).filter((r) => showTests || !r.is_test), [data?.rows, showTests]);

  // The chips count what the log actually holds, so a chip can never offer a
  // filter that turns the table empty.
  const chipCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of visible) acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, [visible]);

  const openConflicts = useMemo(() => visible.filter((r) => r.action === "conflict" && !r.resolved_at), [visible]);

  const parcels = useMemo(() => visible.filter((r) => !RUN_ROW.has(r.action)), [visible]);

  // One entry per parcel: runs before 15 Sep logged the same follow-up on
  // every pass, and six rows for one box is not six decisions.
  const followUps = useMemo(() => {
    const seen = new Set<string>();
    return visible.filter((r) => {
      if (!isFollowUp(r) || r.resolved_at || seen.has(r.tracking_number)) return false;
      seen.add(r.tracking_number);
      return true;
    });
  }, [visible]);

  const grouped = useMemo(
    () => groupParcels(filter ? visible.filter((r) => r.action === filter) : parcels),
    [visible, parcels, filter],
  );

  const failing = (data?.connection.consecutiveFailures ?? 0) >= 2;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
            <Truck size={20} className="text-brand-600" /> ซิงก์เลขพัสดุ
          </h1>
          <p className="mt-0.5 text-body-xs text-slate-500">
            อ่านเลขพัสดุจาก soko แล้วเทียบกับออเดอร์ใน Shopify
            {data?.connection.lastSuccessAt && ` · ดึงสำเร็จล่าสุด ${fmt(data.connection.lastSuccessAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* "ดึงจาก soko เดี๋ยวนี้" lives in the console header (see
              useAdminAction below) and does not need to be here as well.
              CRON_SECRET is stored on Vercel as a sensitive value, so nobody
              can read it back — triggering a run by hand meant rotating it and
              redeploying. Staff are already signed in here; that is the key. */}
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> รีเฟรช
          </Button>
        </div>
      </header>

      {runResult && (
        <p className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-2.5 text-body-xs text-slate-700">
          {runResult}
        </p>
      )}

      {/* Can the scraper get into soko, what is it allowed to write, and with
          whose credentials — three different questions. They were once one
          sentence, and a login that had been failing for an hour read as a
          note about write mode. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HealthTile
          icon={failing ? <AlertTriangle size={17} /> : <PlugZap size={17} />}
          label="การเชื่อมต่อ soko"
          tone={failing ? "bad" : "ok"}
          value={failing ? `ล้มเหลวติดกัน ${data?.connection.consecutiveFailures} รอบ` : "ปกติ"}
        >
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            สำเร็จล่าสุด: {data?.connection.lastSuccessAt ? fmt(data.connection.lastSuccessAt) : "ยังไม่เคย"}
            {data?.connection.lastFailureAt && (
              <>
                <br />
                ล้มเหลวล่าสุด: {fmt(data.connection.lastFailureAt)}
              </>
            )}
          </p>
          {failing && data?.connection.lastFailureReason && (
            <p className="mt-1 text-[11px] text-rose-700">{data.connection.lastFailureReason}</p>
          )}
        </HealthTile>

        <HealthTile
          icon={dryRun ? <ShieldCheck size={17} /> : <AlertTriangle size={17} />}
          label="โหมดการทำงาน"
          tone={dryRun ? "info" : "warn"}
          value={dryRun ? "ทดลอง (dry run)" : (data?.mode ?? "—")}
        >
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {dryRun
              ? "รับข้อมูล ตัดสินใจ และบันทึกไว้เท่านั้น — ยังไม่เขียนลง Shopify และไม่มีอีเมลถึงลูกค้า"
              : "โหมดนี้เขียนลง Shopify จริง"}
          </p>
          {data && !data.configured && (
            <p className="mt-1 text-[11px] text-rose-600">
              ยังไม่ได้ตั้ง TRACKING_WEBHOOK_SECRET — endpoint จะปฏิเสธทุกคำขอ
            </p>
          )}
        </HealthTile>

        <HealthTile
          icon={<KeyRound size={17} />}
          label="สิทธิ์ใน Shopify"
          tone={data?.canWrite ? "ok" : "bad"}
          value={data?.app ?? "ไม่ทราบแอป"}
        >
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            เขียนเลขพัสดุ:{" "}
            {data?.canWrite ? <b className="text-brand-800">มี ✅</b> : <b className="text-rose-600">ยังไม่มี ❌</b>}
            <br />
            สั่ง fulfill เองได้:{" "}
            {data?.canFulfil ? <b className="text-brand-800">มี ✅</b> : <b className="text-rose-600">ยังไม่มี ❌</b>}
          </p>
        </HealthTile>
      </div>

      {/* The only rows on this page that are waiting for a person, lifted out
          of the log so nobody has to find them in it. Each one is a tracking
          number keyed onto the wrong order by hand, or a mapping bug. */}
      {openConflicts.length > 0 && (
        <section className="rounded-xl2 border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-rose-800">
              <AlertTriangle size={15} /> ต้องตัดสิน {openConflicts.length} รายการ
            </h2>
            {/* This used to say "check them all before turning on real
                writing" regardless of mode — while the mode was already
                write-notify and writing. Staff read it as "nothing has been
                written yet". */}
            <p className="text-[11px] leading-relaxed text-rose-700">
              {dryRun
                ? "ต้องตรวจให้หมดก่อนเปิดโหมดเขียนจริง"
                : "ระบบข้ามไว้ ไม่ได้เขียนทับของเดิม ส่วนออเดอร์อื่นเขียนตามปกติ"}
            </p>
          </div>

          {/* Rows of one shape, so the two numbers line up down the page and
              "is this the same tracking number twice" is a glance rather than
              a read. Cards below md, where five columns do not fit. */}
          <div className="mt-3 hidden overflow-hidden rounded-l bg-white md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="w-40">ออเดอร์</th>
                  <th className="w-56">ใน Shopify</th>
                  <th className="w-56">soko ส่งมา</th>
                  <th>เหตุผล</th>
                  <th className="w-56 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {openConflicts.map((r) => (
                  <tr key={r.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{r.resolved_order_name || r.order_ref}</span>
                      {(r.seen_count ?? 1) > 1 && (
                        <span className="mt-0.5 block text-[11px] text-slate-400">เจอซ้ำ {r.seen_count} รอบ</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-rose-600">
                      {r.existing_numbers?.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-brand-800">{r.tracking_number}</td>
                    <td className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">{r.reason}</td>
                    <td className={adminTable.cell}>
                      <span className="flex flex-wrap items-center justify-end gap-1.5">
                        <RowActions
                          row={r}
                          shopDomain={data?.shopDomain ?? null}
                          resolving={resolving}
                          onResolve={resolve}
                          onAttach={attach}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 grid gap-2 md:hidden">
            {openConflicts.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-l border border-rose-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">
                    {r.resolved_order_name || r.order_ref}
                    {(r.seen_count ?? 1) > 1 && (
                      <span className="ml-1.5 text-[10px] font-medium text-slate-400">เจอซ้ำ {r.seen_count} รอบ</span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    ใน Shopify: <span className="text-rose-600">{r.existing_numbers?.join(", ") || "—"}</span>
                    <br />
                    soko ส่งมา: <span className="text-brand-800">{r.tracking_number}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <RowActions
                    row={r}
                    shopDomain={data?.shopDomain ?? null}
                    resolving={resolving}
                    onResolve={resolve}
                    onAttach={attach}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Second queue, deliberately separate from the mismatches. A mismatch
          is "two systems disagree, somebody has to be right"; a follow-up is
          "this parcel is real and nobody has told the customer" — the same
          shape of work, a different question, and mixing them made the
          mismatches look routine. */}
      {followUps.length > 0 && (
        <section className="rounded-xl2 border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-800">
              <PackagePlus size={15} /> ของส่งตาม {followUps.length} กล่อง
            </h2>
            <p className="text-[11px] leading-relaxed text-slate-600">
              กล่องที่ส่งตามหลังออเดอร์ปิดไปแล้ว — กดต่อเลขเข้าออเดอร์ แล้วเลขนี้จะไปต่อท้ายเลขเดิมที่มีอยู่
              ไม่มีอีเมลถึงลูกค้า (ต้องแจ้งเอง)
            </p>
          </div>

          <div className="mt-3 hidden overflow-hidden rounded-l bg-white md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="w-40">ออเดอร์</th>
                  <th className="w-40">อ้างอิงของคลัง</th>
                  <th className="w-56">เลขกล่องนี้</th>
                  <th className="w-40">เข้ามาเมื่อ</th>
                  <th className="w-56 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((r) => (
                  <tr key={r.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{r.resolved_order_name || r.order_ref}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-slate-400">{r.order_ref}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-brand-800">{r.tracking_number}</td>
                    <td className={adminTable.muted}>{fmt(r.received_at)}</td>
                    <td className={adminTable.cell}>
                      <span className="flex flex-wrap items-center justify-end gap-1.5">
                        <RowActions
                          row={r}
                          shopDomain={data?.shopDomain ?? null}
                          resolving={resolving}
                          onResolve={resolve}
                          onAttach={attach}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 grid gap-2 md:hidden">
            {followUps.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-l border border-brand-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">
                    {r.resolved_order_name || r.order_ref}
                    <span className="ml-1.5 font-mono text-[10px] font-medium text-slate-400">{r.order_ref}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    เลขกล่องนี้: <span className="text-brand-800">{r.tracking_number}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <RowActions
                    row={r}
                    shopDomain={data?.shopDomain ?? null}
                    resolving={resolving}
                    onResolve={resolve}
                    onAttach={attach}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <h2 className="mr-1 flex items-center gap-1.5 text-sm font-bold text-brand-ink">
            <Boxes size={15} className="text-brand-600" /> บันทึกการซิงก์
          </h2>
          {/* Counts and filter are the same control: the numbers were five
              tiles that could only be read, and picking one out of the log
              meant scrolling past the rest. */}
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5">
            <FilterChip active={!filter} count={parcels.length} label="พัสดุทั้งหมด" onClick={() => setFilter(null)} />
            {Object.keys(ACTION)
              .filter((key) => chipCounts[key])
              .map((key) => (
                <FilterChip
                  key={key}
                  active={filter === key}
                  count={chipCounts[key]}
                  label={CHIP_LABEL[key] ?? ACTION[key].label}
                  tone={ACTION[key].tone}
                  onClick={() => setFilter(filter === key ? null : key)}
                />
              ))}
          </div>
          {data && data.testRowCount > 0 && (
            <button
              onClick={() => setShowTests((v) => !v)}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                showTests
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              )}
            >
              {showTests ? "ซ่อน" : "แสดง"}รายการทดสอบ ({data.testRowCount})
            </button>
          )}
        </div>

        {loading && !data ? (
          <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
        ) : !data?.rows.length ? (
          <p className="flex flex-wrap items-start gap-1.5 p-4 text-body-xs text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
            ยังไม่มีข้อมูลเข้ามา — ให้ระบบต้นทางยิง POST มาที่{" "}
            <code className="rounded-sm bg-surface-soft px-1">/api/webhooks/tracking</code> พร้อม header{" "}
            <code className="rounded-sm bg-surface-soft px-1">x-tracking-secret</code>
          </p>
        ) : !grouped.length ? (
          <p className="py-10 text-center text-sm text-slate-400">ไม่มีรายการในตัวกรองนี้</p>
        ) : (
          <>
            {/* Two renderings of one list. A six-column table does not fit a
                phone, and the sideways scroll it needed hid the columns that
                say what happened — so below md each row becomes a card. */}
            <div className="hidden max-h-[calc(100dvh-24rem)] overflow-y-auto md:block">
              {/* Sizes and rhythm are the whole readability of this table: one
                  height per row, 13px for the things read as words and 12px
                  mono for the numbers, and a hover tint so the eye can hold a
                  row across seven columns of a 27" screen. */}
              <table className={adminTable.table}>
                <thead className={adminTable.thead}>
                  <tr>
                    <th className="w-[7.5rem]">เวลา</th>
                    <th className="w-44">ออเดอร์</th>
                    <th className="w-40">เลขที่ส่งมา</th>
                    <th className="w-[6.5rem]">ใครใส่</th>
                    <th className="w-[8.5rem]">ผล</th>
                    <th>รายละเอียด</th>
                    <th className="w-52 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ row: r, box, boxes, firstOfSet }) => (
                    <tr
                      key={r.id}
                      className={clsx(
                        "align-middle transition-colors hover:bg-brand-50/40",
                        // A set's boxes are tied together by a rule down the
                        // left and by naming the order only once, so two lines
                        // read as one order going out in two boxes rather than
                        // two unrelated events.
                        boxes > 1
                          ? firstOfSet
                            ? "border-t border-slate-100 border-l-2 border-l-brand-teal/50"
                            : "border-l-2 border-l-brand-teal/50"
                          : "border-t border-slate-100",
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-slate-400">
                        {firstOfSet ? fmt(r.received_at) : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        {firstOfSet ? (
                          <>
                            <span className="font-semibold text-brand-ink">{r.resolved_order_name || r.order_ref}</span>
                            {!r.resolved_order_name && <span className="ml-1 text-[11px] text-slate-400">(ไม่พบ)</span>}
                            {boxes > 1 && (
                              <span className="ml-1.5 whitespace-nowrap rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                                {boxes} กล่อง
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[12px] text-slate-400">↳ กล่อง {box}</span>
                        )}
                        {/* The warehouse's own ref, shown only inside a set —
                            it is the only thing that tells the boxes apart. */}
                        {boxes > 1 && (
                          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{r.order_ref}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-slate-700">{r.tracking_number}</td>
                      <td className="px-3 py-2.5">
                        <WhoTag row={r} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ResultTag row={r} />
                      </td>
                      {/* Capped rather than stretched: on a 27" monitor the
                          reason ran the full width of the screen, which is
                          twice as long a line as anyone reads comfortably. */}
                      <td className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
                        <span className="block max-w-[56ch]">
                          <Reason row={r} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center justify-end gap-1.5">
                          <RowActions
                            row={r}
                            shopDomain={data.shopDomain}
                            resolving={resolving}
                            onResolve={resolve}
                            onAttach={attach}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {grouped.map(({ row: r, box, boxes, firstOfSet }) => (
                <li key={r.id} className={clsx("p-3", boxes > 1 && "border-l-2 border-l-brand-teal/50 bg-brand-50/20")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-ink">
                        {firstOfSet ? r.resolved_order_name || r.order_ref : `↳ กล่อง ${box}`}
                        {firstOfSet && !r.resolved_order_name && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400">(ไม่พบ)</span>
                        )}
                        {firstOfSet && boxes > 1 && (
                          <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                            {boxes} กล่อง
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {r.tracking_number}
                        {/* Inside a set, the warehouse's own ref is the only
                            thing that tells the boxes apart. */}
                        {boxes > 1 && <span className="ml-1.5 text-[10px] text-slate-400">{r.order_ref}</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <ResultTag row={r} />
                      <p className="mt-1 text-[10px] text-slate-400">{fmt(r.received_at)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    <Reason row={r} />
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <WhoTag row={r} />
                    <RowActions
                      row={r}
                      shopDomain={data.shopDomain}
                      resolving={resolving}
                      onResolve={resolve}
                      onAttach={attach}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "success" | "neutral" | "danger" | "warning" | "info";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {tone === "danger" && !active && <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />}
      {label}
      <span className={clsx("font-bold tabular-nums", active ? "text-brand-800" : "text-slate-400")}>{count}</span>
    </button>
  );
}
