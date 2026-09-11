"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { SkinScanRow } from "@/app/api/skin-coach/history/route";

const dateFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export function formatScanDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

/** "6 สัปดาห์", "3 วัน" — the gap between two scans, in the unit that reads naturally. */
export function gapBetween(fromIso: string, toIso: string) {
  const days = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000));
  if (days < 1) return "วันเดียวกัน";
  if (days < 14) return `${days} วัน`;
  if (days < 60) return `${Math.round(days / 7)} สัปดาห์`;
  return `${Math.round(days / 30)} เดือน`;
}

/** The signed-in member's saved scans, newest first. Empty for guests. */
export function useScanHistory() {
  const { user } = useAuth();
  const signedIn = Boolean(user?.real);
  const [scans, setScans] = useState<SkinScanRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!signedIn) {
      setScans([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/skin-coach/history", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setScans(data.scans);
    } finally {
      setLoaded(true);
    }
  }, [signedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { signedIn, scans, loaded, reload, setScans };
}

function Delta({ from, to }: { from: number; to: number }) {
  const diff = to - from;
  if (diff === 0) return <span className="text-xs text-slate-600">เท่าเดิม</span>;
  // Lower skin age reads as better, so a drop is the good direction.
  return diff < 0 ? (
    <span className="text-xs font-semibold text-brand-800">อ่อนลง {Math.abs(diff)} ปี</span>
  ) : (
    <span className="text-xs font-semibold text-amber-800">เพิ่มขึ้น {diff} ปี</span>
  );
}

/** Saved scans as a list, each with its change from the one before it. */
export default function ScanHistory({
  scans,
  onDeleted,
}: {
  scans: SkinScanRow[];
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/skin-coach/history?id=${id}`, { method: "DELETE" });
      if ((await res.json()).ok) onDeleted(id);
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (scans.length === 0) return null;

  return (
    <ul className="divide-y divide-surface-line">
      {scans.map((scan, i) => {
        const previous = scans[i + 1];
        return (
          <li key={scan.id} className="flex items-center gap-3 py-3">
            <div className="w-20 shrink-0 text-xs text-slate-600 tabular-nums">{formatScanDate(scan.scanned_at)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-ink tabular-nums">อายุผิว {scan.skin_age} ปี</p>
              <p className="text-xs text-slate-600">
                {scan.angles.length} มุม
                {previous && (
                  <>
                    {" · "}
                    <Delta from={previous.skin_age} to={scan.skin_age} />
                  </>
                )}
              </p>
            </div>
            {confirming === scan.id ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => remove(scan.id)}
                  disabled={busy === scan.id}
                  className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  ยืนยันลบ
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="text-xs text-slate-600">
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(scan.id)}
                aria-label={`ลบผลสแกนวันที่ ${formatScanDate(scan.scanned_at)}`}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-700"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
