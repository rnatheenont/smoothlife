"use client";

import { useState } from "react";
import { Gift, Check, Monitor, Smartphone } from "lucide-react";
import {
  GIFT_WIDGET_TABS,
  giftWidgetStyle,
  giftWidgetVars,
  fillTemplate,
  type GiftWidgetStyle,
} from "@/lib/gift-widget-style";

// The widget's looks, edited the way the app on Shopify edits them: controls
// on the left under Style / Color / Content, and the thing itself redrawing
// beside them as the numbers move.
//
// The preview is the point. A list of sliders labelled "border opacity" over
// a widget nobody can see is a guessing game, and the reason the shop has
// been asking for these changes in code is that there was nowhere to try one.

const SAMPLE = [
  { name: "Dentiste SUKKIRI MASTIC MINT", reached: true },
  { name: "Smooth E GOLD FOAM 1.5 OZ.", reached: true },
  { name: "Anticavity Max Fluoride", reached: false },
];

export default function GiftWidgetStyleEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [tab, setTab] = useState<"style" | "color" | "content">("style");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  /** How far along the preview basket is, 0–100. The app calls it "Drag to
   *  view progress", and it is the only way to see the reached and unreached
   *  states without building a basket. */
  const [progress, setProgress] = useState(60);

  const style = giftWidgetStyle(config);
  const set = (key: keyof GiftWidgetStyle, value: string | number) =>
    onChange({ ...config, [key]: value });

  const reachedCount = Math.min(SAMPLE.length, Math.floor((progress / 100) * (SAMPLE.length + 0.4)));
  const next = SAMPLE[reachedCount];
  const message = next
    ? fillTemplate(style.beforeTh, {
        amount_left: `฿${Math.max(0, Math.round((100 - progress) * 12)).toLocaleString()}`,
        nearest_reward: next.name,
      })
    : fillTemplate(style.afterTh, { nearest_reward: SAMPLE[SAMPLE.length - 1].name });

  return (
    // A container query, not a breakpoint. This editor is shown twice — full
    // width on the widgets page, and in half a column inside the campaign
    // form — and `lg:` asks the viewport, which is wide in both cases. So in
    // the campaign form the two columns stayed side by side in half the
    // room and the preview sat on top of the sliders.
    <div className="@container">
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl2 bg-surface-soft p-1">
          {GIFT_WIDGET_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                tab === t.key ? "bg-white text-brand-ink shadow-card" : "text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {GIFT_WIDGET_TABS.find((t) => t.key === tab)?.fields.map((field) => {
            const value = style[field.key];
            if (field.kind === "layout") {
              return (
                <div key={field.key}>
                  <p className="mb-1 text-[11px] font-semibold text-brand-ink">{field.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["cards", "การ์ดของแถม"],
                        ["bar", "แถบความคืบหน้า"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set("layout", key)}
                        className={`rounded-xl border-2 p-2 text-[11px] font-semibold transition-colors ${
                          style.layout === key
                            ? "border-brand-teal bg-brand-gradient-soft text-brand-ink"
                            : "border-slate-200 text-slate-500"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            if (field.kind === "color") {
              return (
                <label key={field.key} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-brand-ink">{field.label}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={String(value)}
                      onChange={(e) => set(field.key, e.target.value)}
                      aria-label={field.label}
                      className="size-7 cursor-pointer rounded border border-surface-line bg-white"
                    />
                    <code className="text-[10px] text-slate-400">{String(value)}</code>
                  </span>
                </label>
              );
            }
            if (field.kind === "text") {
              return (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-brand-ink">{field.label}</span>
                  <input
                    value={String(value)}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-surface-line bg-white px-2 py-2 text-xs text-brand-ink"
                  />
                </label>
              );
            }
            return (
              <label key={field.key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[11px] font-semibold text-brand-ink">
                  {field.label}
                </span>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  value={Number(value)}
                  onChange={(e) => set(field.key, Number(e.target.value))}
                  aria-label={field.label}
                  className="min-w-0 flex-1 accent-brand-emerald"
                />
                <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-slate-500">
                  {Number(value)} {field.unit}
                </span>
              </label>
            );
          })}
          {tab === "content" && (
            <p className="rounded-lg bg-surface-soft p-2 text-[10px] leading-relaxed text-slate-500">
              ใส่ตัวแปรได้: <code className="font-semibold">{"{{amount_left}}"}</code> คือยอดที่ยังขาด
              และ <code className="font-semibold">{"{{nearest_reward}}"}</code> คือของรางวัลชิ้นถัดไป
              — ตัวแปรที่พิมพ์ผิดจะแสดงตามที่พิมพ์ จะได้มองเห็นว่าผิด
            </p>
          )}
        </div>
      </div>

      {/* The preview. */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-surface-soft p-0.5">
            {(
              [
                ["desktop", Monitor, "จอใหญ่"],
                ["mobile", Smartphone, "มือถือ"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                  device === key ? "bg-white text-brand-ink shadow-card" : "text-slate-500"
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-[10px] text-slate-400">เลื่อนดูความคืบหน้า</span>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label="เลื่อนดูความคืบหน้า"
              className="min-w-0 flex-1 accent-brand-emerald"
            />
          </label>
        </div>

        <div className="rounded-xl2 bg-surface-muted p-3">
          <div className={device === "mobile" ? "mx-auto w-[320px] max-w-full" : ""}>
            <div
              style={{ ...giftWidgetVars(style), background: style.surface, borderRadius: style.radius }}
              className="p-3"
            >
              <p
                style={{ fontSize: style.messageSize, color: style.text }}
                className="mb-2 font-bold"
              >
                {style.titleTh}
              </p>
              <p style={{ fontSize: style.tierSize, color: style.text }} className="mb-2 opacity-70">
                {message}
              </p>

              {style.layout === "bar" ? (
                /* One bar segment per milestone, with its name underneath —
                   the Progress Bar Stepper pattern from 21st.dev
                   (21st.dev/@sean0205/components/c-stepper-11, MIT). The
                   single shared bar with icons sitting on top of it put the
                   circles and the names in the same few pixels, so on a
                   narrow column they overlapped each other. A step that owns
                   its own segment cannot collide with its neighbour. */
                <div style={{ gap: style.gap }} className="flex">
                  {SAMPLE.map((s, i) => {
                    const done = i < reachedCount;
                    // The segment the shopper is inside fills proportionally;
                    // the ones behind are full and the ones ahead are empty.
                    const fill = done ? 100 : i === reachedCount ? ((progress * SAMPLE.length) / 100 - i) * 100 : 0;
                    return (
                      <span key={s.name} className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span
                          style={{ height: style.barThickness, borderRadius: style.barRadius }}
                          className="overflow-hidden bg-black/10"
                        >
                          <span
                            style={{
                              display: "block",
                              width: `${Math.max(0, Math.min(100, fill))}%`,
                              height: "100%",
                              borderRadius: style.barRadius,
                              background: `linear-gradient(90deg, ${style.accentFrom}, ${style.accentTo})`,
                            }}
                            className="transition-[width]"
                          />
                        </span>
                        <span className="flex items-start gap-1">
                          <span
                            style={{ color: done ? style.accentFrom : undefined }}
                            className={done ? "" : "opacity-40"}
                          >
                            {done ? <Check size={11} /> : <Gift size={11} />}
                          </span>
                          <span
                            style={{ fontSize: style.tierSize, color: style.text }}
                            className={`line-clamp-2 min-w-0 flex-1 leading-tight ${done ? "" : "opacity-60"}`}
                          >
                            {s.name}
                          </span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <ul style={{ gap: style.gap }} className="grid grid-cols-2 sm:grid-cols-3">
                  {SAMPLE.map((s, i) => (
                    <li
                      key={s.name}
                      style={{
                        borderRadius: style.radius,
                        opacity: i < reachedCount ? 1 : 0.45,
                        background: "rgba(255,255,255,0.75)",
                      }}
                      className="flex items-center gap-2 p-2"
                    >
                      <span
                        style={{
                          width: style.iconSize,
                          height: style.iconSize,
                          borderRadius: style.radius,
                          background: `linear-gradient(90deg, ${style.accentFrom}, ${style.accentTo})`,
                        }}
                        className="grid shrink-0 place-items-center text-white"
                      >
                        <Gift size={14} />
                      </span>
                      <span
                        style={{ fontSize: style.tierSize, color: style.text }}
                        className="line-clamp-2 min-w-0 flex-1 font-semibold"
                      >
                        {s.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
