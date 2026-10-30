import Link from "next/link";
import Image from "next/image";
import { concerns, concernImage } from "@/data/categories";
import ShopHero from "@/components/shop/ShopHero";
import { ALL_PRODUCTS_BANNER } from "@/lib/category-banner";
import { pageMetadata } from "@/lib/site-pages";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";

export function generateMetadata() {
  return pageMetadata("concern");
}

function ConcernHubPageWritten() {
  return (
    <>
      {/* The same banner /shop wears. */}
      <ShopHero
        eyebrow="CONCERNS"
        title="ช้อปตามปัญหาผิวที่กังวล"
        subtitle="เลือกดูผลิตภัณฑ์ที่ตรงกับความต้องการของผิวคุณ พร้อมคำแนะนำจากผู้เชี่ยวชาญ"
        banner={ALL_PRODUCTS_BANNER}
      />

      <div className="container-page py-8 md:py-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        {concerns.map((c) => (
          <Link key={c.slug} href={`/concern/${c.slug}`} className="group rounded-xl2 overflow-hidden shadow-card">
            <div className="relative aspect-4/3">
              <Image src={concernImage(c.slug)} alt={c.name} fill className="object-cover object-[50%_35%] transition-transform duration-500" />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 p-4 text-white">
                <h3 className="font-bold">{c.nameTh}</h3>
                <p className="text-xs text-white/80 mt-1 line-clamp-2">{c.description}</p>
              </div>
            </div>
          </Link>
        ))}
        <Link href="/advisor" className="rounded-xl2 border-2 border-dashed border-brand-teal flex flex-col items-center justify-center text-center p-6 aspect-4/3">
          <p className="font-bold text-brand-ink">ไม่แน่ใจว่าผิวคุณกังวลเรื่องอะไร?</p>
          <span className="text-sm text-brand-800 font-semibold mt-2">ให้น้อง Smoothie ช่วยประเมิน →</span>
        </Link>
      </div>
      </div>
    </>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function ConcernHubPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="concern-hub" />;
  return <ConcernHubPageWritten />;
}
