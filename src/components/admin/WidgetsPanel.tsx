"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sliders, Eye, RefreshCw, Upload, Loader2 } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import { Input } from "@heroui/react";

type WidgetRow = {
  key: string;
  label_th: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

const DESCRIPTIONS: Record<string, string> = {
  milestone_bar:
    "แถบขั้นบันไดแสดงความคืบหน้าของทุกโปร (หน้าตะกร้า, หน้าสินค้า)",
  deal_of_day: "การ์ดดีลวันนี้พร้อมนับถอยหลังจริง (หน้าแรก)",
  tiered_box: "กล่องแสดงระดับรางวัลของโปรแบบขั้นบันได (หน้าตะกร้า)",
  promotion_card: "การ์ดโปรโมชั่นจริงบนหน้าแรก (แทนที่การ์ดตัวอย่าง)",
  promotion_badge: "แบดจ์บนรูปสินค้าที่อยู่ในโปร (หน้ารายการสินค้า)",
  cart_drawer_offer: "โชว์ข้อเสนอในตะกร้าแบบเลื่อน (มุมขวาบน)",
  popup: "ป๊อปอัพแจ้งเตือนเมื่อปลดล็อกของแถมใหม่",
  floating_button: "ปุ่มลอยลากได้ แจ้งเตือนเมื่อมีของแถมให้รับ",
  congrats_bar: "แถบแจ้งเตือนด้านบนเมื่อปลดล็อกของแถม",
  gifts_on_slide_cart: "แสดงรายการของแถมที่ได้รับในตะกร้าแบบเลื่อน",
  flash_sale_bar: "แถบเขียวนับถอยหลังใต้แถวหมวดหมู่ พร้อมโค้ดส่วนลด (หน้าแรก)",
  flash_sale_shelf: "แบนเนอร์แคมเปญ + ชั้นวางสินค้าจาก collection ที่เลือก (หน้าแรก)",
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
  subtitleTh: "ข้อความบรรทัดรอง",
  endsAt: "หมดเวลาเมื่อ (เช่น 2026-10-15T23:59:00+07:00)",
  code: "โค้ดส่วนลด",
  href: "ลิงก์ปลายทาง (เช่น /collections/smooth-sale)",
  image: "ลิงก์รูปแบนเนอร์ (1512x260)",
  collection: "handle ของ collection (เช่น sale-up-to-50-off)",
  titleTh: "หัวข้อบนแบนเนอร์ (ใช้เมื่อไม่ได้ใส่รูป)",
  colorFrom: "สีซ้ายของแถบ",
  colorTo: "สีขวาของแถบ",
};

// Fields a widget can have, whether or not the stored row happens to carry
// them yet. The form used to be built from the saved config alone, so a key
// added in code was invisible until someone wrote it into the database by
// hand — which is a deploy that silently does nothing.
const CONFIG_FIELDS: Record<string, string[]> = {
  flash_sale_bar: ["titleTh", "subtitleTh", "endsAt", "code", "href", "colorFrom", "colorTo"],
  flash_sale_shelf: ["titleTh", "image", "href", "collection"],
};

/** Rendered as a colour well rather than a text box. */
const COLOR_FIELDS = new Set(["colorFrom", "colorTo", "color"]);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function PreviewMock({ widgetKey }: { widgetKey: string }) {
  switch (widgetKey) {
    case "milestone_bar":
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${i === 1 ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}
              >
                {i}
              </div>
              {i < 3 && <div className="h-0.5 flex-1 bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>
      );
    case "flash_sale_bar":
      return (
        <div className="flex items-center justify-between rounded-lg bg-[linear-gradient(90deg,#0b6b4f,#1bb57a)] px-2 py-1.5 text-white">
          <span className="text-[10px] font-extrabold italic leading-none">Flash Sale</span>
          <span className="text-[10px] font-bold tabular-nums">02 : 11 : 40 : 09</span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-brand-800">Code</span>
        </div>
      );
    case "flash_sale_shelf":
      return (
        <div className="space-y-1">
          <div className="h-6 rounded bg-brand-gradient" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 flex-1 rounded bg-slate-100 ring-1 ring-surface-line" />
            ))}
          </div>
        </div>
      );
    case "deal_of_day":
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
          <p className="text-[10px] font-bold text-brand-ink">
            ดีลวันนี้ รับของแถมได้เลย
          </p>
          <p className="text-xs font-bold mt-1">23:59:59</p>
        </div>
      );
    case "tiered_box":
      return (
        <div className="flex justify-between">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div
                className={`grid h-6 w-6 place-items-center rounded-full text-[9px] ${i === 1 ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"}`}
              >
                {i}
              </div>
              <p className="text-[8px] text-slate-400 mt-1">฿{i * 500}</p>
            </div>
          ))}
        </div>
      );
    case "promotion_card":
      return (
        <div className="rounded-lg bg-linear-to-t from-black/60 to-brand-teal/40 h-16 flex items-end p-2">
          <span className="text-white text-[10px] font-bold">ซื้อครบฟรี</span>
        </div>
      );
    case "promotion_badge":
      return (
        <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-full bg-brand-teal text-white">
          ของแถม
        </span>
      );
    case "popup":
      return (
        <div className="rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs font-bold">🎉 ยินดีด้วย! ปลดล็อกของแถมแล้ว</p>
        </div>
      );
    case "congrats_bar":
      return (
        <div className="rounded-full bg-brand-gradient text-white text-[10px] font-semibold text-center py-2">
          🎉 ปลดล็อกของแถมแล้ว!
        </div>
      );
    case "floating_button":
      return (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white mx-auto text-lg">
          🎁
        </div>
      );
    default:
      return (
        <p className="text-[11px] text-slate-400">
          แสดงในตะกร้าแบบเลื่อน (มุมขวาบน)
        </p>
      );
  }
}

export default function WidgetsPanel() {
  const [widgets, setWidgets] = useState<WidgetRow[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/free-gifts/widgets");
    const data = await res.json();
    if (data.ok) setWidgets(data.widgets);
  }

  // The widgets are read from the database; someone else may have changed them.
  useAdminAction({
    label: "รีเฟรชวิดเจ็ต",
    icon: <RefreshCw size={15} aria-hidden />,
    onClick: () => load(),
  });

  useEffect(() => {
    load();
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setToggleError(null);
    setWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, enabled } : w)),
    );
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
      setWidgets((prev) =>
        prev.map((w) => (w.key === key ? { ...w, enabled: !enabled } : w)),
      );
      setToggleError("บันทึกไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง");
    }
  }

  function fieldsFor(w: WidgetRow) {
    const seen = new Set(Object.keys(w.config));
    for (const k of CONFIG_FIELDS[w.key] ?? []) seen.add(k);
    return [...seen];
  }

  function openCustomize(w: WidgetRow) {
    setOpenKey(openKey === w.key ? null : w.key);
    if (!drafts[w.key]) {
      const draft: Record<string, string> = {};
      for (const k of fieldsFor(w)) draft[k] = w.config[k] === undefined ? "" : String(w.config[k]);
      setDrafts((prev) => ({ ...prev, [w.key]: draft }));
    }
  }

  async function uploadBanner(widgetKey: string, field: string, file: File) {
    setUploading(widgetKey);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/admin/flash-sale/upload-image", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.url) {
        setUploadError(json?.error ?? "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      setDrafts((prev) => ({ ...prev, [widgetKey]: { ...prev[widgetKey], [field]: json.url! } }));
    } catch {
      setUploadError("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(null);
    }
  }

  async function saveConfig(w: WidgetRow) {
    setSaving(w.key);
    const draft = drafts[w.key] ?? {};
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      // A field left blank is a field the widget should fall back on, not an
      // empty string to render.
      if (v === "" && w.config[k] === undefined) continue;
      const num = Number(v);
      config[k] =
        v !== "" && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(v) ? num : v;
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
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs px-3 py-2">
          {toggleError}
        </p>
      )}
      {widgets.map((w) => (
        <div
          key={w.key}
          className="rounded-xl2 border border-slate-100 bg-white p-3.5 shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-ink">{w.label_th}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {DESCRIPTIONS[w.key]}
              </p>
            </div>
            <button
              onClick={() => toggle(w.key, !w.enabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${w.enabled ? "bg-brand-gradient" : "bg-slate-200"}`}
              aria-label={w.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${w.enabled ? "translate-x-[22px]" : "translate-x-0"}`}
              />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <button
              onClick={() => openCustomize(w)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-800"
            >
              <Sliders size={12} /> ปรับแต่ง
              <ChevronDown
                size={12}
                className={
                  openKey === w.key
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </button>
            <button
              onClick={() => setPreviewKey(previewKey === w.key ? null : w.key)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-800"
            >
              <Eye size={12} /> ดูตัวอย่าง
            </button>
          </div>

          {openKey === w.key && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {fieldsFor(w).length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  widget นี้ไม่มีตัวเลือกให้ปรับแต่ง
                </p>
              ) : (
                fieldsFor(w).map((k) => {
                  const value = drafts[w.key]?.[k] ?? "";
                  const set = (next: string) =>
                    setDrafts((prev) => ({ ...prev, [w.key]: { ...prev[w.key], [k]: next } }));
                  return (
                    <div key={k}>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {CONFIG_LABELS[k] ?? k}
                      </label>

                      {COLOR_FIELDS.has(k) ? (
                        // The well and the hex sit side by side: one to pick
                        // with, one to paste a brand colour into.
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={CONFIG_LABELS[k] ?? k}
                            value={HEX.test(value) ? value : "#0b6b4f"}
                            onChange={(e) => set(e.target.value)}
                            className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                          />
                          <Input fullWidth placeholder="#0b6b4f" value={value} onChange={(e) => set(e.target.value)} />
                        </div>
                      ) : k === "image" ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              fullWidth
                              placeholder="วางลิงก์รูป หรือกดอัปโหลด"
                              value={value}
                              onChange={(e) => set(e.target.value)}
                            />
                            <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-brand-teal hover:text-brand-800">
                              {uploading === w.key ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Upload size={13} />
                              )}
                              อัปโหลด
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) uploadBanner(w.key, k, file);
                                }}
                              />
                            </label>
                          </div>
                          {uploadError && <p className="text-[11px] text-rose-600">{uploadError}</p>}
                          {/* The banner as the page will draw it — 1512x260,
                              the shape the shelf crops to — so a wrong crop is
                              caught here rather than on the live home page. */}
                          {value ? (
                            <div className="overflow-hidden rounded-lg border border-slate-100">
                              {/* A plain img on purpose: next/image refuses a
                                  host that is not in remotePatterns, and an
                                  admin pasting a link from anywhere would
                                  take the whole panel down with it. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={value} alt="" className="aspect-[1512/260] w-full bg-slate-50 object-cover" />
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400">ยังไม่มีรูป — แบนเนอร์จะใช้หัวข้อบนพื้นไล่สีแทน</p>
                          )}
                        </div>
                      ) : (
                        <Input fullWidth value={value} onChange={(e) => set(e.target.value)} />
                      )}
                    </div>
                  );
                })
              )}
              <button
                onClick={() => saveConfig(w)}
                disabled={saving === w.key}
                className="rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50"
              >
                {saving === w.key ? "กำลังบันทึก…" : "บันทึกการปรับแต่ง"}
              </button>
            </div>
          )}

          {previewKey === w.key && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                ตัวอย่าง
              </p>
              <PreviewMock widgetKey={w.key} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
