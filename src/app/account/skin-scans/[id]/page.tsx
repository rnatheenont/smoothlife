"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Camera, Loader2, Trash2 } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import FaceMap from "@/components/skin-coach/FaceMap";
import ScoreChips from "@/components/skin-coach/ScoreChips";
import RadarChart from "@/components/skin-coach/RadarChart";
import MiniProductCard from "@/components/skin-coach/MiniProductCard";
import { formatScanDate, gapBetween } from "@/components/skin-coach/ScanHistory";
import { CONCERN_DEFS, concernScore, healthBand, type ConcernMetric } from "@/lib/skin-analysis";
import { ANGLES, ageComparison, type AgeRangeKey, type SkinTypeKey } from "@/lib/skin-coach";
import { PRODUCT_TYPE_LABEL, recommendFor } from "@/lib/skin-recommend";
import {
  namedConcernLabels,
  scanAreas,
  scanScore,
  scoreTone,
  skinTypeLabels,
  weakConcerns,
} from "@/lib/skin-scan-summary";
import type { SkinScanRow } from "@/app/api/skin-coach/history/route";

// One saved scan in full, reopened from the account: the same face map, score
// rings and report the member saw on the day, against the scan before it.

const CONFIDENCE_LABEL: Record<string, string> = { basic: "พื้นฐาน", good: "ดี", detailed: "ละเอียด" };

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-surface-soft px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-surface-line">
          {t}
        </span>
      ))}
    </span>
  );
}

function ScanDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [scan, setScan] = useState<SkinScanRow | null>(null);
  const [previous, setPrevious] = useState<SkinScanRow | null>(null);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<ConcernMetric | "all">("all");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/skin-coach/history?id=${encodeURIComponent(params.id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) return setError(json.error || "ไม่พบผลสแกนนี้");
      setScan(json.scan);
      setPrevious(json.previous);
    } catch {
      setError("โหลดผลสแกนไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const picks = useMemo(() => {
    if (!scan) return [];
    const skinTypes = (scan.skin_type ?? "").split(",").filter(Boolean) as SkinTypeKey[];
    const shown = new Set<string>();
    return weakConcerns(scan, 3).map((concern) => {
      const list = recommendFor(concern, { max: 3, exclude: shown, skinTypes });
      list.forEach((r) => shown.add(r.product.slug));
      return { concern, list };
    });
  }, [scan]);

  async function remove() {
    if (!scan) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/skin-coach/history?id=${scan.id}`, { method: "DELETE" });
      if ((await res.json()).ok) router.push("/account/skin-scans");
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-600">{error}</p>
        <Link href="/account/skin-scans" className="mt-3 inline-block text-sm font-semibold text-brand-800">
          กลับไปหน้าผลสแกนทั้งหมด
        </Link>
      </div>
    );
  }
  if (!scan) {
    return (
      <div className="grid place-items-center py-20 text-slate-500">
        <Loader2 size={22} className="animate-spin" aria-label="กำลังโหลด" />
      </div>
    );
  }

  const score = scanScore(scan);
  const band = healthBand(score);
  const diff = previous ? score - scanScore(previous) : null;
  const areas = scanAreas(scan);
  const types = skinTypeLabels(scan);
  const named = namedConcernLabels(scan);
  const comparison = ageComparison(scan.skin_age, (scan.age_range ?? undefined) as AgeRangeKey | undefined);
  const angleLabels = scan.angles.map((a) => ANGLES.find((x) => x.key === a)?.label ?? a);
  const focused = focus !== "all" && scan.concerns ? scan.concerns[focus] : null;

  return (
    <div>
      <Link href="/account/skin-scans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-ink">
        <ArrowLeft size={15} aria-hidden="true" /> ผลสแกนทั้งหมด
      </Link>
      <h1 className="text-2xl font-bold text-brand-ink">ผลสแกนวันที่ {formatScanDate(scan.scanned_at)}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {angleLabels.join(" · ")} · ความละเอียดของผล {CONFIDENCE_LABEL[scan.confidence] ?? scan.confidence}
      </p>

      {/* Skin report */}
      <section className="mt-5 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-slate-500">คะแนนผิว</p>
            <p className="text-4xl font-bold tabular-nums leading-tight" style={{ color: band.color }}>
              {score}
              <span className="text-base font-semibold text-slate-400">/100</span>
            </p>
            <p className="text-sm font-semibold" style={{ color: band.color }}>
              {band.label}
            </p>
          </div>
          <div className="hidden h-12 w-px bg-surface-line sm:block" aria-hidden="true" />
          <div>
            <p className="text-xs text-slate-500">อายุผิวโดยประมาณ</p>
            <p className="text-2xl font-bold tabular-nums text-brand-ink">{scan.skin_age} ปี</p>
            {comparison && <p className="text-xs text-slate-600">{comparison}</p>}
          </div>
          {previous && diff !== null && (
            <>
              <div className="hidden h-12 w-px bg-surface-line sm:block" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500">เทียบครั้งก่อน ({gapBetween(previous.scanned_at, scan.scanned_at)})</p>
                <p className={clsx("text-2xl font-bold tabular-nums", diff > 0 ? "text-brand-800" : diff < 0 ? "text-amber-700" : "text-slate-700")}>
                  {diff > 0 ? `+${diff}` : diff}
                </p>
                <Link href={`/account/skin-scans/${previous.id}`} className="text-xs font-semibold text-brand-800">
                  ดูผลครั้งก่อน ({formatScanDate(previous.scanned_at)})
                </Link>
              </div>
            </>
          )}
        </div>
        {(types.length > 0 || named.length > 0) && (
          <div className="mt-4 flex flex-col gap-2 border-t border-surface-line pt-4 text-xs text-slate-600">
            {types.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0">สภาพผิว</span>
                <Chips items={types} />
              </div>
            )}
            {named.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0">เรื่องที่กังวล</span>
                <Chips items={named} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Face map / score rings */}
      {scan.concerns && (
        <section className="mt-5 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-brand-ink">แผนที่ผิว</h2>
          <p className="mt-1 text-sm text-slate-600">
            {scan.photo_url ? "แตะคะแนนแต่ละด้านเพื่อดูว่าเห็นตรงบริเวณไหน" : "แตะคะแนนแต่ละด้านเพื่ออ่านสิ่งที่ระบบเห็น"}
          </p>
          {scan.photo_url ? (
            <div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-xl2">
              <FaceMap photo={scan.photo_url} concerns={scan.concerns} selected={focus} />
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-surface-soft px-3.5 py-2.5 text-xs text-slate-600">
              ครั้งนี้ไม่ได้เก็บรูปไว้ จึงแสดงเป็นคะแนนอย่างเดียว
            </p>
          )}
          <div className="mt-4">
            <ScoreChips concerns={scan.concerns} health={score} selected={focus} onSelect={setFocus} />
          </div>
          {focused && focus !== "all" && (
            <div className="mt-3 rounded-xl bg-surface-soft p-3.5">
              <p className="text-sm font-bold text-brand-ink">
                {CONCERN_DEFS[focus].label} {concernScore(focused.severity)} คะแนน
              </p>
              {focused.note && <p className="mt-1 text-sm text-slate-600">{focused.note}</p>}
            </div>
          )}
        </section>
      )}

      {/* Every area, worst first */}
      <section className="mt-5 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-brand-ink">คะแนนแต่ละด้าน</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {areas.map((a) => (
            <li key={a.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-slate-700">{a.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-line" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${a.score}%`, backgroundColor: a.color }} />
              </span>
              <span className={clsx("w-8 text-right text-sm font-bold tabular-nums", scoreTone(a.score))}>{a.score}</span>
            </li>
          ))}
        </ul>
        {scan.concerns && (
          <div className="mx-auto mt-5 max-w-md">
            <RadarChart concerns={scan.concerns} previous={previous?.concerns ?? null} />
            {previous?.concerns && <p className="text-center text-xs text-slate-500">เส้นประ = ผลครั้งก่อน</p>}
          </div>
        )}
      </section>

      {/* Products for the weakest areas */}
      {picks.some((p) => p.list.length > 0) && (
        <section className="mt-5 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-brand-ink">สินค้าแนะนำสำหรับด้านที่ควรดูแล</h2>
          {picks
            .filter((p) => p.list.length > 0)
            .map(({ concern, list }) => (
              <div key={concern} className="mt-4">
                <p className="text-sm font-semibold text-brand-ink">{CONCERN_DEFS[concern].label}</p>
                <div className="scrollbar-none mt-2.5 flex snap-x gap-3 overflow-x-auto pb-2">
                  {list.map((r) => (
                    <MiniProductCard key={r.product.slug} product={r.product} typeLabel={PRODUCT_TYPE_LABEL[r.type]} />
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/skin-coach"
          className="flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-xs"
        >
          <Camera size={15} aria-hidden="true" /> สแกนใหม่เพื่อเทียบ
        </Link>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-600">ลบผลสแกนนี้{scan.photo_url ? "และรูป" : ""}?</span>
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              ยืนยันลบ
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-xs text-slate-600">
              ยกเลิก
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-rose-700"
          >
            <Trash2 size={14} aria-hidden="true" /> ลบผลสแกนนี้
          </button>
        )}
      </div>
    </div>
  );
}

export default function SkinScanDetailPage() {
  return (
    <AccountLayout>
      <ScanDetail />
    </AccountLayout>
  );
}
