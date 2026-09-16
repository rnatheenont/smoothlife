"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tierBadge, tierCard, tierDisplayName, tierPerks } from "@/lib/tier";
import { TIER_CRITERIA } from "@/lib/loyalty-shared";
import type { Tier } from "@/lib/auth-context";
import { DAILY_CHECKIN_ENABLED, REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";
import { loyaltyTierProgress } from "@/lib/loyalty-shared";
import { formatTHB } from "@/lib/format";
import { Avatar, Button } from "@/components/ui";

type DayInfo = { date: string; dayNumber: number; status: string };
type StatusResponse = {
  checkedInToday?: boolean;
  cycle: null | { completedDays: number; targetDays: number; dates: DayInfo[]; status: string };
  recovery: { pointBalance: number };
};

const dotStyle: Record<string, string> = {
  normal: "bg-brand-gradient text-white",
  recovery: "bg-brand-gradient text-white",
  today: "border-2 border-brand-emerald text-brand-800 bg-white",
  recoverable: "bg-amber-100 text-amber-700 border border-amber-300",
  missed: "bg-slate-100 text-slate-500",
  upcoming: "bg-slate-50 text-slate-300 border border-dashed border-slate-200",
};

// Real user id, just grouped like a card number — not a fabricated "member
// number" system, this is their actual account id.
function formatMemberId(id: string) {
  const clean = id.replace(/-/g, "").toUpperCase().slice(0, 12);
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

// Combines points balance/tier and daily check-in progress into one glanceable
// dashboard card, styled as an actual membership card (tier-toned gradient,
// member name/number/since) — previously two separate small shortcut tiles
// that hid both the real balance and today's actual check-in action.
export default function RewardsOverviewCard() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/checkin");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (REWARDS_ACTIVITIES_ENABLED) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doCheckin() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        await load();
        refreshUser();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  const badge = tierBadge[user.tier];
  const card = tierCard[user.tier];
  const TierIcon = badge.icon;
  const pointBalance = data?.recovery.pointBalance ?? user.points;
  const spend = user.tierSpend ?? 0;
  const progress = loyaltyTierProgress(spend, user.tierOrders ?? 0);
  const topThreshold = TIER_CRITERIA[TIER_CRITERIA.length - 1].minSpend;
  const nextThreshold = TIER_CRITERIA.find((t) => t.name === progress.next)?.minSpend ?? topThreshold;
  const nextPerk = progress.next ? tierPerks[progress.next as Tier]?.[0] : null;
  // Position along the whole ladder rather than within one segment: the point
  // of the bar is to show where they stand overall, and a segment-relative
  // bar jumps backwards to near-zero every time someone levels up.
  const ladderPercent = Math.min(100, Math.round((spend / topThreshold) * 100));

  return (
    <div className="rounded-2xl overflow-hidden shadow-cardHover">
      {/* Card face — read like a real membership card: what it is, who it
          belongs to, and the two facts staff would ask for (tier and member
          number). The old face also carried a "Lv.1" badge, which said the
          same thing as the tier name twice and fought it for attention. */}
      <div className="relative overflow-hidden p-5 md:p-6 text-white" style={{ background: card.gradient }}>
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full"
          style={{ background: card.shine }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-2 h-28 w-28 rounded-full"
          style={{ background: card.shine }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Smooth Life Membership</p>
            <p className="mt-0.5 text-lg font-extrabold">
              Smoothlife<span className="opacity-80">.com</span>
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] backdrop-blur">
            <TierIcon size={13} />
            {tierDisplayName[user.tier].en}
          </span>
        </div>

        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/70 backdrop-blur">
              <Avatar src={user.avatar} name={user.name} className="h-12 w-12" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold md:text-2xl">{user.name}</p>
              <p className="mt-0.5 font-mono text-[11px] tracking-[0.18em] text-white/75">{formatMemberId(user.id)}</p>
            </div>
          </div>
          <p className="shrink-0 text-right text-[11px] leading-tight text-white/75">
            สมาชิกตั้งแต่
            <br />
            <span className="font-semibold text-white/90">{formatThaiDate(user.createdAt)}</span>
          </p>
        </div>
      </div>

      {/* Points + check-in panel — hidden while กิจกรรมและรางวัล is off */}
      {REWARDS_ACTIVITIES_ENABLED && (
      <div className="bg-white p-4 md:p-5">
        {/* Points and tier progress in one compact block: the balance, one bar,
            and the single sentence that says what the bar is for. The old
            version spent half a phone screen on a three-rung ladder diagram to
            say the same thing. */}
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold leading-none text-brand-ink">
              {loading ? "…" : pointBalance.toLocaleString()}
            </span>
            <span className="text-sm text-slate-500">แต้มสะสม</span>
          </p>
          <Link href="/account/points" className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-800">
            ดูทั้งหมด <ChevronRight size={12} />
          </Link>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-brand-ink">
              <TierIcon size={13} style={{ color: card.accent }} />
              ระดับ {tierDisplayName[user.tier].en}
            </span>
            <span className="tabular-nums text-slate-500">
              {formatTHB(spend)}
              {progress.next ? ` / ${formatTHB(nextThreshold)}` : ""}
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{ width: `${Math.max(ladderPercent, 2)}%`, background: card.gradient }}
            />
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {progress.next ? (
              <>
                อีก <span className="font-bold text-brand-800">{formatTHB(progress.remaining)}</span> ขึ้นระดับ{" "}
                <span className="font-bold text-brand-ink">{tierDisplayName[progress.next as Tier].en}</span>
                {nextPerk ? ` · ${nextPerk}` : ""}
              </>
            ) : (
              "คุณอยู่ระดับสูงสุดแล้ว ขอบคุณที่อยู่กับเรานะคะ"
            )}
          </p>
        </div>

        {DAILY_CHECKIN_ENABLED && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2.5 gap-3">
            <Link href="/account/checkin" className="text-sm font-semibold text-brand-ink hover:text-brand-800">
              เช็กอินรายวัน{data?.cycle ? ` — ${data.cycle.completedDays}/${data.cycle.targetDays} วัน` : ""}
            </Link>
            {!loading &&
              (data?.checkedInToday ? (
                <span className="flex items-center gap-1 shrink-0 text-xs font-semibold text-brand-800">
                  <CheckCircle2 size={13} /> เช็กอินแล้ว
                </span>
              ) : (
                <Button size="none" className="px-3.5 py-1.5 text-xs shrink-0" onClick={doCheckin} disabled={busy}>
                  {busy ? "…" : "เช็กอินวันนี้"}
                </Button>
              ))}
          </div>

          {data?.cycle && (
            <div className="flex gap-1.5">
              {data.cycle.dates.map((d) => (
                <span
                  key={d.date}
                  className={`grid h-6 w-6 flex-1 place-items-center rounded-full text-[10px] font-bold ${
                    dotStyle[d.status] || dotStyle.upcoming
                  }`}
                >
                  {d.status === "normal" || d.status === "recovery" ? <CheckCircle2 size={11} /> : d.dayNumber}
                </span>
              ))}
            </div>
          )}

          {data?.cycle?.status === "recovery_available" && (
            <Link href="/account/checkin" className="mt-2 block text-xs font-semibold text-amber-700 hover:underline">
              มีวันที่พลาด — กู้คืนได้ →
            </Link>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
}
