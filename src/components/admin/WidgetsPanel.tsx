"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sliders, Eye } from "lucide-react";

type WidgetRow = { key: string; label_th: string; enabled: boolean; config: Record<string, unknown> };

const DESCRIPTIONS: Record<string, string> = {
  milestone_bar: "แถบขั้นบันไดแสดงความคืบหน้าของทุกโปร (หน้าตะกร้า, หน้าสินค้า)",
  deal_of_day: "การ์ดดีลวันนี้พร้อมนับถอยหลังจริง (หน้าแรก)",
  tiered_box: "กล่องแสดงระดับรางวัลของโปรแบบขั้นบันได (หน้าตะกร้า)",
  promotion_card: "การ์ดโปรโมชั่นจริงบนหน้าแรก (แทนที่การ์ดตัวอย่าง)",
  promotion_badge: "แบดจ์บนรูปสินค้าที่อยู่ในโปร (หน้ารายการสินค้า)",
  cart_drawer_offer: "โชว์ข้อเสนอในตะกร้าแบบเลื่อน (มุมขวาบน)",
  popup: "ป๊อปอัพแจ้งเตือนเมื่อปลดล็อกของแถมใหม่",
  floating_button: "ปุ่มลอยลากได้ แจ้งเตือนเมื่อมีของแถมให้รับ",
  congrats_bar: "แถบแจ้งเตือนด้านบนเมื่อปลดล็อกของแถม",
  gifts_on_slide_cart: "แสดงรายการของแถมที่ได้รับในตะกร้าแบบเลื่อน",
};

const CONFIG_LABELS: Record<string, string> = {
  headlineTh: "หัวข้อ (ไทย)",
  ctaTh: "ข้อความปุ่ม",
  endsInHours: "รีเซ็ตทุกกี่ชั่วโมง",
  maxCards: "จำนวนการ์ดสูงสุด",
  labelTh: "ข้อความแบดจ์",
  color: "สี",
  autoCloseMs: "ปิดอัตโนมัติหลัง (มิลลิวินาที, 0 = ไม่ปิดเอง)",
  messageTh: "ข้อความ",
  durationMs: "แสดงนานกี่มิลลิวินาที",
};

function PreviewMock({ widgetKey }: { widgetKey: string }) {
  switch (widgetKey) {
    case "milestone_bar":
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${i === 1 ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}>{i}</div>
              {i < 3 && <div className="h-0.5 flex-1 bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>
      );
    case "deal_of_day":
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
          <p className="text-[10px] font-bold text-brand-ink">ดีลวันนี้ รับของแถมได้เลย</p>
          <p className="text-xs font-bold mt-1">23:59:59</p>
        </div>
      );
    case "tiered_box":
      return (
        <div className="flex justify-between">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className={`grid h-6 w-6 place-items-center rounded-full text-[9px] ${i === 1 ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}>{i}</div>
              <p className="text-[8px] text-slate-400 mt-1">฿{i * 500}</p>
            </div>
          ))}
        </div>
      );
    case "promotion_card":
      return <div className="rounded-lg bg-linear-to-t from-black/60 to-brand-teal/40 h-16 flex items-end p-2"><span className="text-white text-[10px] font-bold">ซื้อครบฟรี</span></div>;
    case "promotion_badge":
      return <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-full bg-brand-teal text-white">ของแถม</span>;
    case "popup":
      return (
        <div className="rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs font-bold">🎉 ยินดีด้วย! ปลดล็อกของแถมแล้ว</p>
        </div>
      );
    case "congrats_bar":
      return <div className="rounded-full bg-brand-gradient text-white text-[10px] font-semibold text-center py-2">🎉 ปลดล็อกของแถมแล้ว!</div>;
    case "floating_button":
      return (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white mx-auto text-lg">
          🎁
        </div>
      );
    default:
      return <p className="text-[11px] text-slate-400">แสดงในตะกร้าแบบเลื่อน (มุมขวาบน)</p>;
  }
}

export default function WidgetsPanel() {
  const [widgets, setWidgets] = useState<WidgetRow[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/free-gifts/widgets");
    const data = await res.json();
    if (data.ok) setWidgets(data.widgets);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setToggleError(null);
    setWidgets((prev) => prev.map((w) => (w.key === key ? { ...w, enabled } : w)));
    try {
      const res = await fetch(`/api/admin/free-gifts/widgets/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Save failed — revert the optimistic flip instead of leaving the UI
      // showing a state that was never actually persisted.
      setWidgets((prev) => prev.map((w) => (w.key === key ? { ...w, enabled: !enabled } : w)));
      setToggleError("บันทึกไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง");
    }
  }

  function openCustomize(w: WidgetRow) {
    setOpenKey(openKey === w.key ? null : w.key);
    if (!drafts[w.key]) {
      const draft: Record<string, string> = {};
      for (const [k, v] of Object.entries(w.config)) draft[k] = String(v);
      setDrafts((prev) => ({ ...prev, [w.key]: draft }));
    }
  }

  async function saveConfig(w: WidgetRow) {
    setSaving(w.key);
    const draft = drafts[w.key] ?? {};
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      const num = Number(v);
      config[k] = v !== "" && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(v) ? num : v;
    }
    try {
      await fetch(`/api/admin/free-gifts/widgets/${w.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      await load();
      setOpenKey(null);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {toggleError && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs px-3 py-2">{toggleError}</p>
      )}
      {widgets.map((w) => (
        <div key={w.key} className="rounded-xl2 border border-slate-100 p-3.5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-ink">{w.label_th}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{DESCRIPTIONS[w.key]}</p>
            </div>
            <button
              onClick={() => toggle(w.key, !w.enabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${w.enabled ? "bg-brand-gradient" : "bg-slate-200"}`}
              aria-label={w.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            >
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${w.enabled ? "translate-x-[22px]" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <button
              onClick={() => openCustomize(w)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-emerald"
            >
              <Sliders size={12} /> ปรับแต่ง
              <ChevronDown size={12} className={openKey === w.key ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <button
              onClick={() => setPreviewKey(previewKey === w.key ? null : w.key)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-emerald"
            >
              <Eye size={12} /> ดูตัวอย่าง
            </button>
          </div>

          {openKey === w.key && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {Object.keys(w.config).length === 0 ? (
                <p className="text-[11px] text-slate-400">widget นี้ไม่มีตัวเลือกให้ปรับแต่ง</p>
              ) : (
                Object.keys(w.config).map((k) => (
                  <div key={k}>
                    <label className="block text-[11px] text-slate-400 mb-1">{CONFIG_LABELS[k] ?? k}</label>
                    <input
                      value={drafts[w.key]?.[k] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [w.key]: { ...prev[w.key], [k]: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    />
                  </div>
                ))
              )}
              <button
                onClick={() => saveConfig(w)}
                disabled={saving === w.key}
                className="rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50"
              >
                {saving === w.key ? "กำลังบันทึก..." : "บันทึกการปรับแต่ง"}
              </button>
            </div>
          )}

          {previewKey === w.key && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">ตัวอย่าง</p>
              <PreviewMock widgetKey={w.key} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
