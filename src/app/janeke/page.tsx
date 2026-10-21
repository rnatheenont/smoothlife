import Link from "next/link";
import { notFound } from "next/navigation";

import SuperbrushStage from "@/components/brand/SuperbrushStage";
import JanekeDailyRitual from "@/components/janeke/DailyRitual";
import JanekeFaq from "@/components/janeke/Faq";
import JanekeFromItaly from "@/components/janeke/FromItaly";
import JanekeHero from "@/components/janeke/Hero";
import { brandFacts } from "@/lib/brand-seo";
import { formatTHB } from "@/lib/format";
import { janekeModels } from "@/lib/janeke-stage";
import { withCustomImages } from "@/lib/product-images";
import { pageMetadata } from "@/lib/site-pages";

/**
 * The Janeke campaign landing page.
 *
 * Separate from /brands/janeke, which is the catalogue: every product the
 * brand sells, sorted into shelves, for somebody who already knows what they
 * came for. This page is the pitch, and the two share the one piece they
 * both need — the colour picker — rather than keeping two of it.
 */

// The catalogue underneath changes when the shop does, not when somebody
// visits: the same half hour the brand pages use.
export const revalidate = 1800;

// Title, description and the picture a shared link shows now come from the
// site-pages list, so the team can change them in SEO หน้าเว็บ without a
// deploy — the same as every other page there. With no picture chosen, the
// opengraph-image.png beside this file is still the card.
export function generateMetadata() {
  return pageMetadata("janeke");
}

export default async function JanekeLandingPage() {
  const facts = brandFacts("janeke");
  if (!facts) notFound();

  const items = await withCustomImages(facts.items);
  const models = janekeModels(items);
  const from = models.length
    ? Math.min(...models.flatMap((m) => m.items.map((i) => i.price)))
    : null;

  return (
    <main>
      <JanekeHero />

      {/* The colour picker, the same component the brand page stands on. */}
      {models.length > 0 && from !== null && (
        <div id="collection" className="scroll-mt-24">
          <SuperbrushStage
            models={models}
            headline="Find your perfect match"
            intro={`เริ่มต้น ${formatTHB(from)} · เลือกสีที่ใช่ แล้วช้อปได้เลย`}
          />
        </div>
      )}

      <JanekeFromItaly />
      <JanekeDailyRitual />
      <JanekeFaq />

      {/* The way on to the catalogue, for anyone the pitch worked on. */}
      <section className="bg-white px-4 pb-16 text-center md:pb-24">
        <Link
          href="/brands/janeke"
          className="inline-flex items-center gap-2 rounded-full bg-[#685048] px-8 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          ดูสินค้า Jäneke ทั้งหมด
        </Link>
      </section>
    </main>
  );
}
