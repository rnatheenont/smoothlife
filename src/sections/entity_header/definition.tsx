import Image from "next/image";
import { z } from "zod";
import { concerns, concernImage } from "@/data/categories";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The item's own banner: its picture, its name over it, its sentence under.
//
// It reads the item from the page it is on rather than from settings, which
// is what makes it a template block: one of these draws every concern page
// there is. The settings are the two things that are a decision rather than
// data — how tall the strip is, and whether the sentence shows at all.

const schema = z.object({
  height: z.enum(["short", "tall"]).default("tall"),
  showDescription: z.boolean().default(true),
});

const HEIGHT: Record<string, string> = { short: "h-36 md:h-48", tall: "h-48 md:h-64" };

type Data = { title: string; alt: string; image: string; description: string };

async function load(_settings: z.output<typeof schema>, ctx: { entity?: { type: string; slug?: string } }): Promise<Data | null> {
  const slug = ctx.entity?.slug;
  const c = concerns.find((x) => x.slug === slug);
  if (!c) return null;
  return { title: c.nameTh, alt: c.name, image: concernImage(c.slug), description: c.description };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  return (
    <section className="container-page pt-8 md:pt-10">
      <div className={`relative mb-8 overflow-hidden rounded-xl2 ${HEIGHT[settings.height] ?? HEIGHT.tall}`}>
        {/* The photos are square portraits and this banner is a wide strip, so a
            centred crop lands on a chin. Pulled up to keep the face in frame. */}
        <Image src={data.image} alt={data.alt} fill className="object-cover object-[50%_35%]" />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 max-w-xl p-6 text-white">
          <h1 className="text-2xl font-bold md:text-3xl">{data.title}</h1>
          {settings.showDescription && data.description && (
            <p className="mt-1 text-sm text-white/80">{data.description}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export const entityHeader: SectionDefinition<typeof schema> = {
  type: "entity_header",
  version: 1,
  label: "แบนเนอร์ของสิ่งที่หน้านี้พูดถึง",
  description: "รูป ชื่อ และคำบรรยายของปัญหาผิวที่หน้านี้กำลังแสดง — ดึงจากข้อมูลเอง",
  category: "hero",
  schema,
  defaults: { height: "tall", showDescription: true },
  fields: [
    {
      key: "height",
      type: "select",
      label: "ความสูงของแถบ",
      options: [
        ["short", "เตี้ย"],
        ["tall", "สูง"],
      ],
    },
    { key: "showDescription", type: "toggle", label: "แสดงคำบรรยาย" },
  ],
  enabledOn: ["template"],
  requiresEntity: ["concern"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};
