"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Info, MessageCircle, RotateCcw } from "lucide-react";
import MiniProductCard from "@/components/skin-coach/MiniProductCard";
import type { Product } from "@/data/types";
import { useQuickChat } from "@/lib/quickchat-context";
import { useAuth } from "@/lib/auth-context";
import ShareCard from "@/components/skin-coach/ShareCard";
import RewardClaim from "@/components/skin-coach/RewardClaim";
import ScanHistory, { formatScanDate, gapBetween, useScanHistory } from "@/components/skin-coach/ScanHistory";
import {
  ANGLES,
  ageComparison,
  boughtCountForMetric,
  clarityLevel,
  confidenceFor,
  overallScore,
  recommendForMetric,
  scoreBand,
  type AngleKey,
  type ConcernSlug,
  type MetricKey,
  type ScanAnswers,
  type SkinCoachMetrics,
} from "@/lib/skin-coach";
import { Button } from "@/components/ui";

const METRIC_ROWS: { key: MetricKey; label: string; topic: string }[] = [
  { key: "acne", label: "สิว", topic: "สิว" },
  { key: "pores", label: "รูขุมขน", topic: "รูขุมขน" },
  { key: "darkSpots", label: "จุดด่างดำและสีผิว", topic: "จุดด่างดำและสีผิว" },
  { key: "wrinkles", label: "ริ้วรอย", topic: "ริ้วรอย" },
];

// What the person said they worry about, as the metric it corresponds to.
const CONCERN_TO_METRIC: Record<ConcernSlug, MetricKey> = { acne: "acne", "dark-spots": "darkSpots", aging: "wrinkles" };

// Four pips and a word, not a bar to a percent: the model's scores are rough
// reads of a photo, and a level says only as much as they can. Products for
// the metric sit right under it, so each recommendation is read next to the
// finding it answers.
function MetricRow({
  label,
  score,
  note,
  reason,
  products,
  skipped,
}: {
  label: string;
  score: number;
  note: string;
  reason: string | null;
  products: Product[];
  skipped: number;
}) {
  const level = clarityLevel(score);
  const fill = level.tone === "good" ? "bg-brand-action" : level.tone === "fair" ? "bg-amber-400" : "bg-amber-600";
  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-brand-ink">{label}</span>
        <span className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={clsx("h-2 w-5 rounded-full", n <= level.pips ? fill : "bg-surface-line")} />
            ))}
          </span>
          <span
            className={clsx(
              "w-20 text-right text-sm font-semibold",
              level.tone === "good" ? "text-brand-800" : level.tone === "fair" ? "text-amber-700" : "text-amber-800"
            )}
          >
            {level.label}
          </span>
        </span>
      </div>
      {note && <p className="mt-1 text-xs text-slate-600">{note}</p>}

      {products.length > 0 && (
        <div className="mt-3">
          {reason && <p className="text-xs font-semibold text-brand-ink">{reason}</p>}
          {skipped > 0 && (
            <p className="mt-0.5 text-xs text-slate-600">ไม่แสดง {skipped} รายการที่คุณเคยซื้อแล้ว ถ้ายังใช้อยู่ ใช้ต่อได้เลย</p>
          )}
          <div className="scrollbar-none mt-2.5 flex snap-x gap-3 overflow-x-auto pb-2">
            {products.map((p) => (
              <MiniProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export default function ResultsView({
  metrics,
  photo,
  angles,
  answers,
  onRestart,
}: {
  metrics: SkinCoachMetrics;
  photo: string | null;
  angles: AngleKey[];
  answers: ScanAnswers;
  onRestart: () => void;
}) {
  const { openWithProfile } = useQuickChat();
  const history = useScanHistory();
  const { refreshUser } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);
  const [bonus, setBonus] = useState(0);
  // Product handles from this member's past orders, so recommendations skip
  // what they already have. Empty for guests or if orders can't be read.
  const [bought, setBought] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!history.signedIn) return;
    let cancelled = false;
    fetch("/api/account/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { orders?: { cancelledAt?: string | null; items?: { slug: string | null }[] }[] }) => {
        if (cancelled) return;
        const slugs = (data.orders ?? [])
          .filter((o) => !o.cancelledAt)
          .flatMap((o) => o.items ?? [])
          .map((i) => i.slug)
          .filter((s): s is string => Boolean(s));
        setBought(new Set(slugs));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [history.signedIn]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const total = overallScore(metrics);
  const band = scoreBand(total);
  const confidence = confidenceFor(angles.length);
  const comparison = ageComparison(metrics.skinAge.years, answers.ageRange);
  // Products go under the metrics that need care, and under whatever the
  // person said they worry about. When everything reads well, the weakest
  // metric still gets a couple of picks for keeping it that way.
  const preferred = answers.mainConcern ? CONCERN_TO_METRIC[answers.mainConcern] : undefined;
  const needsCare = METRIC_ROWS.filter((m) => clarityLevel(metrics[m.key].score).tone !== "good").map((m) => m.key);
  const weakest = [...METRIC_ROWS].sort((a, b) => metrics[b.key].score - metrics[a.key].score)[0].key;
  const withProducts = new Set<MetricKey>([...needsCare, ...(preferred ? [preferred] : [])]);
  if (withProducts.size === 0) withProducts.add(weakest);

  function reasonFor(key: MetricKey, topic: string) {
    if (key === preferred) return `เพราะคุณบอกว่ากังวลเรื่อง${topic}`;
    const level = clarityLevel(metrics[key].score);
    return level.tone === "good" ? `ดูแลต่อให้${topic}อยู่ในระดับ "${level.label}"` : `แนะนำเพราะ${topic}อยู่ในระดับ "${level.label}"`;
  }
  const angleLabels = angles.map((a) => ANGLES.find((x) => x.key === a)?.label ?? a);
  // The scan to compare against: the latest one saved before this result.
  const previous = history.scans.find((s) => s.id !== saved);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/skin-coach/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skinAge: metrics.skinAge.years,
          metrics: {
            acne: metrics.acne.score,
            pores: metrics.pores.score,
            darkSpots: metrics.darkSpots.score,
            wrinkles: metrics.wrinkles.score,
          },
          angles,
          ...answers,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSaveError(data.error || "บันทึกไม่สำเร็จ ลองอีกครั้ง");
        return;
      }
      setSaved(data.scan.id);
      setBonus(data.bonusPoints ?? 0);
      if (data.bonusPoints) refreshUser();
      history.setScans((prev) => [data.scan, ...prev]);
    } catch {
      setSaveError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  function askAdvisor() {
    const info = METRIC_ROWS.filter((m) => withProducts.has(m.key)).map((m) => m.topic).join(", ");
    openWithProfile({
      scan: `อายุผิวประมาณ ${metrics.skinAge.years} ปี, ภาพรวม${band.label}`,
      concern: info || "สุขภาพผิวโดยรวม",
    });
  }

  return (
    <div>
      {/* The headline is the skin age — the one number people come back to
          compare — in large type, with what it's based on right beside it. */}
      <section className="rounded-xl2 border border-surface-line p-5 sm:p-7">
        <div className="flex items-start gap-4 sm:gap-6">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="รูปที่ใช้สแกน"
              width={96}
              height={120}
              className="h-24 w-[4.8rem] shrink-0 rounded-lg object-cover sm:h-32 sm:w-[6.4rem]"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm text-slate-600">อายุผิวโดยประมาณ</p>
            <p className="mt-0.5 text-6xl font-extrabold leading-none text-brand-ink tabular-nums sm:text-7xl">
              {metrics.skinAge.years}
              <span className="ml-1.5 text-2xl font-bold sm:text-3xl">ปี</span>
            </p>
            {comparison && <p className="mt-2 text-sm font-semibold text-brand-800">{comparison}</p>}
            <p className="mt-1 text-sm text-slate-600">{metrics.skinAge.note}</p>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-600">
          ความละเอียดของผล: <span className="font-semibold text-brand-ink">{confidence.label}</span> · จาก{" "}
          {angleLabels.join(", ")}
        </p>

        {previous && (
          <div className="mt-4 rounded-xl bg-surface-mist px-4 py-3 text-sm">
            <span className="text-slate-600">
              ครั้งก่อน ({formatScanDate(previous.scanned_at)}) อายุผิว {previous.skin_age} ปี →{" "}
            </span>
            <span className="font-semibold text-brand-ink">
              ครั้งนี้ {metrics.skinAge.years} ปี
            </span>
            <span className="text-slate-600"> ห่างกัน {gapBetween(previous.scanned_at, new Date().toISOString())}</span>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl2 border border-surface-line p-5 sm:p-7">
        <h2 className="text-base font-bold text-brand-ink">
          ภาพรวม: <span className="text-brand-800">{band.label}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-600">{metrics.overallNote}</p>
        <ul className="mt-2 divide-y divide-surface-line">
          {METRIC_ROWS.map((m) => {
            const show = withProducts.has(m.key);
            return (
              <MetricRow
                key={m.key}
                label={m.label}
                score={metrics[m.key].score}
                note={metrics[m.key].note}
                reason={show ? reasonFor(m.key, m.topic) : null}
                products={show ? recommendForMetric(m.key, 3, bought) : []}
                skipped={show ? boughtCountForMetric(m.key, bought) : 0}
              />
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button size="none" className="gap-1.5 px-4 py-2.5 text-sm" onClick={askAdvisor}>
            <MessageCircle size={15} aria-hidden="true" /> ถามน้อง Smoothie เรื่องผลนี้
          </Button>
          {photo && <ShareCard metrics={metrics} photoDataUrl={photo} zones={angleLabels} />}
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-soft p-3.5 text-xs text-slate-600">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {metrics.disclaimer}
        </p>
      </section>

      {/* Saving is a choice made per scan: the consent page promises nothing
          is kept unless the member asks, and then only these numbers. */}
      <section className="mt-5 rounded-xl2 border border-surface-line p-5 sm:p-7">
        <h2 className="text-base font-bold text-brand-ink">ติดตามผิวของคุณ</h2>
        {!history.signedIn ? (
          <p className="mt-1 text-sm text-slate-600">
            <Link href="/account/login?returnTo=/skin-coach" className="font-semibold text-brand-800 underline">
              เข้าสู่ระบบ
            </Link>{" "}
            เพื่อบันทึกผลนี้ แล้วสแกนซ้ำใน 4–6 สัปดาห์เพื่อดูว่าผิวเปลี่ยนไปอย่างไร
          </p>
        ) : saved ? (
          <p className="mt-1 text-sm text-brand-800">
            บันทึกแล้ว{bonus > 0 && ` · ได้รับ +${bonus} คะแนนจากการสแกนครบ ${angles.length} มุม`} เราจะเตือนให้สแกนอีกครั้งใน 6 สัปดาห์
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              เก็บเฉพาะตัวเลขผลสแกนไว้ในบัญชี ไม่เก็บรูป ลบได้ทุกเมื่อ
            </p>
            {saveError && <p className="mt-2 text-sm text-rose-700">{saveError}</p>}
            <Button className="mt-3" onClick={save} loading={saving}>
              บันทึกผลนี้
            </Button>
          </>
        )}
        {history.scans.length > 0 && (
          <div className="mt-4 border-t border-surface-line pt-2">
            <ScanHistory
              scans={history.scans}
              onDeleted={(id) => {
                history.setScans((prev) => prev.filter((s) => s.id !== id));
                if (id === saved) setSaved(null);
              }}
            />
          </div>
        )}
      </section>

      <div className="mt-5">
        <RewardClaim score={total} />
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto mt-8 flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-600 hover:text-brand-ink"
      >
        <RotateCcw size={15} aria-hidden="true" />
        สแกนใหม่อีกครั้ง
      </button>
    </div>
  );
}
