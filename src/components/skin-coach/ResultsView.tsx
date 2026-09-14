"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Info, MessageCircle, RotateCcw } from "lucide-react";
import MiniProductCard from "@/components/skin-coach/MiniProductCard";
import { useQuickChat } from "@/lib/quickchat-context";
import { useAuth } from "@/lib/auth-context";
import ShareCard from "@/components/skin-coach/ShareCard";
import RewardClaim from "@/components/skin-coach/RewardClaim";
import ScanHistory, { formatScanDate, gapBetween, useScanHistory } from "@/components/skin-coach/ScanHistory";
import FaceMap from "@/components/skin-coach/FaceMap";
import ScoreChips from "@/components/skin-coach/ScoreChips";
import RadarChart from "@/components/skin-coach/RadarChart";
import SkinProgress from "@/components/skin-coach/SkinProgress";
import {
  CONCERN_DEFS,
  CONCERN_KEYS,
  ZONE_LABEL,
  concernScore,
  healthBand,
  skinHealth,
  type ConcernMetric,
  type ZoneKey,
} from "@/lib/skin-analysis";
import {
  ANGLES,
  ageComparison,
  clarityLevel,
  confidenceFor,
  overallScore,
  scoreBand,
  type AngleKey,
  CONCERNS,
  SKIN_TYPES,
  type ConcernKey,
  type MetricKey,
  type ScanAnswers,
  type SkinCoachMetrics,
} from "@/lib/skin-coach";
import { PRODUCT_TYPE_LABEL, boughtCountFor, recommendFor, type Pick as RecPick } from "@/lib/skin-recommend";
import { Button } from "@/components/ui";

// What each "เรื่องที่กังวล" choice asks the product picker for.
const NAMED_TO_CONCERN: Record<ConcernKey, ConcernMetric> = {
  acne: "acne",
  acneMarks: "spots",
  pores: "pores",
  oiliness: "oiliness",
  darkSpots: "spots",
  dullness: "radiance",
  wrinkles: "wrinkles",
  firmness: "firmness",
  dryness: "moisture",
  sensitive: "redness",
};

// Older results carry only four scores; each still maps to one concern.
const METRIC_ROWS: { key: MetricKey; concern: ConcernMetric; label: string }[] = [
  { key: "acne", concern: "acne", label: "สิว" },
  { key: "pores", concern: "pores", label: "รูขุมขน" },
  { key: "darkSpots", concern: "spots", label: "จุดด่างดำและสีผิว" },
  { key: "wrinkles", concern: "wrinkles", label: "ริ้วรอย" },
];

// At most this many care rows, so the page stays about the few things that matter most.
const MAX_ROWS = 5;

type CareRow = {
  concern: ConcernMetric;
  label: string;
  /** Severity 0-100 (higher = worse); null when a photo can't measure it. */
  severity: number | null;
  note: string;
  reason: string | null;
  picks: RecPick[];
  skipped: number;
};

// Four pips and a word, not a bar to a percent: the model's scores are rough
// reads of a photo, and a level says only as much as they can. Products for
// the concern sit right under it, so each recommendation is read next to the
// finding it answers.
function MetricRow({ row }: { row: CareRow }) {
  const level = row.severity === null ? null : clarityLevel(row.severity);
  const fill = !level ? "" : level.tone === "good" ? "bg-brand-action" : level.tone === "fair" ? "bg-amber-400" : "bg-amber-600";
  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-brand-ink">{row.label}</span>
        {level && (
          <span className="flex items-center gap-2.5">
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={clsx("h-2 w-5 rounded-full", n <= level.pips ? fill : "bg-surface-line")} />
              ))}
            </span>
            <span
              className={clsx(
                "w-24 text-right text-sm font-semibold",
                level.tone === "good" ? "text-brand-800" : level.tone === "fair" ? "text-amber-700" : "text-amber-800"
              )}
            >
              {level.label}
            </span>
          </span>
        )}
      </div>
      {row.note && <p className="mt-1 text-xs text-slate-600">{row.note}</p>}

      {row.picks.length > 0 && (
        <div className="mt-3">
          {row.reason && <p className="text-xs font-semibold text-brand-ink">{row.reason}</p>}
          {row.skipped > 0 && (
            <p className="mt-0.5 text-xs text-slate-600">ไม่แสดง {row.skipped} รายการที่คุณเคยซื้อแล้ว ถ้ายังใช้อยู่ ใช้ต่อได้เลย</p>
          )}
          <div className="scrollbar-none mt-2.5 flex snap-x gap-3 overflow-x-auto pb-2">
            {row.picks.map((r) => (
              <MiniProductCard key={r.product.slug} product={r.product} typeLabel={PRODUCT_TYPE_LABEL[r.type]} />
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
  const [focus, setFocus] = useState<ConcernMetric | "all">("all");
  const [keepPhoto, setKeepPhoto] = useState(false);

  const concerns12 = metrics.concerns ?? null;
  const health = concerns12 ? skinHealth(concerns12) : null;
  const total = health ?? overallScore(metrics);
  const band = scoreBand(total);
  const confidence = confidenceFor(angles.length);
  const comparison = ageComparison(metrics.skinAge.years, answers.ageRange);
  const skinTypes = answers.skinTypes ?? [];
  // The concern each "เรื่องที่กังวล" choice points at, with the words the person picked.
  const named = new Map<ConcernMetric, string[]>();
  for (const k of answers.concerns ?? []) {
    const c = CONCERNS.find((x) => x.key === k);
    if (!c) continue;
    const m = NAMED_TO_CONCERN[c.key];
    named.set(m, [...(named.get(m) ?? []), c.label]);
  }

  // Care rows, most important first: what the person named, then scores that
  // need care, worst first. With every score fine and nothing named, the
  // weakest one still gets a row. Same result, same rows, same order.
  type RowSeed = Omit<CareRow, "picks" | "skipped" | "reason"> & { withPicks: boolean };
  const seeds: RowSeed[] = [];
  if (concerns12) {
    const bySeverity = [...CONCERN_KEYS].sort((x, y) => concerns12[y].severity - concerns12[x].severity);
    const order: ConcernMetric[] = [
      ...named.keys(),
      ...bySeverity.filter((k) => concernScore(concerns12[k].severity) < 70 && !named.has(k)),
    ];
    if (order.length === 0) order.push(bySeverity[0]);
    for (const k of order.slice(0, Math.max(MAX_ROWS, named.size))) {
      seeds.push({ concern: k, label: CONCERN_DEFS[k].label, severity: concerns12[k].severity, note: concerns12[k].note, withPicks: true });
    }
  } else {
    const care = METRIC_ROWS.filter((m) => clarityLevel(metrics[m.key].score).tone !== "good" || named.has(m.concern));
    const weakest = [...METRIC_ROWS].sort((x, y) => metrics[y.key].score - metrics[x.key].score)[0];
    for (const m of METRIC_ROWS) {
      const withPicks = care.includes(m) || (care.length === 0 && named.size === 0 && m === weakest);
      seeds.push({ concern: m.concern, label: m.label, severity: metrics[m.key].score, note: metrics[m.key].note, withPicks });
    }
    for (const [k, labels] of named) {
      if (METRIC_ROWS.some((m) => m.concern === k)) continue;
      seeds.push({
        concern: k,
        label: labels.join(" / "),
        severity: null,
        note: "รูปถ่ายวัดเรื่องนี้ไม่ได้ เราเลือกสินค้าจากที่คุณบอกว่ากังวล",
        withPicks: true,
      });
    }
  }

  // One product, one finding: rows fill in page order and a pick already
  // shown above is skipped below, so no tube appears twice. Products from
  // past orders are left out.
  const rows: CareRow[] = [];
  {
    const shown = new Set<string>(bought);
    for (const { withPicks, ...s } of seeds) {
      const picks = withPicks ? recommendFor(s.concern, { max: 3, exclude: shown, skinTypes }) : [];
      picks.forEach((r) => shown.add(r.product.slug));
      const level = s.severity === null ? null : clarityLevel(s.severity);
      const names = named.get(s.concern);
      const reason = !withPicks
        ? null
        : names?.length
          ? `เพราะคุณบอกว่ากังวลเรื่อง${names.join(" และ ")}`
          : level
            ? level.tone === "good"
              ? `ดูแลต่อให้${s.label}อยู่ในระดับ "${level.label}"`
              : `แนะนำเพราะ${s.label}อยู่ในระดับ "${level.label}"`
            : null;
      rows.push({ ...s, reason, picks, skipped: withPicks ? boughtCountFor(s.concern, bought) : 0 });
    }
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
          concerns12,
          photoConsent: keepPhoto && Boolean(photo),
          photo: keepPhoto ? photo : undefined,
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
      history.setScans((prev) => (prev.some((x) => x.id === data.scan.id) ? prev : [data.scan, ...prev]));
    } catch {
      setSaveError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  function askAdvisor() {
    const topics = [
      ...rows.filter((r) => r.picks.length > 0 || named.has(r.concern)).map((r) => r.label),
      ...skinTypes.map((t) => SKIN_TYPES.find((x) => x.key === t)?.label ?? t),
    ];
    openWithProfile({
      scan: `อายุผิวประมาณ ${metrics.skinAge.years} ปี, ภาพรวม${band.label}`,
      concern: Array.from(new Set(topics)).join(", ") || "สุขภาพผิวโดยรวม",
    });
  }

  return (
    <div>
      {concerns12 && photo && health !== null ? (
        <>
          {/* The map is the headline: the person's own face, shaded where
              each concern shows, with a ring per concern to switch it. */}
          <section className="rounded-xl2 border border-surface-line p-4 sm:p-6">
            <h2 className="text-base font-bold text-brand-ink">แผนที่ผิวของคุณ</h2>
            <p className="mt-0.5 text-xs text-slate-600">แตะคะแนนแต่ละด้านเพื่อดูว่าเห็นตรงบริเวณไหน</p>
            <div className="mx-auto mt-3 max-w-sm">
              <FaceMap photo={photo} concerns={concerns12} selected={focus} />
            </div>
            <div className="mt-3">
              <ScoreChips concerns={concerns12} health={health} selected={focus} onSelect={setFocus} />
            </div>
            <div className="mt-3 rounded-xl bg-surface-mist p-4">
              {focus === "all" ? (
                <>
                  <p className="text-sm font-semibold text-brand-ink">
                    ภาพรวม {health} คะแนน · <span style={{ color: healthBand(health).color }}>{healthBand(health).label}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{metrics.overallNote}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-brand-ink">
                    {CONCERN_DEFS[focus].label} {concernScore(concerns12[focus].severity)} คะแนน ·{" "}
                    {clarityLevel(concerns12[focus].severity).label}
                  </p>
                  {concerns12[focus].note && <p className="mt-1 text-sm text-slate-600">{concerns12[focus].note}</p>}
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.entries(concerns12[focus].zones) as [ZoneKey, number][]).map(([zone, sev]) => (
                      <span key={zone} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700">
                        {ZONE_LABEL[zone]}
                        {zone.endsWith("Left") ? " (ซ้ายภาพ)" : zone.endsWith("Right") ? " (ขวาภาพ)" : ""}{" "}
                        <span className="font-semibold tabular-nums">{concernScore(sev)}</span>
                      </span>
                    ))}
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="mt-5 rounded-xl2 border border-surface-line p-5 sm:p-7">
            <h2 className="text-base font-bold text-brand-ink">รายงานผิว (Skin Report)</h2>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-600">คะแนนสุขภาพผิว</p>
                <p className="text-6xl font-extrabold leading-none text-brand-ink tabular-nums">
                  {health}
                  <span className="ml-1 text-xl font-bold text-slate-500">/100</span>
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: healthBand(health).color }}>
                  {healthBand(health).label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">อายุผิว</p>
                <p className="text-4xl font-extrabold leading-none text-brand-ink tabular-nums">
                  {metrics.skinAge.years}
                  <span className="ml-1 text-base font-bold">ปี</span>
                </p>
              </div>
            </div>
            {/* Where the score sits on the scale. */}
            <div className="relative mt-4 h-2.5 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-500" aria-hidden="true">
              <span
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-brand-ink shadow"
                style={{ left: `${health}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500" aria-hidden="true">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
            {comparison && <p className="mt-3 text-sm font-semibold text-brand-800">{comparison}</p>}
            <p className="mt-1 text-sm text-slate-600">{metrics.skinAge.note}</p>
            {metrics.advice && (
              <p className="mt-4 rounded-xl bg-surface-mist p-4 text-sm text-slate-700">
                <span className="font-semibold text-brand-ink">คำแนะนำการดูแล: </span>
                {metrics.advice}
              </p>
            )}
            <div className="mt-5">
              <RadarChart concerns={concerns12} previous={history.scans.find((x) => x.id !== saved && x.concerns)?.concerns ?? null} />
              {history.scans.some((x) => x.id !== saved && x.concerns) && (
                <p className="text-center text-[11px] text-slate-500">เส้นประ = ผลที่บันทึกครั้งก่อน</p>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-600">
              ความละเอียดของผล: <span className="font-semibold text-brand-ink">{confidence.label}</span> · จาก {angleLabels.join(", ")}
            </p>
            {previous && (
              <p className="mt-2 rounded-xl bg-surface-soft px-4 py-3 text-sm text-slate-600">
                ครั้งก่อน ({formatScanDate(previous.scanned_at)})
                {previous.skin_health !== null && ` ภาพรวม ${previous.skin_health}`} อายุผิว {previous.skin_age} ปี →{" "}
                <span className="font-semibold text-brand-ink">
                  ครั้งนี้ ภาพรวม {health} อายุผิว {metrics.skinAge.years} ปี
                </span>{" "}
                ห่างกัน {gapBetween(previous.scanned_at, new Date().toISOString())}
              </p>
            )}
          </section>
        </>
      ) : (
      // Without the twelve-concern result (or a photo), the headline is the
      // skin age, in large type, with what it's based on beside it.
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
      )}

      <section className="mt-5 rounded-xl2 border border-surface-line p-5 sm:p-7">
        {concerns12 ? (
          <>
            <h2 className="text-base font-bold text-brand-ink">สิ่งที่ควรดูแลและสินค้าแนะนำ</h2>
            <p className="mt-1 text-sm text-slate-600">คัดสินค้าให้ตรงกับด้านที่คะแนนต่ำ และเรื่องที่คุณบอกว่ากังวล</p>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold text-brand-ink">
              ภาพรวม: <span className="text-brand-800">{band.label}</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">{metrics.overallNote}</p>
          </>
        )}
        <ul className="mt-2 divide-y divide-surface-line">
          {rows
            .filter((r) => r.severity !== null || r.picks.length > 0)
            .map((r) => (
              <MetricRow key={r.concern} row={r} />
            ))}
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
              เก็บตัวเลขผลสแกนไว้ในบัญชี ลบได้ทุกเมื่อ
            </p>
            {photo && (
              // A separate, unticked-by-default consent: keeping the face
              // photo is what before/after needs, and nothing else does.
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-surface-line p-3">
                <input
                  type="checkbox"
                  checked={keepPhoto}
                  onChange={(e) => setKeepPhoto(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-emerald"
                />
                <span className="text-sm text-slate-700">
                  เก็บรูปหน้าตรงไว้เทียบก่อน-หลัง
                  <span className="block text-xs text-slate-600">
                    ไม่บังคับ เก็บในที่ส่วนตัว เห็นเฉพาะคุณ ทีมงานไม่เห็นรูป และลบรูปได้ทุกเมื่อ
                  </span>
                </span>
              </label>
            )}
            {saveError && <p className="mt-2 text-sm text-rose-700">{saveError}</p>}
            <Button className="mt-3" onClick={save} loading={saving}>
              บันทึกผลนี้
            </Button>
          </>
        )}
        {history.scans.length > 0 && (
          <div className="mt-5 border-t border-surface-line pt-4">
            <SkinProgress
              scans={history.scans}
              onPhotosRemoved={() => history.setScans((prev) => prev.map((x) => ({ ...x, photo_url: null })))}
            />
          </div>
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
