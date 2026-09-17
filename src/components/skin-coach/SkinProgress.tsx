"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import type { SkinScanRow } from "@/app/api/skin-coach/history/route";
import { CONCERN_DEFS, CONCERN_KEYS, concernScore, type ConcernMetric } from "@/lib/skin-analysis";
import { formatScanDate, gapBetween } from "./ScanHistory";

type Metric = ConcernMetric | "health";

function valueOf(scan: SkinScanRow, metric: Metric): number | null {
  if (metric === "health") return scan.skin_health;
  const c = scan.concerns?.[metric];
  return c ? concernScore(c.severity) : null;
}

/** Score over time for one metric, oldest on the left. */
function LineChart({ scans, metric }: { scans: SkinScanRow[]; metric: Metric }) {
  const points = scans
    .slice()
    .reverse()
    .map((s) => ({ s, v: valueOf(s, metric) }))
    .filter((p): p is { s: SkinScanRow; v: number } => p.v !== null);
  const color = metric === "health" ? "#05755F" : CONCERN_DEFS[metric].color;
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-600">บันทึกผลอย่างน้อย 2 ครั้งเพื่อดูกราฟพัฒนาการ</p>;
  }
  const W = 320;
  const H = 150;
  const pad = { l: 28, r: 12, t: 14, b: 26 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="กราฟคะแนนตามเวลา">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#E2E8F0" strokeWidth="1" />
          <text x={pad.l - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#64748B">
            {g}
          </text>
        </g>
      ))}
      <path d={`${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={color} fillOpacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.s.id}>
          <circle cx={x(i)} cy={y(p.v)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={x(i)} y={y(p.v) - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
            {p.v}
          </text>
          {(i === 0 || i === points.length - 1 || points.length <= 5) && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="#64748B"
            >
              {formatScanDate(p.s.scanned_at)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * Progress over saved scans, and a before/after of the kept photos. Photos
 * appear only for scans saved with the separate photo consent; "ลบรูปทั้งหมด"
 * withdraws it and keeps the numbers.
 */
export default function SkinProgress({
  scans,
  onPhotosRemoved,
}: {
  scans: SkinScanRow[];
  onPhotosRemoved: () => void;
}) {
  const [metric, setMetric] = useState<Metric>("health");
  const withPhoto = useMemo(() => scans.filter((s) => s.photo_url), [scans]);
  const after = withPhoto[0] ?? null; // newest
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const before = withPhoto.find((s) => s.id === beforeId) ?? withPhoto[withPhoto.length - 1] ?? null; // oldest by default
  const [removing, setRemoving] = useState(false);

  async function removeAllPhotos() {
    if (!window.confirm("ลบรูปที่เก็บไว้เทียบก่อน-หลังทั้งหมด? ผลสแกนที่เป็นตัวเลขยังอยู่")) return;
    setRemoving(true);
    try {
      await fetch("/api/skin-coach/history?all=1&photos=1", { method: "DELETE" });
      onPhotosRemoved();
    } finally {
      setRemoving(false);
    }
  }

  const metrics: { key: Metric; label: string }[] = [
    { key: "health", label: "ภาพรวม" },
    ...CONCERN_KEYS.map((k) => ({ key: k as Metric, label: CONCERN_DEFS[k].label })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-brand-ink">พัฒนาการของผิว</h3>
        <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                metric === m.key ? "border-brand-800 bg-brand-800 font-semibold text-white" : "border-surface-line text-slate-700"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <LineChart scans={scans} metric={metric} />
        </div>
      </div>

      {withPhoto.length >= 2 && before && after && before.id !== after.id ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-brand-ink">เทียบก่อน-หลัง</h3>
            <label className="text-xs text-slate-600">
              เทียบกับ{" "}
              <select
                value={before.id}
                onChange={(e) => setBeforeId(e.target.value)}
                className="rounded-lg border border-surface-line bg-white px-2 py-1 text-xs"
              >
                {withPhoto.slice(1).map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatScanDate(s.scanned_at)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              { s: before, tag: "ก่อน" },
              { s: after, tag: "ล่าสุด" },
            ].map(({ s, tag }) => (
              <figure key={s.id}>
                <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photo_url!} alt={`รูป${tag} ${formatScanDate(s.scanned_at)}`} className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{tag}</span>
                </div>
                <figcaption className="mt-1.5 text-xs text-slate-600">
                  {formatScanDate(s.scanned_at)}
                  {s.skin_health !== null && (
                    <>
                      {" · "}
                      <span className="font-semibold text-brand-ink">ภาพรวม {s.skin_health}</span>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
          {before.skin_health !== null && after.skin_health !== null && (
            <p className="mt-2 text-sm text-slate-600">
              ห่างกัน {gapBetween(before.scanned_at, after.scanned_at)} · คะแนนภาพรวม{" "}
              <span className={clsx("font-semibold", after.skin_health >= before.skin_health ? "text-brand-800" : "text-amber-800")}>
                {after.skin_health >= before.skin_health ? "+" : ""}
                {after.skin_health - before.skin_health}
              </span>
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-mist px-4 py-3 text-xs text-slate-600">
          เทียบก่อน-หลังได้เมื่อบันทึกผลพร้อมเก็บรูปอย่างน้อย 2 ครั้ง
        </p>
      )}

      {withPhoto.length > 0 && (
        <button
          type="button"
          onClick={removeAllPhotos}
          disabled={removing}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-700 disabled:opacity-50"
        >
          <ImageOff size={14} aria-hidden="true" /> ลบรูปที่เก็บไว้ทั้งหมด (คงผลสแกนไว้)
        </button>
      )}
    </div>
  );
}
