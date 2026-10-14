import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";

// The list of things the shop can do for you: the skin advisor, the
// supplement advisor, the oral-care one, the chat.
//
// Close to feature_cards and deliberately not the same section. These are
// always links, they always carry a mark, and they read as a menu rather than
// as a set of claims — so the row is a row, the arrow is always there, and
// there is no variant of this block that goes nowhere.

const schema = z.object({
  heading: z.string().max(120).default(""),
  items: z
    .array(
      z.object({
        icon: z.string().default(""),
        title: z.string().max(80).default(""),
        subtitle: z.string().max(200).default(""),
        href: z.string().default(""),
      })
    )
    .max(10)
    .default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((i) => i.title && i.href);
  if (items.length === 0) return null;

  return (
    <section className="container-page pb-8 md:pb-10">
      {settings.heading && (
        <h2 className="mb-5 text-xl font-bold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((tool, i) => {
          const Icon = contentIcon(tool.icon);
          return (
            <li key={i}>
              {/* The card the assistant page already draws — outlined, not
                  filled, and the arrow nudges on hover. Matched rather than
                  redesigned, for the same reason link_pills was. */}
              <Link
                href={tool.href}
                className="group flex items-center gap-4 rounded-xl2 border border-slate-100 p-5 shadow-card transition hover:border-brand-teal hover:shadow-cardHover"
              >
                {Icon && (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                    <Icon size={20} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-tight text-brand-ink">{tool.title}</span>
                  {tool.subtitle && (
                    <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{tool.subtitle}</span>
                  )}
                </span>
                <ChevronRight
                  size={20}
                  className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-emerald"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const toolCards: SectionDefinition<typeof schema> = {
  type: "tool_cards",
  version: 1,
  label: "การ์ดเครื่องมือ",
  description: "รายการเครื่องมือหรือผู้ช่วย พร้อมไอคอนและลิงก์",
  category: "content",
  schema,
  defaults: {
    heading: "",
    items: [
      { icon: "sparkles", title: "ประเมินผิวด้วย AI", subtitle: "ถ่ายรูปแล้วให้ช่วยอ่านสภาพผิว", href: "/skin-coach" },
      { icon: "message", title: "คุยกับน้อง Smoothie", subtitle: "ถามเรื่องสินค้าหรืออาการที่กังวล", href: "/chat" },
    ],
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อกลุ่ม" },
    {
      key: "items",
      type: "json",
      label: "เครื่องมือ",
      help: `แต่ละอัน: icon, title, subtitle, href — ไอคอนที่เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}`,
    },
  ],
  enabledOn: ["page", "system"],
  Component,
};
