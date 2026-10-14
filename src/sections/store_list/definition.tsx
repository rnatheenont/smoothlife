import { Clock, MapPin, Phone } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The branches, two to a row.
//
// It replaces src/data/stores.ts. A shop's opening hours change for a public
// holiday and a branch moves; neither is a reason to deploy, and both are
// things the people who know sit nowhere near the repository.
//
// The phone number per branch stays a field here rather than coming from the
// global contact details: those are the customer-service line, and a branch's
// own number is a different number.

const store = z.object({
  name: z.string().max(120).default(""),
  address: z.string().max(300).default(""),
  hours: z.string().max(80).default(""),
  phone: z.string().max(40).default(""),
});

const schema = z.object({
  items: z.array(store).max(40).default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const items = settings.items.filter((s) => s.name);
  if (items.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mb-10 grid gap-5 md:grid-cols-2">
        {items.map((s, i) => (
          <div key={s.name || i} className="rounded-xl2 p-5 shadow-card">
            <h3 className="mb-2 font-bold text-brand-ink">{s.name}</h3>
            {s.address && (
              <div className="mb-1.5 flex items-start gap-2 text-sm text-slate-600">
                <MapPin size={15} className="mt-0.5 shrink-0 text-brand-emerald" /> {s.address}
              </div>
            )}
            {s.hours && (
              <div className="mb-1.5 flex items-center gap-2 text-sm text-slate-600">
                <Clock size={15} className="shrink-0 text-brand-emerald" /> {s.hours}
              </div>
            )}
            {s.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={15} className="shrink-0 text-brand-emerald" /> {s.phone}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export const storeList: SectionDefinition<typeof schema> = {
  type: "store_list",
  version: 1,
  label: "รายชื่อสาขา",
  description: "การ์ดสาขา: ชื่อ ที่อยู่ เวลาทำการ และเบอร์โทรของสาขา",
  category: "content",
  schema,
  defaults: {
    items: [{ name: "สาขาใหม่", address: "", hours: "ทุกวัน 10:00 - 21:00", phone: "" }],
  },
  fields: [
    {
      key: "items",
      type: "list",
      label: "สาขา",
      item: "สาขา",
      max: 40,
      columns: [
        { key: "name", label: "ชื่อสาขา" },
        { key: "address", label: "ที่อยู่", type: "textarea" },
        { key: "hours", label: "เวลาทำการ", half: true },
        { key: "phone", label: "เบอร์โทรสาขา", half: true },
      ],
    },
  ],
  enabledOn: ["page", "system"],
  maxPerPage: 1,
  Component,
};
