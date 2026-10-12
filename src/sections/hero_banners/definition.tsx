import { z } from "zod";
import HeroTrio from "@/components/home/HeroTrio";
import HeroCarousel from "@/components/HeroCarousel";
import { heroBanners, type HeroBanner } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";
import type { CheckIssue, SectionDefinition, SectionProps } from "@/lib/pages/types";

// The campaign artwork at the top of the page.
//
// Two ways to fill it, and the toggle is the whole decision:
//
//   on  — whatever the team is running on www.smoothlife.com right now. The
//         slideshow published there, then the Shopify theme file, then the
//         list in the repo, in that order of how current they are. An edit
//         made in Shopify shows up here without a deploy, which is the point
//         of the automatic mode, so the order stays in the loader rather
//         than becoming something an admin picks and gets wrong.
//   off — the slides chosen below: our own pictures from the media library
//         and our own links. For a campaign page that wants fixed artwork,
//         and for the home page on a week when the shop's slideshow is not
//         what this page should be saying.
//
// With the toggle off and nothing chosen yet, the page still draws the list
// in the repo rather than a hole where the banners were.

const slideSchema = z.object({
  image: z.string().default(""),
  /** The phone crop. Empty means "use the wide one on the phone too". */
  mobileImage: z.string().default(""),
  href: z.string().default(""),
  /** Shown to nobody; read aloud by a screen reader and read by Google.
   *  HeroTrio and HeroCarousel both use `title` as the image's alt text. */
  title: z.string().default(""),
});

const schema = z.object({
  useStorefront: z.boolean().default(true),
  slides: z.array(slideSchema).max(8).default([]),
});

type Settings = z.output<typeof schema>;
type Banners = Awaited<ReturnType<typeof getStorefrontHeroBanners>>;

/**
 * The chosen slides, as banners.
 *
 * A slide with no picture is one someone is still filling in, not a blank
 * banner to render; a slide with no link is dropped for the same reason the
 * publish check refuses it — both components wrap the picture in a link and
 * there is nowhere for an empty one to go.
 */
function ownBanners(settings: Settings): HeroBanner[] {
  return settings.slides
    .filter((s) => s.image.trim() && s.href.trim())
    .map((s, i) => ({
      slug: `slide-${i + 1}`,
      title: s.title || undefined,
      image: s.image,
      mobileImage: s.mobileImage || undefined,
      href: s.href,
    }));
}

async function load(settings: Settings): Promise<Banners> {
  if (!settings.useStorefront) return null;
  const storefront = await getStorefrontHeroBanners();
  return storefront ?? (await getLiveHeroBanners());
}

function Component({ settings, data }: SectionProps<Settings, Banners>) {
  // `data` is undefined when the loader threw, null when neither remote
  // source answered or the automatic mode is off — all of them mean the
  // same thing here: draw what we have.
  const own = settings.useStorefront ? [] : ownBanners(settings);
  const banners = own.length > 0 ? own : (data ?? heroBanners);
  return (
    <section className="relative bg-white lg:pb-12">
      {/* Three across on a wide screen, one full-bleed slide on a phone —
          two components rather than one with a mode, see HeroTrio. */}
      <HeroTrio banners={banners} />
      <div className="lg:hidden">
        <HeroCarousel banners={banners} />
      </div>
    </section>
  );
}

/**
 * Asked before publishing.
 *
 * A half-filled slide is the mistake this catches: the picture is chosen,
 * the link box is still empty, and the slide disappears from the page
 * without anything saying so. That is an error rather than a warning
 * because the alternative — publishing a banner nobody can click — is not a
 * thing anyone means to do.
 */
async function check(settings: Settings): Promise<CheckIssue[]> {
  if (settings.useStorefront) return [];
  const issues: CheckIssue[] = [];

  settings.slides.forEach((slide, i) => {
    const n = i + 1;
    if (slide.image.trim() && !slide.href.trim()) {
      issues.push({ level: "error", message: `สไลด์ ${n}: ใส่ลิงก์ด้วย — แบนเนอร์ทุกใบต้องกดได้` });
    }
    if (slide.href.trim() && !slide.image.trim()) {
      issues.push({ level: "error", message: `สไลด์ ${n}: ยังไม่ได้เลือกรูป` });
    }
  });

  // One line for all of them, not one each: banners brought in from the shop
  // arrive without descriptions — the slideshow there has none to give — so
  // the usual case is every slide at once, and five copies of the same
  // sentence is how a warning gets skipped past.
  const noDescription = settings.slides
    .map((slide, i) => (slide.image.trim() && !slide.title.trim() ? i + 1 : 0))
    .filter(Boolean);
  if (noDescription.length > 0) {
    issues.push({
      level: "warning",
      message: `สไลด์ ${noDescription.join(", ")}: ยังไม่มีคำอธิบายภาพ — คนที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าเป็นรูปอะไร`,
    });
  }

  if (ownBanners(settings).length === 0) {
    issues.push({
      level: "warning",
      message: "ปิดการดึงอัตโนมัติไว้แต่ยังไม่ได้เลือกสไลด์ — หน้าเว็บจะใช้ภาพชุดเดิมในโค้ด",
    });
  }

  return issues;
}

export const heroBannersSection: SectionDefinition<typeof schema> = {
  type: "hero_banners",
  version: 2,
  label: "แบนเนอร์แคมเปญ",
  description: "สไลด์แบนเนอร์หลัก ดึงจากหน้าร้าน smoothlife.com อัตโนมัติ หรือเลือกรูปและลิงก์เอง",
  category: "hero",
  schema,
  defaults: { useStorefront: true, slides: [] },
  fields: [
    {
      key: "useStorefront",
      type: "toggle",
      label: "ดึงแบนเนอร์จากหน้าร้านอัตโนมัติ",
      help: "ปิดเพื่อใช้สไลด์ที่เลือกเองด้านล่าง",
    },
    {
      key: "slides",
      type: "banners",
      label: "สไลด์ของเราเอง",
      max: 8,
      help: "ใช้เมื่อปิดการดึงอัตโนมัติ · เรียงจากบนลงล่างตามที่จะแสดง",
      // Editing what the shop is showing starts by having it: the button
      // copies the banners being pulled right now into the list, where the
      // link, the order and the pictures are all editable. It also turns
      // the automatic mode off, because a copy that the page ignores is
      // the one thing more confusing than not being able to edit it.
      importFrom: {
        url: "/api/admin/hero-banners",
        label: "ดึงแบนเนอร์ที่ใช้อยู่มาแก้",
        also: { useStorefront: false },
        help: "คัดลอกแบนเนอร์ชุดที่กำลังแสดงอยู่เข้ามาเป็นสไลด์ของเรา แล้วแก้รูป ลิงก์ และลำดับได้ · ตั้งแต่นั้นหน้านี้จะไม่เปลี่ยนตามหน้าร้านอีก จนกว่าจะเปิดสวิตช์กลับ",
      },
    },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  isLcpCandidate: true,
  // No migrate(), on purpose. v1 stored only `useStorefront`, and the
  // missing `slides` key is filled by the schema's own default, so a v1
  // section needs nothing done to it.
  //
  // Writing one would have been worse than useless here: nothing rewrites
  // the `v` a section was saved with — the editor replaces settings and
  // leaves the number alone — so a section saved at v1 stays at v1 while
  // its settings move on. A migrate that said "coming from v1, so slides
  // is []" would therefore run on every single render, and wipe the slides
  // someone had just chosen, every time, while the editor went on showing
  // them. Migrations of this shape have to add what is missing, never
  // replace what is there.
  load,
  check,
  Component,
};
