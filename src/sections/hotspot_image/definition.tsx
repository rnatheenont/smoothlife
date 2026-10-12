import { z } from "zod";
import Link from "next/link";
import { mediaSourcesFor } from "@/lib/media-lookup";
import { srcSetFor } from "@/lib/media";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// One picture with several things in it you can tap.
//
// The points are stored as percentages, not pixels, because the picture is
// fluid — a hotspot fixed at 420px would be in the right place on one screen
// and in the sky on every other.
//
// The accessibility problem this shape has is real and worth stating: a
// transparent box over a photograph is invisible to anyone not using a mouse
// or a touchscreen, and invisible to anyone who cannot see the photograph at
// all. So the hotspots are rendered twice — as the boxes on the picture, and
// as an ordinary list of links underneath. The list is not a fallback hidden
// behind a media query; it is always there, because it is the version that
// works for everybody.

const spot = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1),
  /** Percent of the picture's width and height, from the top left. */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const schema = z.object({
  image: z.string().default(""),
  alt: z.string().max(140).default(""),
  title: z.string().max(80).default(""),
  spots: z.array(spot).max(12).default([]),
});

type Settings = z.output<typeof schema>;

async function load(settings: Settings) {
  return settings.image ? await mediaSourcesFor(settings.image) : null;
}

function Component({ settings, data }: SectionProps<Settings, Record<string, string> | null>) {
  if (!settings.image || settings.spots.length === 0) return null;

  return (
    <section className="container-page py-6 md:py-10">
      {settings.title && <h2 className="mb-3 text-base font-bold text-brand-ink md:text-lg">{settings.title}</h2>}

      <div className="relative overflow-hidden rounded-xl2">
        {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized
            images project-wide; the library's widths are offered directly. */}
        <img
          src={settings.image}
          srcSet={srcSetFor(data ?? undefined)}
          sizes="(min-width: 768px) 100vw, 100vw"
          alt={settings.alt}
          loading="lazy"
          className="h-auto w-full"
        />
        {settings.spots.map((s) => (
          <Link
            key={`${s.label}-${s.x}-${s.y}`}
            href={s.href}
            // aria-hidden and out of the tab order on purpose: the same links
            // are below as real list items, and having each one twice in the
            // tab order is a worse experience than having the picture be
            // decorative for keyboard users.
            aria-hidden="true"
            tabIndex={-1}
            className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[13px] font-bold shadow-md"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              backgroundColor: "var(--cp-accent)",
              color: "var(--cp-on-accent)",
            }}
          >
            +
          </Link>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {settings.spots.map((s) => (
          <li key={`${s.label}-list`}>
            <Link
              href={s.href}
              className="flex h-10 items-center rounded-full border border-surface-line px-4 text-[13px] font-semibold text-brand-ink"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const hotspotImage: SectionDefinition<typeof schema> = {
  type: "hotspot_image",
  version: 1,
  label: "รูปมีจุดกดได้",
  description: "จุดเก็บเป็น % ของรูป · มีรายการลิงก์ใต้รูปด้วยเสมอ เพื่อให้ใช้ด้วยคีย์บอร์ดและ screen reader ได้",
  category: "promo",
  schema,
  defaults: { image: "", alt: "", title: "", spots: [] },
  fields: [
    { key: "image", type: "image", label: "รูป" },
    { key: "alt", type: "text", label: "คำบรรยายรูป" },
    { key: "title", type: "text", label: "หัวข้อ" },
    {
      key: "spots",
      type: "json",
      label: "จุดที่กดได้",
      help: 'แต่ละจุด: label, href, x, y (เป็น % จากมุมซ้ายบน) เช่น [{"label":"เซรั่ม","href":"/product/x","x":30,"y":55}]',
    },
  ],
  enabledOn: ["campaign", "home", "page", "brand"],
  load,
  check: async (settings) => {
    const issues = [];
    if (!settings.image) issues.push({ level: "error" as const, message: "รูปมีจุดกดได้ยังไม่ได้เลือกรูป" });
    if (settings.spots.length === 0) issues.push({ level: "error" as const, message: "ยังไม่ได้ใส่จุดที่กดได้เลย" });
    if (settings.image && !settings.alt) {
      issues.push({ level: "warning" as const, message: "รูปมีจุดกดได้ยังไม่มีคำบรรยายรูป" });
    }
    return issues;
  },
  Component,
};
