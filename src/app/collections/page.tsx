import Image from "next/image";
import Link from "next/link";
import { collections } from "@/data/collections";
import Breadcrumb from "@/components/Breadcrumb";
import ShopHero from "@/components/shop/ShopHero";
import { pageMetadata } from "@/lib/site-pages";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";

export function generateMetadata() {
  return pageMetadata("collections");
}

// Index of the real Shopify collections. Sorted biggest-first because the
// merchandising ones worth browsing (bundles, clearance, brand pages) carry far
// more products than the long tail of one-off campaign groups.
function CollectionsIndexPageWritten() {
  const sorted = [...collections].sort((a, b) => b.productSlugs.length - a.productSlugs.length);

  return (
    <>
      {/* The same banner /shop wears. A page that lists things to browse
          should open the same way wherever you land on it. */}
      <ShopHero
        eyebrow="COLLECTIONS"
        title="คอลเลกชันทั้งหมด"
        subtitle="อัปเดตตรงจากร้าน"
        count={sorted.length}
        countLabel="คอลเลกชัน"
      />

      <div className="container-page py-6 md:py-8">
      <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "คอลเลกชัน" }]} />

      {sorted.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">ยังไม่มีคอลเลกชันในขณะนี้</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {sorted.map((c) => (
            <Link
              key={c.handle}
              href={`/collections/${c.handle}`}
              className="group overflow-hidden rounded-xl2 shadow-card transition-shadow hover:shadow-cardHover"
            >
              <div className="relative aspect-4/3 bg-surface-soft">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    className="object-cover transition-transform"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-brand-gradient-soft text-2xl font-bold text-brand-800/40">
                    {c.title.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-brand-ink">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.productSlugs.length} รายการ</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function CollectionsIndexPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="collections" />;
  return <CollectionsIndexPageWritten />;
}
