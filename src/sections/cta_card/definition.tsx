import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { lText, tx } from "@/lib/i18n/localized";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// "Here is what to do next." One title, one sentence, one button.
//
// It is the block at the foot of an article, the one on the 404 that offers
// the shop instead of an apology, and the one that invites somebody to ask
// Smoothie. Those were three pieces of markup saying the same thing in three
// files; this is the one of them that an admin can reword.
//
// One button, not two. A card that offers a choice is not a call to action,
// and the second button on a card like this is almost always the one nobody
// presses.

const schema = z.object({
  title: lText(120).default(""),
  body: lText(400).default(""),
  button: lText(40).default(""),
  href: z.string().default(""),
  image: z.string().default(""),
  tone: z.enum(["soft", "brand"]).default("soft"),
});

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  // Read each two-language field once, up here, and work with the words from
  // then on. Not only for tidiness: `settings.title` is an object once a
  // translation exists, and an object is always truthy — so a check written
  // against the raw field would stop ever finding a card empty, and this
  // block would draw a heading made of nothing.
  const title = tx(settings.title, ctx.locale);
  const body = tx(settings.body, ctx.locale);
  const button = tx(settings.button, ctx.locale);

  if (!title && !body) return null;
  const onBrand = settings.tone === "brand";

  return (
    <section className="container-page pb-10">
      <div
        className={`flex flex-col items-center gap-5 rounded-xl2 p-6 text-center md:flex-row md:p-8 md:text-left ${
          onBrand ? "bg-brand-gradient text-white" : "bg-brand-gradient-soft text-brand-ink"
        }`}
      >
        {settings.image && (
          <div className="relative size-24 shrink-0 md:size-28">
            <Image src={settings.image} alt="" fill className="object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && <h2 className="text-xl font-bold md:text-2xl">{title}</h2>}
          {body && (
            <p className={`mt-2 text-sm ${onBrand ? "text-white/90" : "text-slate-600"}`}>{body}</p>
          )}
        </div>
        {button && settings.href && (
          <Link
            href={settings.href}
            className={`shrink-0 rounded-full px-6 py-3 text-sm font-bold shadow-card transition-transform hover:scale-[1.02] ${
              onBrand ? "bg-white text-brand-800" : "bg-brand-800 text-white"
            }`}
          >
            {button}
          </Link>
        )}
      </div>
    </section>
  );
}

export const ctaCard: SectionDefinition<typeof schema> = {
  type: "cta_card",
  version: 1,
  label: "การ์ดชวนทำต่อ",
  description: "หัวข้อ คำอธิบาย และปุ่มเดียว — ใช้ปิดท้ายหน้า",
  category: "content",
  schema,
  defaults: {
    title: "ยังไม่แน่ใจว่าต้องใช้อะไร",
    body: "เล่าอาการหรือสิ่งที่กังวลให้น้อง Smoothie ฟัง แล้วให้ช่วยหาสินค้าที่ใช่",
    button: "ถามน้อง Smoothie",
    href: "/chat",
    image: "",
    tone: "soft",
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "body", type: "textarea", label: "คำอธิบาย" },
    { key: "button", type: "text", label: "ข้อความบนปุ่ม" },
    { key: "href", type: "text", label: "ลิงก์ปลายทาง" },
    { key: "image", type: "image", label: "รูปประกอบ (ไม่ใส่ก็ได้)" },
    { key: "tone", type: "select", label: "สี", options: [["soft", "เขียวอ่อน"], ["brand", "เขียวเข้ม"]] },
  ],
  enabledOn: ["home", "page", "campaign", "brand", "system", "template"],
  Component,
};
