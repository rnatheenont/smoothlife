import { z } from "zod";
import CopyCode from "@/components/campaign/CopyCode";
import { bangkokLabel } from "@/lib/pages/bangkok-time";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A row of coupon cards that scrolls sideways.
//
// Two decisions worth writing down.
//
// An expired coupon removes itself. The alternative — greying it out — looks
// tidy in a mockup and reads as a shop advertising something it will not
// honour. The filtering is done where the page is rendered, so a coupon that
// expires at midnight is gone by the time anyone can try it (the campaign
// page's own schedule tick re-renders on section boundaries; a coupon whose
// expiry falls inside the campaign should be given a visibleUntil as well if
// it has to disappear to the minute).
//
// "เก็บโค้ด" copies rather than applies. See CopyCode — the cart has no
// discount path wired up yet, and a button that claims to apply a discount
// and does not is worse than one that is honest about copying.

const voucher = z.object({
  code: z.string().min(1).max(40),
  value: z.string().min(1).max(40),
  condition: z.string().max(80).default(""),
  expiresAt: z.string().default(""),
});

const schema = z.object({
  title: z.string().max(80).default(""),
  vouchers: z.array(voucher).max(12).default([]),
});

type Settings = z.output<typeof schema>;

function live(settings: Settings, now: Date) {
  return settings.vouchers.filter((v) => {
    if (!v.expiresAt) return true;
    const at = Date.parse(v.expiresAt);
    // An unreadable date keeps the coupon: hiding it would turn one typo into
    // a coupon nobody can find and nobody can explain.
    return !Number.isFinite(at) || at > now.getTime();
  });
}

function Component({ settings, ctx }: SectionProps<Settings>) {
  const items = live(settings, ctx.now);
  if (items.length === 0) return null;

  return (
    <section className="py-5 md:py-7">
      {settings.title && (
        <div className="container-page">
          <h2 className="text-base font-bold text-brand-ink md:text-lg">{settings.title}</h2>
        </div>
      )}
      {/* Scrolls rather than wraps: four coupons on a phone should be four
          coupons you can flick through, not a grid of eight half-cards. */}
      <ul className="scrollbar-none mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:px-6 lg:justify-center">
        {items.map((v) => (
          <li
            key={v.code}
            className="flex w-[260px] shrink-0 snap-start flex-col justify-between rounded-xl2 border border-surface-line bg-white p-4"
          >
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--cp-accent)" }}>
                {v.value}
              </p>
              {v.condition && <p className="mt-0.5 text-[12px] leading-relaxed text-grey-600">{v.condition}</p>}
              {v.expiresAt && (
                <p className="mt-1 text-[11px] text-grey-400">หมดเขต {bangkokLabel(v.expiresAt)}</p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-soft px-2.5 py-2 font-mono text-[13px] font-semibold text-brand-ink">
                {v.code}
              </code>
              <CopyCode code={v.code} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const voucherStrip: SectionDefinition<typeof schema> = {
  type: "voucher_strip",
  version: 1,
  label: "คูปองส่วนลด",
  description: "การ์ดคูปองเลื่อนแนวนอน · โค้ดที่หมดเขตแล้วจะหายไปเอง",
  category: "promo",
  schema,
  defaults: {
    title: "เก็บคูปองก่อนช้อป",
    vouchers: [{ code: "SAVE100", value: "ลด 100 บาท", condition: "เมื่อซื้อครบ 990 บาท", expiresAt: "" }],
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    {
      key: "vouchers",
      type: "json",
      label: "รายการคูปอง",
      help: 'แต่ละอัน: code, value, condition, expiresAt (ISO) เช่น [{"code":"SAVE100","value":"ลด 100 บาท","condition":"ซื้อครบ 990","expiresAt":""}]',
    },
  ],
  enabledOn: ["campaign", "home", "page"],
  check: async (settings) => {
    const issues = [];
    if (settings.vouchers.length === 0) {
      issues.push({ level: "error" as const, message: "คูปองส่วนลดยังไม่มีโค้ดเลย" });
    }
    const codes = settings.vouchers.map((v) => v.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) {
      issues.push({ level: "error" as const, message: "มีโค้ดคูปองซ้ำกันในชุดนี้" });
    }
    // Checked at publish, not hidden at publish: a coupon that has already
    // expired is almost always a date typed in the wrong year.
    const dead = settings.vouchers.filter((v) => v.expiresAt && Date.parse(v.expiresAt) <= Date.now());
    if (dead.length) {
      issues.push({
        level: "warning" as const,
        message: `โค้ด ${dead.map((v) => v.code).join(", ")} หมดเขตไปแล้ว — จะไม่แสดงบนหน้าจริง`,
      });
    }
    return issues;
  },
  Component,
};
