import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { concerns, concernImage } from "@/data/categories";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The skin concerns, as pictures to walk into.
//
// Locked, because the concerns are a fixed taxonomy: the advisor's questions,
// the filters and every /concern/[slug] page are built on the same list, so a
// concern that could be removed from this page would still exist everywhere
// else and simply become unreachable from the hub.
//
// What is editable is the card at the end — the way out for somebody who does
// not know which of these describes them. That card is a real editorial
// decision (where to send them, and what to say), so it is settings rather
// than markup.

const schema = z.object({
  showAdvisor: z.boolean().default(true),
  advisorTitle: z.string().max(120).default(""),
  advisorCta: z.string().max(80).default(""),
  advisorHref: z.string().default("/advisor"),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  return (
    <section className="container-page pb-8 md:pb-10">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
        {concerns.map((c) => (
          <Link key={c.slug} href={`/concern/${c.slug}`} className="group overflow-hidden rounded-xl2 shadow-card">
            <div className="relative aspect-4/3">
              <Image
                src={concernImage(c.slug)}
                alt={c.name}
                fill
                className="object-cover object-[50%_35%] transition-transform duration-500"
              />
              {/* The wash is what makes the white type legible over whatever
                  photograph is behind it — darkest at the bottom, where the
                  words are. */}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 p-4 text-white">
                <h3 className="font-bold">{c.nameTh}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-white/80">{c.description}</p>
              </div>
            </div>
          </Link>
        ))}
        {settings.showAdvisor && settings.advisorTitle && (
          <Link
            href={settings.advisorHref || "/advisor"}
            className="flex aspect-4/3 flex-col items-center justify-center rounded-xl2 border-2 border-dashed border-brand-teal p-6 text-center"
          >
            <p className="font-bold text-brand-ink">{settings.advisorTitle}</p>
            {settings.advisorCta && (
              <span className="mt-2 text-sm font-semibold text-brand-800">{settings.advisorCta}</span>
            )}
          </Link>
        )}
      </div>
    </section>
  );
}

export const concernTiles: SectionDefinition<typeof schema> = {
  type: "concern_tiles",
  version: 1,
  label: "ตารางปัญหาผิว",
  description: "การ์ดรูปของปัญหาผิวทุกข้อ พร้อมการ์ดชวนไปให้ที่ปรึกษาช่วยประเมิน",
  category: "product",
  schema,
  defaults: {
    showAdvisor: true,
    advisorTitle: "ไม่แน่ใจว่าผิวคุณกังวลเรื่องอะไร?",
    advisorCta: "ให้น้อง Smoothie ช่วยประเมิน →",
    advisorHref: "/advisor",
  },
  fields: [
    { key: "showAdvisor", type: "toggle", label: "แสดงการ์ดให้ที่ปรึกษาช่วย" },
    { key: "advisorTitle", type: "text", label: "คำถามบนการ์ด" },
    { key: "advisorCta", type: "text", label: "ข้อความชวนกด" },
    { key: "advisorHref", type: "text", label: "ลิงก์" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
