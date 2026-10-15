import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// A dark band that is itself one link: a mark on the left, two lines in the
// middle, an arrow on the right.
//
// The shape the shop already uses to send somebody from a page to the one
// tool that page is about — the skin scanner from the advisor page is the
// first of them. It reads as a door rather than as a card of content, which
// is the whole reason it is dark on a light page.
//
// Separate from advisor_entry, which looks similar and is not the same thing:
// that one is a row per product category, keyed on the category the page is
// about, and it belongs to the category template. This is a single link
// anybody can put on any page.

const schema = z.object({
  title: z.string().max(120).default(""),
  body: z.string().max(400).default(""),
  href: z.string().default(""),
  /** A mark in a gradient circle. Ignored when an image is set. */
  icon: z.string().default(""),
  /** A picture instead of the mark — a mascot, a product. */
  image: z.string().default(""),
  padding: z.enum(["sm", "md"]).default("md"),
  room: z.enum(["sm", "md"]).default("md"),
});

const PADDING: Record<string, string> = { sm: "p-4 md:p-5", md: "p-5 md:p-6" };
const ROOM: Record<string, string> = { sm: "mb-6", md: "mb-8" };

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  if (!settings.title || !settings.href) return null;
  const Icon = settings.image ? null : contentIcon(settings.icon);

  return (
    <section className="container-page">
      <Link
        href={settings.href}
        className={`group flex items-center gap-4 rounded-xl2 bg-brand-ink text-white shadow-cardHover ${
          ROOM[settings.room] ?? ROOM.md
        } ${PADDING[settings.padding] ?? PADDING.md}`}
      >
        {settings.image ? (
          <div className="relative h-12 w-12 shrink-0">
            <Image src={settings.image} alt="" fill sizes="48px" className="object-contain" />
          </div>
        ) : (
          Icon && (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-gradient">
              <Icon size={20} />
            </div>
          )
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{settings.title}</p>
          {settings.body && <p className="mt-0.5 text-xs text-white/80">{settings.body}</p>}
        </div>
        <ChevronRight size={20} className="shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

export const inkLinkCard: SectionDefinition<typeof schema> = {
  type: "ink_link_card",
  version: 1,
  label: "แถบลิงก์พื้นเข้ม",
  description: "แถบสีเข้มที่กดได้ทั้งแถบ — เครื่องหมาย สองบรรทัด และลูกศร",
  category: "promo",
  schema,
  defaults: {
    title: "",
    body: "",
    href: "",
    icon: "sparkles",
    image: "",
    padding: "md",
    room: "md",
  },
  fields: [
    { key: "title", type: "text", label: "บรรทัดหลัก" },
    { key: "body", type: "textarea", label: "บรรทัดรอง" },
    { key: "href", type: "text", label: "ลิงก์" },
    { key: "icon", type: "text", label: "เครื่องหมาย", help: `เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}` },
    { key: "image", type: "image", label: "รูป (ใส่แล้วจะใช้แทนเครื่องหมาย)" },
    {
      key: "padding",
      type: "select",
      label: "ความหนาของแถบ",
      options: [
        ["sm", "บาง"],
        ["md", "หนา"],
      ],
    },
    {
      key: "room",
      type: "select",
      label: "ระยะใต้แถบ",
      options: [
        ["sm", "ชิด"],
        ["md", "ปกติ"],
      ],
    },
  ],
  enabledOn: ["page", "campaign", "system", "template"],
  Component,
};
