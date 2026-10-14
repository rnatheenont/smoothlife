import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { contentIcon, CONTENT_ICON_KEYS } from "../shared/content-icons";

// A page that is only a message: no signal, nothing here, nothing found.
//
// These pages are not a header with content under them — they are one
// centred block, and that is the whole page. Trying to build them out of
// page_header and cta_card would give a left-aligned title with a green card
// under it, which is a different page that happens to contain the same words.
//
// The mark at the top is either a drawn icon in a soft circle (the offline
// page) or the mascot (the 404). One or the other, never both: this is a
// moment to say one thing.

const schema = z.object({
  icon: z.string().default(""),
  image: z.string().default(""),
  /** Big and gradient-filled, the way the 404 draws its number. */
  display: z.string().max(12).default(""),
  title: z.string().max(160).default(""),
  body: z.string().max(600).default(""),
  button: z.string().max(40).default(""),
  href: z.string().default(""),
  /** The 404 sits in a page of its own; the offline page fills the screen it
   *  is apologising for. */
  fill: z.boolean().default(false),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const Icon = contentIcon(settings.icon);

  return (
    <div
      className={
        settings.fill
          ? "container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center"
          : "container-page py-24 text-center"
      }
    >
      {settings.image ? (
        <span className="relative mx-auto block h-28 w-28">
          <Image src={settings.image} alt="" fill sizes="112px" className="object-contain" />
        </span>
      ) : (
        Icon && (
          <span className="grid size-16 place-items-center rounded-full bg-surface-soft text-brand-800">
            <Icon size={28} aria-hidden />
          </span>
        )
      )}

      {settings.display && (
        <h1 className="brand-text-gradient mb-3 mt-4 text-4xl font-bold">{settings.display}</h1>
      )}
      {settings.title &&
        (settings.display ? (
          <p className="mb-6 text-slate-500">{settings.title}</p>
        ) : (
          <h1 className="mt-5 text-xl font-bold text-brand-ink">{settings.title}</h1>
        ))}
      {settings.body && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{settings.body}</p>
      )}

      {/* Two buttons, and the difference is not decoration. A page that
          fills the screen may be the only thing in front of someone with no
          signal, so its button is a 44px touch target of its own; a 404 sits
          in a normal page and uses the shop's standard button, from the
          shared component so it stays in step with every other one. */}
      {settings.button &&
        settings.href &&
        (settings.fill ? (
          <Link
            href={settings.href}
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-action px-7 text-sm font-semibold text-white"
          >
            {settings.button}
          </Link>
        ) : (
          <Button size="lg" href={settings.href}>
            {settings.button}
          </Button>
        ))}
    </div>
  );
}

export const pageState: SectionDefinition<typeof schema> = {
  type: "page_state",
  version: 1,
  label: "หน้าแจ้งสถานะ",
  description: "ข้อความกลางหน้าพร้อมปุ่มเดียว — ใช้กับหน้า 404 และหน้าออฟไลน์",
  category: "content",
  schema,
  defaults: {
    icon: "",
    image: "",
    display: "",
    title: "ไม่พบสิ่งที่คุณต้องการ",
    body: "",
    button: "กลับหน้าแรก",
    href: "/",
    fill: false,
  },
  fields: [
    { key: "display", type: "text", label: "ตัวเลขใหญ่", help: 'เช่น "404" — เว้นว่างถ้าไม่ต้องการ' },
    { key: "title", type: "text", label: "ข้อความหลัก" },
    { key: "body", type: "textarea", label: "คำอธิบาย" },
    { key: "image", type: "image", label: "รูป/มาสคอต" },
    {
      key: "icon",
      type: "text",
      label: "ไอคอน (ถ้าไม่ใช้รูป)",
      help: `เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}`,
    },
    { key: "button", type: "text", label: "ข้อความบนปุ่ม" },
    { key: "href", type: "text", label: "ลิงก์ปุ่ม" },
    { key: "fill", type: "toggle", label: "ให้สูงเต็มหน้าจอ" },
  ],
  enabledOn: ["page", "system"],
  maxPerPage: 1,
  Component,
};
