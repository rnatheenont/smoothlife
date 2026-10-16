import { z } from "zod";
import Countdown from "@/components/campaign/Countdown";
import { getMessages } from "@/lib/i18n/messages";
import { PHASE_LABEL } from "@/lib/pages/campaign";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A strip that says how long is left, wherever it is put.
//
// Separate from the hero because it is usually wanted twice: once at the top
// and once further down, where somebody who has scrolled through forty
// products needs reminding that this ends tonight.
//
// The wording changes with the phase, and that is the whole reason it reads
// the phase rather than being four sections. "เริ่มใน 2 วัน" before the sale
// and "เหลืออีก 2 ชั่วโมง" during it are the same component with the same
// settings, and asking the admin to maintain two copies that differ only in
// their verbs is asking for the wrong one to be live on the day.

const schema = z.object({
  target: z.enum(["auto", "start", "end", "custom"]).default("auto"),
  customTo: z.string().default(""),
  message: z.string().max(120).default(""),
  tone: z.enum(["accent", "soft"]).default("accent"),
});

type Settings = z.output<typeof schema>;

function clockOf(settings: Settings, ctx: SectionProps<Settings>["ctx"]) {
  const times = ctx.times;
  if (settings.target === "custom") return settings.customTo || null;
  if (settings.target === "start") return times?.liveAt ?? null;
  if (settings.target === "end") return times?.extendedAt ?? times?.endsAt ?? null;
  // auto: whatever the campaign is heading towards next.
  if (ctx.phase === "teaser") return times?.liveAt ?? null;
  if (ctx.phase === "live") return times?.extendedAt ?? times?.endsAt ?? null;
  if (ctx.phase === "extended") return times?.endsAt ?? null;
  return null;
}

/** Default wording per phase, used when the admin has not written their own.
 *  Kept here rather than in the defaults so that it stays right after the
 *  phase changes — a sentence frozen into settings would say "เริ่มเร็ว ๆ นี้"
 *  through the whole sale. */
function wordingFor(ctx: SectionProps<Settings>["ctx"]): string {
  switch (ctx.phase) {
    case "teaser":
      return "เตรียมตัวให้พร้อม — ดีลเริ่มใน";
    case "live":
      return "ดีลกำลังจัด — เหลือเวลา";
    case "extended":
      return "ขยายเวลาแล้ว — เหลือเวลา";
    default:
      return "แคมเปญนี้จบแล้ว";
  }
}

function Component({ settings, ctx }: SectionProps<Settings>) {
  const to = clockOf(settings, ctx);
  const message = settings.message || wordingFor(ctx);

  // Nothing to count and nothing written: a bar that says only "แคมเปญนี้
  // จบแล้ว" is worth keeping, an empty bar is not.
  if (!to && !settings.message && ctx.phase !== "ended") return null;

  const accent = settings.tone === "accent";

  return (
    <section className="container-page py-3">
      <div
        className={`flex flex-col items-start gap-3 rounded-xl2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
          accent ? "" : "border border-surface-line bg-white"
        }`}
        style={accent ? { backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" } : undefined}
      >
        <p className={`text-sm font-semibold ${accent ? "" : "text-brand-ink"}`}>{message}</p>
        {to && (
          // On the soft tone the digits still use the accent, which is the
          // one place on a quiet bar that should pull the eye.
          <Countdown to={to} words={getMessages(ctx.locale).countdown} size="sm" label={undefined} />
        )}
        {!to && ctx.phase === "ended" && (
          <span className={`text-[13px] ${accent ? "opacity-90" : "text-grey-600"}`}>{PHASE_LABEL.ended}</span>
        )}
      </div>
    </section>
  );
}

export const countdownBanner: SectionDefinition<typeof schema> = {
  type: "countdown_banner",
  version: 1,
  label: "แถบนับถอยหลัง",
  description: "ข้อความเปลี่ยนตามช่วงของแคมเปญ วางซ้ำได้หลายจุด",
  category: "promo",
  schema,
  defaults: { target: "auto", customTo: "", message: "", tone: "accent" },
  fields: [
    {
      key: "target",
      type: "select",
      label: "นับถึงอะไร",
      options: [
        ["auto", "ตามช่วงของแคมเปญ"],
        ["start", "วันเริ่มงาน"],
        ["end", "วันจบงาน"],
        ["custom", "เวลาที่กำหนดเอง"],
      ],
    },
    { key: "customTo", type: "datetime", label: "เวลาที่กำหนดเอง" },
    { key: "message", type: "text", label: "ข้อความ", help: "เว้นว่างไว้ ระบบจะเปลี่ยนข้อความให้เองตามช่วง" },
    {
      key: "tone",
      type: "select",
      label: "หน้าตา",
      options: [["accent", "พื้นสีหลักของแคมเปญ"], ["soft", "พื้นขาวมีเส้นขอบ"]],
    },
  ],
  enabledOn: ["campaign"],
  check: async (settings) => {
    if (settings.target === "custom" && !settings.customTo) {
      return [{ level: "error" as const, message: "แถบนับถอยหลังเลือกเวลาที่กำหนดเอง แต่ยังไม่ได้ใส่เวลา" }];
    }
    return [];
  },
  Component,
};
