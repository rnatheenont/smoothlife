import { Facebook, MessageCircle, Phone } from "lucide-react";
import { z } from "zod";
import { type ContactInfo } from "@/lib/pages/contact";
import { contactInfo } from "@/lib/pages/contact-server";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The ways to reach the shop, on a page.
//
// It has no fields for a phone number, and that is the point: the numbers
// come from the global contact document, so the three pages that show them
// cannot drift apart again. What a page chooses is how they look, not what
// they say.

const schema = z.object({
  heading: z.string().max(120).default(""),
  style: z.enum(["cards", "tiles"]).default("cards"),
});

async function load(): Promise<ContactInfo> {
  return contactInfo();
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, ContactInfo>) {
  // No data means the loader failed, and a contact block with no contacts is
  // worse than no block.
  if (!data) return null;

  if (settings.style === "tiles") {
    return (
      <section className="container-page pb-8 md:pb-10">
        <div className="mb-6 grid grid-cols-3 gap-3">
          <a href={data.phoneHref} className="flex flex-col items-center gap-1.5 rounded-xl2 p-4 shadow-card">
            <Phone size={18} className="text-brand-emerald" />
            <span className="text-xs font-medium">โทรหาเรา</span>
          </a>
          <a
            href={data.facebookUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex flex-col items-center gap-1.5 rounded-xl2 p-4 shadow-card"
          >
            <Facebook size={18} className="text-brand-emerald" />
            <span className="text-xs font-medium">Facebook</span>
          </a>
          <a
            href={data.lineChatUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex flex-col items-center gap-1.5 rounded-xl2 p-4 shadow-card"
          >
            <MessageCircle size={18} className="text-brand-emerald" />
            <span className="text-xs font-medium">LINE OA</span>
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page pb-8 md:pb-10">
      <div className="rounded-xl2 bg-surface-soft p-6">
        {settings.heading && <h2 className="mb-3 font-bold text-brand-ink">{settings.heading}</h2>}
        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-brand-ink">โทรศัพท์</p>
            <p>
              {data.phoneDisplay} ({data.hours})
            </p>
          </div>
          <div>
            <p className="font-semibold text-brand-ink">Facebook</p>
            <p>
              <a
                href={data.facebookUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-brand-800"
              >
                ทักแชท Facebook
              </a>
            </p>
          </div>
          <div>
            <p className="font-semibold text-brand-ink">LINE Official</p>
            <p>{data.lineHandle}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export const contactChannels: SectionDefinition<typeof schema> = {
  type: "contact_channels",
  version: 1,
  label: "ช่องทางติดต่อ",
  description: "แสดงเบอร์โทร Facebook และ LINE จากข้อมูลติดต่อกลาง — แก้ตัวเลขที่ส่วนกลางที่เดียว",
  category: "content",
  schema,
  defaults: { heading: "ติดต่อฝ่ายบริการลูกค้า", style: "cards" },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    {
      key: "style",
      type: "select",
      label: "รูปแบบ",
      options: [
        ["cards", "กล่องพื้นอ่อน 3 ช่อง"],
        ["tiles", "ปุ่มไอคอน 3 ปุ่ม"],
      ],
    },
  ],
  enabledOn: ["page", "system"],
  maxPerPage: 1,
  load,
  Component,
};
