import { AGE_RANGES, CONCERNS, SKIN_TYPES, clarityLevel } from "@/lib/skin-coach";

export type AdminSkinScan = {
  id: string;
  scanned_at: string;
  angles: string[];
  skin_age: number;
  age_range: string | null;
  skin_type: string | null;
  main_concern: string | null;
  metrics: { acne: number; pores: number; darkSpots: number; wrinkles: number };
};

const METRICS: [keyof AdminSkinScan["metrics"], string][] = [
  ["acne", "สิว"],
  ["pores", "รูขุมขน"],
  ["darkSpots", "จุดด่างดำ"],
  ["wrinkles", "ริ้วรอย"],
];

// Skin types and concerns are stored comma-joined (several can be chosen).
const label = <T extends { key: string; label: string }>(list: readonly T[], keys: string | null) =>
  (keys ?? "")
    .split(",")
    .map((k) => list.find((x) => x.key === k)?.label)
    .filter(Boolean)
    .join(", ") || null;

/**
 * Saved Skin Coach scans for support staff: newest in full, older ones as a
 * line each with the change in skin age. Shared by the customers page and the
 * chat inbox's customer panel.
 */
export default function SkinScanSummary({ scans, compact = false }: { scans: AdminSkinScan[]; compact?: boolean }) {
  if (scans.length === 0) return <p className="text-xs text-slate-500">ยังไม่มีผลสแกนที่ลูกค้าบันทึกไว้</p>;
  const [latest, ...older] = scans;
  const said = [
    label(AGE_RANGES, latest.age_range) && `อายุ ${label(AGE_RANGES, latest.age_range)}`,
    label(SKIN_TYPES, latest.skin_type),
    label(CONCERNS, latest.main_concern) && `กังวล${label(CONCERNS, latest.main_concern)}`,
  ].filter(Boolean);

  return (
    <div className="text-xs">
      <p className="text-slate-500">
        ล่าสุด {new Date(latest.scanned_at).toLocaleDateString("th-TH")} · {latest.angles.length} มุม
      </p>
      <p className="mt-0.5 font-semibold text-brand-ink">อายุผิวประมาณ {latest.skin_age} ปี</p>
      <div className={compact ? "mt-1.5 space-y-0.5" : "mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5"}>
        {METRICS.map(([key, name]) => (
          <p key={key} className="flex justify-between gap-2 text-slate-600">
            <span>{name}</span>
            <span className="font-semibold">{clarityLevel(latest.metrics[key]).label}</span>
          </p>
        ))}
      </div>
      {said.length > 0 && <p className="mt-1.5 text-slate-500">ลูกค้าบอกว่า: {said.join(" · ")}</p>}
      {older.length > 0 && (
        <ul className="mt-2 border-t border-slate-100 pt-1.5 text-slate-500">
          {older.slice(0, compact ? 3 : 8).map((s, i) => {
            const newer = i === 0 ? latest : older[i - 1];
            const diff = newer.skin_age - s.skin_age;
            return (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{new Date(s.scanned_at).toLocaleDateString("th-TH")}</span>
                <span>
                  {s.skin_age} ปี
                  {diff !== 0 && <span className="ml-1 text-slate-400">(ครั้งถัดไป {diff > 0 ? `+${diff}` : diff})</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
