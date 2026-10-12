"use client";

import { useEffect, useState } from "react";
import { Loader2, Minus, MoveVertical, Pencil, Plus } from "lucide-react";

// "What changed" in the words the form uses.
//
// Shown in two places and for two reasons: beside the version history, where
// somebody is deciding whether to roll back, and in the approval panel,
// where somebody is deciding whether to publish. The second is the one that
// matters — approving a page without being shown what is in it is a rubber
// stamp with a person attached.

type Diff = {
  same: boolean;
  added: { id: string; label: string }[];
  removed: { id: string; label: string }[];
  moved: { id: string; label: string; from: number; to: number }[];
  changed: { id: string; label: string; fields: string[] }[];
};

export default function DiffPanel({
  kind,
  slug,
  from = "published",
  title,
}: {
  kind: string;
  slug: string;
  /** A revision id, or "published" for whatever is live now. */
  from?: string;
  title: string;
}) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [baseline, setBaseline] = useState<{ number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pages/${kind}/${slug}/diff?from=${encodeURIComponent(from)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) throw new Error(data?.error ?? "เทียบเวอร์ชันไม่สำเร็จ");
        setDiff(data.diff);
        setBaseline(data.baseline);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "เทียบเวอร์ชันไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, slug, from]);

  if (error) return <p className="text-[12px] text-rose-600">{error}</p>;
  if (!diff) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-slate-400">
        <Loader2 size={12} className="animate-spin" /> กำลังเทียบ…
      </p>
    );
  }

  if (diff.same) {
    return (
      <p className="text-[12px] text-slate-500">
        {title}: ไม่มีอะไรต่างกัน {baseline ? `(เทียบกับเวอร์ชัน ${baseline.number})` : ""}
      </p>
    );
  }

  const rows: { icon: React.ReactNode; tone: string; text: string }[] = [
    ...diff.added.map((s) => ({
      icon: <Plus size={12} />,
      tone: "text-brand-800",
      text: `เพิ่ม "${s.label}"`,
    })),
    ...diff.removed.map((s) => ({
      icon: <Minus size={12} />,
      tone: "text-rose-600",
      text: `เอา "${s.label}" ออก`,
    })),
    ...diff.moved.map((s) => ({
      icon: <MoveVertical size={12} />,
      tone: "text-slate-600",
      text: `ย้าย "${s.label}" จากลำดับ ${s.from + 1} ไป ${s.to + 1}`,
    })),
    ...diff.changed.map((c) => ({
      icon: <Pencil size={12} />,
      tone: "text-amber-700",
      // The fields by name, because "แก้ไข 3 อย่าง" is a number, not an
      // answer — the point of the list is to be read before approving.
      text: `แก้ "${c.label}": ${c.fields.join(", ")}`,
    })),
  ];

  return (
    <div className="text-[12px] leading-relaxed">
      <p className="font-semibold text-brand-ink">
        {title}
        {baseline ? ` (เทียบกับเวอร์ชัน ${baseline.number})` : " (ยังไม่เคยเผยแพร่ — ทั้งหมดเป็นของใหม่)"}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {rows.map((row, i) => (
          <li key={i} className={`flex items-start gap-1.5 ${row.tone}`}>
            <span className="mt-0.5 shrink-0">{row.icon}</span>
            <span className="min-w-0 flex-1">{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
