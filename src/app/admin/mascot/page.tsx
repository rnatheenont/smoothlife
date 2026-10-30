"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Check, Shirt } from "lucide-react";
import { Spinner } from "@heroui/react";
import { PageHeader, Panel } from "@/components/admin/layout-kit";
import SmoothieRig from "@/components/mascot/SmoothieRig";
import type { MascotTheme, MascotThemeSetting } from "@/components/mascot/mascot-theme";

// Smoothie's outfit on the storefront. Three choices, each shown wearing what
// the customer would see — clicking one saves it, and the next page load on
// the site uses it. "Auto" follows the seasonal calendar in mascot-theme.ts.

type State = {
  setting: MascotThemeSetting;
  updatedAt: string | null;
  seasonal: MascotTheme;
  seasons: { theme: MascotTheme; from: string; to: string }[];
};

const NAMES: Record<MascotTheme, string> = { default: "ชุดปกติ", halloween: "ฮาโลวีน", christmas: "คริสต์มาส", newyear: "ปีใหม่" };
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const day = (md: string) => {
  const [m, d] = md.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default function MascotAdminPage() {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState<MascotThemeSetting | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/mascot-theme")
      .then((r) => r.json())
      .then((d) => (d.ok ? setState(d) : setError(d.error || "โหลดการตั้งค่าไม่สำเร็จ")))
      .catch(() => setError("โหลดการตั้งค่าไม่สำเร็จ"));
  }, []);

  async function choose(setting: MascotThemeSetting) {
    if (!state || saving || setting === state.setting) return;
    setSaving(setting);
    setSaved(false);
    setError("");
    try {
      const d = await fetch("/api/admin/mascot-theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting }),
      }).then((r) => r.json());
      if (!d.ok) {
        setError(d.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setState(d);
      setSaved(true);
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  }

  const live: MascotTheme | null = state ? (state.setting === "auto" ? state.seasonal : state.setting) : null;
  const seasonsText = state?.seasons.map((s) => `${NAMES[s.theme]} ${day(s.from)}–${day(s.to)}`).join(", ");
  const options: { id: MascotThemeSetting; title: string; detail: string; preview: MascotTheme }[] = state
    ? [
        {
          id: "auto",
          title: "อัตโนมัติตามเทศกาล",
          detail: `${seasonsText} นอกช่วงนั้นใส่ชุดปกติ · วันนี้: ${NAMES[state.seasonal]}`,
          preview: state.seasonal,
        },
        { id: "default", title: NAMES.default, detail: "ใส่ชุดนี้ตลอด ไม่สนวันที่", preview: "default" },
        { id: "halloween", title: NAMES.halloween, detail: "ใส่ชุดนี้ตลอด ไม่สนวันที่", preview: "halloween" },
        { id: "christmas", title: NAMES.christmas, detail: "ใส่ชุดนี้ตลอด ไม่สนวันที่", preview: "christmas" },
        { id: "newyear", title: NAMES.newyear, detail: "ใส่ชุดนี้ตลอด ไม่สนวันที่", preview: "newyear" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shirt size={18} />}
        title="ชุดน้อง Smoothie"
        subtitle="ชุดของมาสคอตบนหน้าร้าน ทั้งหน้าแรก ปุ่มแชท และในแชท"
      />

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Panel
        title={live ? `ลูกค้าเห็นตอนนี้: ${NAMES[live]}` : "กำลังโหลด…"}
        toolbar={
          saved ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-brand-800">
              <Check size={14} /> บันทึกแล้ว — หน้าร้านเปลี่ยนตั้งแต่การเปิดหน้าครั้งถัดไป
            </span>
          ) : null
        }
        padded
      >
        {!state ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div role="radiogroup" aria-label="ชุดของน้อง Smoothie" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {options.map((o) => {
              const on = state.setting === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!saving}
                  onClick={() => choose(o.id)}
                  className={clsx(
                    "relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors disabled:cursor-wait",
                    on ? "border-brand-teal bg-brand-50 ring-2 ring-brand-teal/30" : "border-slate-200 bg-white hover:border-brand-teal/60"
                  )}
                >
                  {on && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand-800 text-white">
                      <Check size={14} />
                    </span>
                  )}
                  {saving === o.id && (
                    <span className="absolute right-2 top-2">
                      <Spinner size="sm" />
                    </span>
                  )}
                  {/* keyed: "auto" changes outfit when the season does */}
                  <SmoothieRig
                    key={o.preview}
                    theme={o.preview}
                    framing="full"
                    className="aspect-[1100/1180] w-full max-w-[160px]"
                    greet={null}
                    idleActions={["wave", "nod"]}
                    idleEvery={12}
                    playOnClick={false}
                    followPointer={false}
                  />
                  <span className="text-sm font-bold text-brand-ink">{o.title}</span>
                  <span className="text-xs leading-relaxed text-slate-500">{o.detail}</span>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
