import { z } from "zod";
import HeroTrio from "@/components/home/HeroTrio";
import HeroCarousel from "@/components/HeroCarousel";
import { heroBanners } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The campaign artwork at the top of the page.
//
// Three sources, in order of how current they are: the slideshow the team
// publishes on www.smoothlife.com, then the Shopify theme file, then the
// static list in the repo. That order is the whole feature — an edit made in
// Shopify shows up here without a deploy — so it stays in the loader rather
// than becoming something an admin picks from a dropdown and gets wrong.

const schema = z.object({
  /** Fall back to the list in the repo without trying the network. For a
   *  campaign page that wants fixed artwork rather than whatever the shop is
   *  running this week. */
  useStorefront: z.boolean().default(true),
});

type Banners = Awaited<ReturnType<typeof getStorefrontHeroBanners>>;

async function load(settings: z.output<typeof schema>): Promise<Banners> {
  if (!settings.useStorefront) return null;
  const storefront = await getStorefrontHeroBanners();
  return storefront ?? (await getLiveHeroBanners());
}

function Component({ data }: SectionProps<z.output<typeof schema>, Banners>) {
  // `data` is undefined when the loader threw, null when neither remote
  // source answered — both mean the same thing here: use what we shipped.
  const banners = data ?? heroBanners;
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

export const heroBannersSection: SectionDefinition<typeof schema> = {
  type: "hero_banners",
  version: 1,
  label: "แบนเนอร์แคมเปญ",
  description: "สไลด์แบนเนอร์หลัก ดึงจากหน้าร้าน smoothlife.com อัตโนมัติ",
  category: "hero",
  schema,
  defaults: { useStorefront: true },
  fields: [
    {
      key: "useStorefront",
      type: "toggle",
      label: "ดึงแบนเนอร์จากหน้าร้านอัตโนมัติ",
      help: "ปิดเมื่อต้องการใช้ภาพชุดที่ตั้งไว้ในโค้ดเท่านั้น",
    },
  ],
  enabledOn: ["home", "campaign"],
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};
