import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";

// The way into the help centre: one row per topic, three across.
//
// Close to tool_cards and kept apart for the same reason tool_cards is kept
// apart from feature_cards — these are signposts inside one section of the
// site, so they are narrower, have no description, and sit three to a row
// where a tool card sits two. Merging them would mean a section with a
// "which of the three shapes" setting, which is three sections wearing one
// name.

const schema = z.object({
  items: z
    .array(
      z.object({
        icon: z.string().default(""),
        label: z.string().max(80).default(""),
        href: z.string().default(""),
      })
    )
    .max(12)
    .default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((i) => i.label && i.href);
  if (items.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {items.map((topic, i) => {
          const Icon = contentIcon(topic.icon);
          return (
            <Link
              key={i}
              href={topic.href}
              className="flex items-center gap-3 rounded-xl2 border border-slate-100 p-5 shadow-card transition-colors hover:border-brand-teal"
            >
              {Icon && (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                  <Icon size={18} />
                </div>
              )}
              <span className="flex-1 text-sm font-medium text-brand-ink">{topic.label}</span>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export const helpTopicsSection: SectionDefinition<typeof schema> = {
  type: "help_topics",
  version: 1,
  label: "หัวข้อช่วยเหลือ",
  description: "แถวการ์ดลิงก์ไปหัวข้อย่อย 3 ใบต่อแถว",
  category: "content",
  schema,
  defaults: {
    items: [
      { icon: "truck", label: "การจัดส่งและคืนสินค้า", href: "/help/delivery" },
      { icon: "qr-code", label: "การชำระเงิน", href: "/help/payment" },
      { icon: "message-circle", label: "แชทและติดต่อเรา", href: "/help/contact" },
    ],
  },
  fields: [
    {
      key: "items",
      type: "json",
      label: "หัวข้อ",
      help: `แต่ละอัน: icon, label, href — ไอคอนที่เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}`,
    },
  ],
  enabledOn: ["page", "system"],
  Component,
};
