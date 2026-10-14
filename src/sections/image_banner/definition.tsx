import Link from "next/link";
import { z } from "zod";
import { srcSetFor } from "@/lib/media";
import { mediaSourcesFor } from "@/lib/media-lookup";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// One picture, optionally a link.
//
// alt is required rather than optional, and the schema enforces it. A banner
// is often the only thing in its part of the page, so a missing alt is not a
// small omission — it is a section that does not exist for anyone using a
// screen reader, and nobody notices because the page looks finished.
//
// A picture that is purely decorative is handled by saying so explicitly,
// which writes alt="" and keeps it out of the reading order on purpose.

const schema = z.object({
  // Allowed to be empty, deliberately. A banner is added before its picture
  // is chosen — that is the order the work happens in — so the schema has to
  // let a draft exist without one. Publishing is where it becomes an error;
  // see `check` below. Validation is lenient while drafting and strict at
  // the moment it would reach a customer.
  src: z.string().default(""),
  alt: z.string().max(200).default(""),
  decorative: z.boolean().default(false),
  href: z.string().default(""),
  width: z.enum(["page", "full"]).default("page"),
  rounded: z.boolean().default(true),
  // The drawn size, so the browser can keep the space before it loads
  // instead of shifting everything under it when the picture arrives.
  ratio: z.enum(["16/9", "4/3", "3/1", "1/1"]).default("16/9"),
});

async function load(settings: z.output<typeof schema>) {
  // The three stored widths for this picture, when it came from the library.
  return settings.src ? mediaSourcesFor(settings.src) : null;
}

function Component({
  settings,
  data,
  index,
}: SectionProps<z.output<typeof schema>, Record<string, string> | null>) {
  if (!settings.src) return null;

  const picture = (
    <div
      className={`relative w-full overflow-hidden ${settings.rounded && settings.width === "page" ? "rounded-xl2" : ""}`}
      style={{ aspectRatio: settings.ratio.replace("/", " / ") }}
    >
      {/* A plain img, not next/image: the project runs with
          images.unoptimized (Vercel's optimiser ran out of quota), so
          next/image would serve the one file it was given and the three
          widths the library stored would never be used. srcset is what
          makes them worth storing — the browser picks, and a phone stops
          downloading a banner drawn for a desktop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={settings.src}
        srcSet={srcSetFor(data ?? undefined)}
        sizes={settings.width === "full" ? "100vw" : "(min-width: 1536px) 1512px, 100vw"}
        alt={settings.decorative ? "" : settings.alt}
        // The first section on a page is usually what the browser measures
        // the page's speed by; everything below it can wait until it is
        // nearly on screen.
        loading={index === 0 ? "eager" : "lazy"}
        fetchPriority={index === 0 ? "high" : undefined}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );

  const inner = settings.href ? (
    <Link href={settings.href} className="block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40">
      {picture}
    </Link>
  ) : (
    picture
  );

  return <section className={settings.width === "page" ? "container-page py-4 md:py-6" : ""}>{inner}</section>;
}

export const imageBanner: SectionDefinition<typeof schema> = {
  type: "image_banner",
  version: 1,
  label: "แบนเนอร์รูป",
  description: "รูปเดียวเต็มความกว้าง กดแล้วไปหน้าอื่นได้",
  category: "hero",
  schema,
  defaults: {
    src: "",
    alt: "",
    decorative: false,
    href: "",
    width: "page",
    rounded: true,
    ratio: "16/9",
  },
  fields: [
    { key: "src", type: "image", label: "รูป" },
    { key: "alt", type: "text", label: "คำบรรยายรูป", help: "สำหรับคนที่ใช้โปรแกรมอ่านหน้าจอ — บอกว่ารูปนี้สื่ออะไร" },
    { key: "decorative", type: "toggle", label: "เป็นรูปประดับ ไม่ต้องอ่าน", help: "เปิดเมื่อรูปไม่ได้บอกข้อมูลอะไรเพิ่ม" },
    { key: "href", type: "text", label: "ลิงก์เมื่อกด (ไม่ใส่ = กดไม่ได้)" },
    { key: "ratio", type: "select", label: "สัดส่วนรูป", options: [["16/9", "16:9"], ["4/3", "4:3"], ["3/1", "3:1 (แบนกว้าง)"], ["1/1", "จัตุรัส"]] },
    { key: "width", type: "select", label: "ความกว้าง", options: [["page", "เท่าเนื้อหา"], ["full", "เต็มจอ"]] },
    { key: "rounded", type: "toggle", label: "มุมมน" },
  ],
  enabledOn: ["home", "page", "campaign", "brand", "system", "template"],
  isLcpCandidate: true,
  load,
  // Published without a picture the section would be an empty hole the height
  // of a banner, which is worse than it being absent.
  check: async (settings) =>
    settings.src
      ? settings.decorative || settings.alt.trim()
        ? []
        : [{ level: "error", message: "แบนเนอร์รูปยังไม่มีคำบรรยายรูป — ใส่คำบรรยาย หรือระบุว่าเป็นรูปประดับ" }]
      : [{ level: "error", message: "แบนเนอร์รูปยังไม่ได้ใส่รูป" }],
  Component,
};
