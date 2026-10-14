import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A short routine, as numbered cards.
//
// This is the block the concern template exists to make editable. Today the
// three steps are the same three sentences on every skin concern the shop
// sells for — written once, hard-coded, and true of a cleanser routine in the
// general way that advice stops being advice. Whoever knows the difference
// between an acne routine and a dry-skin one can now say so without a deploy.
//
// Numbered cards are right here and would be wrong almost anywhere else: this
// really is a sequence — you cleanse before you treat before you seal — which
// is the only thing that earns a number on a card.

const schema = z.object({
  heading: z.string().max(120).default(""),
  steps: z
    .array(z.object({ label: z.string().max(40).default(""), body: z.string().max(240).default("") }))
    .max(6)
    .default([]),
});

// Three across from sm, which is what the hand-written block had. Written out
// per count rather than composed, because grid-cols-${n} is a class Tailwind
// never generated.
const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const steps = settings.steps.filter((s) => s.label || s.body);
  if (steps.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mb-8 rounded-xl2 bg-brand-gradient-soft p-5">
        {settings.heading && <h2 className="mb-2 font-bold text-brand-ink">{settings.heading}</h2>}
        <div className={`grid gap-3 text-sm text-slate-600 ${COLUMNS[steps.length] ?? COLUMNS[3]}`}>
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg bg-white p-3">
              {step.label && <span className="text-xs font-bold text-brand-800">{step.label}</span>}
              {step.body && <p className="mt-1">{step.body}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const routineSteps: SectionDefinition<typeof schema> = {
  type: "routine_steps",
  version: 1,
  label: "ขั้นตอนที่แนะนำ",
  description: "การ์ดขั้นตอนเรียงลำดับ บนพื้นเขียวอ่อน — แก้คำได้ทั้งหมด",
  category: "content",
  schema,
  defaults: {
    heading: "Routine แนะนำสำหรับปัญหานี้",
    steps: [
      { label: "ขั้นที่ 1", body: "ทำความสะอาดผิวด้วยผลิตภัณฑ์อ่อนโยน" },
      { label: "ขั้นที่ 2", body: "ใช้เซรั่มหรือทรีทเมนต์เฉพาะจุด" },
      { label: "ขั้นที่ 3", body: "ปิดท้ายด้วยมอยส์เจอร์ไรเซอร์และกันแดด" },
    ],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    {
      key: "steps",
      type: "list",
      label: "ขั้นตอน",
      item: "ขั้นตอน",
      max: 6,
      columns: [
        { key: "label", label: "ชื่อขั้น", half: true },
        { key: "body", label: "คำอธิบาย", type: "textarea" },
      ],
    },
  ],
  enabledOn: ["page", "system", "template"],
  Component,
};
