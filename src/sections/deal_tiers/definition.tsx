import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// "ซื้อครบ 999 ลด 100 · ครบ 1,999 ลด 250" — a ladder of thresholds.
//
// Shown as a ladder rather than a list because the thing a customer is
// working out is "how far am I from the next step", and a sorted ladder with
// the gaps visible answers that without arithmetic. The rungs are sorted
// here, not trusted from the form: typing them out of order is easy and the
// result would read as a worse deal for more money.
//
// No cart progress bar yet. It needs the cart total on the server, and the
// honest version of this section is one that states the thresholds correctly
// rather than one that guesses at how close you are.

const tier = z.object({
  spend: z.number().int().min(1),
  reward: z.string().min(1).max(60),
});

const schema = z.object({
  title: z.string().max(80).default(""),
  note: z.string().max(140).default(""),
  tiers: z.array(tier).max(6).default([]),
});

const baht = (n: number) => n.toLocaleString("th-TH");

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const tiers = [...settings.tiers].sort((a, b) => a.spend - b.spend);
  if (tiers.length === 0) return null;

  return (
    <section className="container-page py-6 md:py-10">
      {settings.title && <h2 className="text-base font-bold text-brand-ink md:text-lg">{settings.title}</h2>}
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t, i) => (
          <li
            key={t.spend}
            className="flex items-center gap-3 rounded-xl2 border border-surface-line bg-white p-4"
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold"
              style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-grey-600">ซื้อครบ {baht(t.spend)} บาท</span>
              <span className="block text-sm font-bold text-brand-ink">{t.reward}</span>
            </span>
          </li>
        ))}
      </ol>
      {settings.note && <p className="mt-2 text-[12px] leading-relaxed text-grey-600">{settings.note}</p>}
    </section>
  );
}

export const dealTiers: SectionDefinition<typeof schema> = {
  type: "deal_tiers",
  version: 1,
  label: "ซื้อครบลดเพิ่ม (ขั้นบันได)",
  description: "เรียงจากน้อยไปมากให้เอง",
  category: "promo",
  schema,
  defaults: {
    title: "ยิ่งซื้อยิ่งลด",
    note: "ส่วนลดคำนวณจากยอดก่อนค่าส่ง",
    tiers: [
      { spend: 999, reward: "ลด 100 บาท" },
      { spend: 1999, reward: "ลด 250 บาท" },
    ],
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "note", type: "text", label: "หมายเหตุใต้ตาราง" },
    {
      key: "tiers",
      type: "json",
      label: "ขั้นบันได",
      help: 'แต่ละขั้น: spend (ตัวเลข) และ reward เช่น [{"spend":999,"reward":"ลด 100 บาท"}]',
    },
  ],
  enabledOn: ["campaign", "home", "page"],
  check: async (settings) => {
    const issues = [];
    if (settings.tiers.length === 0) {
      issues.push({ level: "error" as const, message: "ขั้นบันไดยังไม่มีขั้นเลย" });
    }
    const spends = settings.tiers.map((t) => t.spend);
    if (new Set(spends).size !== spends.length) {
      issues.push({ level: "error" as const, message: "มียอดซื้อขั้นต่ำซ้ำกันสองขั้น" });
    }
    return issues;
  },
  Component,
};
