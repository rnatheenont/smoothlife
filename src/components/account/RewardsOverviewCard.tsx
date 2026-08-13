"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tierBadge, tierCard } from "@/lib/tier";

type DayInfo = { date: string; dayNumber: number; status: string };
type StatusResponse = {
  checkedInToday?: boolean;
  cycle: null | { completedDays: number; targetDays: number; dates: DayInfo[]; status: string };
  recovery: { pointBalance: number };
};

const dotStyle: Record<string, string> = {
  normal: "bg-brand-gradient text-white",
  recovery: "bg-brand-gradient text-white",
  today: "border-2 border-brand-emerald text-brand-emerald bg-white",
  recoverable: "bg-amber-100 text-amber-700 border border-amber-300",
  missed: "bg-slate-100 text-slate-400",
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
    load();
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

  return (
    <div className="rounded-2xl overflow-hidden shadow-cardHover">
      {/* Card face */}
      <div className="relative p-5 md:p-6 text-white" style={{ background: card.gradient }}>
        <div
          className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full"
          style={{ background: card.shine }}
        />
        <div
          className="pointer-events-none absolute -right-4 top-16 h-20 w-20 rounded-full"
          style={{ background: card.shine }}
        />

        <div className="relative flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Smooth Life Membership</p>
            <p className="text-lg font-extrabold">
              Smoothlife<span className="opacity-80">.com</span>
            </p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
            <TierIcon size={20} />
          </div>
        </div>

        <p className="relative text-xl md:text-2xl font-bold truncate mb-0.5">{user.name}</p>
        <p className="relative text-[11px] text-white/70 mb-5">สมาชิกตั้งแต่ {formatThaiDate(user.createdAt)}</p>

        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">เลขสมาชิก</p>
            <p className="font-mono text-sm tracking-widest">{formatMemberId(user.id)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">{user.tier} Member</p>
            <p className="text-xl font-extrabold">Lv.{badge.level}</p>
          </div>
        </div>
      </div>

      {/* Points + check-in panel */}
      <div className="bg-white p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">แต้มสะสมของคุณ</p>
            <p className="text-2xl font-bold text-brand-ink">
              {loading ? "…" : pointBalance.toLocaleString()}{" "}
              <span className="text-sm font-medium text-slate-400">แต้ม</span>
            </p>
          </div>
          <Link href="/account/points" className="flex items-center gap-0.5 text-xs font-semibold text-brand-emerald">
            ดูทั้งหมด <ChevronRight size={12} />
          </Link>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2.5 gap-3">
            <Link href="/account/checkin" className="text-sm font-semibold text-brand-ink hover:text-brand-emerald">
              เช็กอินรายวัน{data?.cycle ? ` — ${data.cycle.completedDays}/${data.cycle.targetDays} วัน` : ""}
            </Link>
            {!loading &&
              (data?.checkedInToday ? (
                <span className="flex items-center gap-1 shrink-0 text-xs font-semibold text-brand-emerald">
                  <CheckCircle2 size={13} /> เช็กอินแล้ว
                </span>
              ) : (
                <button
                  onClick={doCheckin}
                  disabled={busy}
                  className="shrink-0 rounded-full bg-brand-gradient text-white font-bold px-3.5 py-1.5 text-xs disabled:opacity-60"
                >
                  {busy ? "..." : "เช็กอินวันนี้"}
                </button>
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
            <Link href="/account/checkin" className="mt-2 block text-xs font-semibold text-amber-600 hover:underline">
              มีวันที่พลาด — กู้คืนได้ →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
