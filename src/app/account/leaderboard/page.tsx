"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, Award, Medal } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/lib/auth-context";

type Entry = { rank: number; userId: string; name: string; points: number; isYou: boolean };
type LeaderboardResponse = { ok: boolean; entries: Entry[]; you: { rank: number; points: number } | null; error?: string };

const medalStyle: Record<number, string> = {
  1: "bg-amber-400 text-white",
  2: "bg-slate-300 text-white",
  3: "bg-amber-700 text-white",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${medalStyle[rank]}`}>
        <Medal size={14} />
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-soft text-sm font-bold text-slate-500">
      {rank}
    </span>
  );
}

function LeaderboardContent() {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!data.ok) {
    return <p className="text-sm text-rose-500">{data.error || "โหลดอันดับไม่สำเร็จค่ะ"}</p>;
  }

  const youInTop = data.entries.some((e) => e.isYou);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-1 flex items-center gap-2">
        <Trophy size={22} className="text-amber-500" /> อันดับสมาชิก
      </h1>
      <p className="text-sm text-slate-500 mb-6">จัดอันดับจากคะแนนสะสมทั้งหมด — Top 15</p>

      <div className="rounded-xl2 border border-slate-100 shadow-card overflow-hidden">
        {data.entries.map((e) => (
          <div
            key={e.userId}
            className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${
              e.isYou ? "bg-brand-gradient-soft" : ""
            }`}
          >
            <RankBadge rank={e.rank} />
            <span className={`flex-1 text-sm ${e.isYou ? "font-bold text-brand-ink" : "text-slate-700"}`}>
              {e.name} {e.isYou && <span className="text-xs text-brand-emerald font-semibold">(คุณ)</span>}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-brand-ink">
              <Award size={14} className="text-amber-500" /> {e.points.toLocaleString()}
            </span>
          </div>
        ))}
        {data.entries.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลอันดับค่ะ</p>
        )}
      </div>

      {!youInTop && data.you && (
        <div className="mt-4 rounded-xl2 border border-brand-teal bg-brand-gradient-soft px-4 py-3 flex items-center gap-3">
          <RankBadge rank={data.you.rank} />
          <span className="flex-1 text-sm font-bold text-brand-ink">อันดับของคุณ</span>
          <span className="flex items-center gap-1 text-sm font-bold text-brand-ink">
            <Award size={14} className="text-amber-500" /> {data.you.points.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AccountLayout>
      <LeaderboardContent />
    </AccountLayout>
  );
}
