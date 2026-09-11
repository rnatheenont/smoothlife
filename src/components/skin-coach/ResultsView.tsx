"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Info, MessageCircle, RotateCcw } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useQuickChat } from "@/lib/quickchat-context";
import ShareCard from "@/components/skin-coach/ShareCard";
import RewardClaim from "@/components/skin-coach/RewardClaim";
import ScanHistory, { formatScanDate, gapBetween, useScanHistory } from "@/components/skin-coach/ScanHistory";
import {
  ANGLES,
  ageComparison,
  clarityLevel,
  concernLabel,
  concernReason,
  confidenceFor,
  overallScore,
  productsForConcern,
  scoreBand,
  topConcerns,
  type AngleKey,
  type ScanAnswers,
  type SkinCoachMetrics,
} from "@/lib/skin-coach";
import { Button } from "@/components/ui";

// Four pips and a word, not a bar to a percent: the model's scores are rough
// reads of a photo, and a level says only as much as they can.
function MetricRow({ label, score, note }: { label: string; score: number; note: string }) {
  const level = clarityLevel(score);
  const fill = level.tone === "good" ? "bg-brand-action" : level.tone === "fair" ? "bg-amber-400" : "bg-amber-600";
  return (
    <li className="py-3.5">
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
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const total = overallScore(metrics);
  const band = scoreBand(total);
  const confidence = confidenceFor(angles.length);
  const comparison = ageComparison(metrics.skinAge.years, answers.ageRange);
  const concerns = topConcerns(metrics, 2, answers.mainConcern);
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
      history.setScans((prev) => [data.scan, ...prev]);
    } catch {
      setSaveError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  function askAdvisor() {
    const info = concerns.map((slug) => concernLabel(slug)?.nameTh).filter(Boolean).join(", ");
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
          <MetricRow label="สิว" score={metrics.acne.score} note={metrics.acne.note} />
          <MetricRow label="รูขุมขน" score={metrics.pores.score} note={metrics.pores.note} />
          <MetricRow label="จุดด่างดำและสีผิว" score={metrics.darkSpots.score} note={metrics.darkSpots.note} />
          <MetricRow label="ริ้วรอย" score={metrics.wrinkles.score} note={metrics.wrinkles.note} />
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
          <p className="mt-1 text-sm text-brand-800">บันทึกแล้ว สแกนอีกครั้งใน 4–6 สัปดาห์เพื่อเทียบผล</p>
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

      {/* Why before what: each group opens with the reason it's here, then
          the products — never a price or a discount leading. */}
      <div className="mt-8 space-y-8">
        {concerns.map((slug) => {
          const info = concernLabel(slug);
          const items = productsForConcern(slug, 3);
          if (!info || items.length === 0) return null;
          return (
            <section key={slug}>
              <h2 className="text-lg font-bold text-brand-ink">สำหรับ{info.nameTh}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {concernReason(slug, metrics, answers.mainConcern)} {info.description}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {items.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </section>
          );
        })}
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
