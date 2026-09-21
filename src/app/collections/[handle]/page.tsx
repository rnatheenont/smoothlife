import Image from "next/image";
import { notFound } from "next/navigation";
import { collections, getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import ProductCard from "@/components/ProductCard";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { ogImages, withSeoOverride } from "@/lib/seo-overrides";

// One page per real Shopify collection. These are the merchandising groups the
// marketing team actually maintains (clearance-sale, buy-1-get-1-free-deal,
// brand pushes…), mirrored at build time — deliberately separate from
// /shop/[category], whose six categories are a fixed taxonomy the advisors and
// filters depend on and which must not churn every time a campaign launches.
export function generateStaticParams() {
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata(props: { params: Promise<{ handle: string }> }) {
  const params = await props.params;
  const c = getCollectionByHandle(params.handle);
  if (!c) return { title: "ไม่พบคอลเลกชัน | Smoothlife.com" };
  const meta = await withSeoOverride("collection", c.handle, {
    title: `${c.title} | Smoothlife.com`,
    description: c.description?.slice(0, 160) || `ช้อป ${c.title} ที่ Smoothlife.com`,
    image: c.image,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/collections/${c.handle}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `/collections/${c.handle}`,
      ...ogImages(meta.image),
    },
  };
}

export default async function CollectionPage(props: { params: Promise<{ handle: string }> }) {
  const params = await props.params;
  const collection = getCollectionByHandle(params.handle);
  if (!collection) notFound();

  const items = getCollectionProducts(collection);

  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "คอลเลกชัน", href: "/collections" },
    { label: collection.title },
  ];

  return (
    <div className="container-page py-6 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }} />
      <BackButton fallbackHref="/collections" />
      <Breadcrumb items={breadcrumbItems} />

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
        {collection.image && (
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl2 md:h-24 md:w-40">
            <Image src={collection.image} alt={collection.title} fill className="object-cover" sizes="160px" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">{collection.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{items.length} รายการ</p>
          {collection.description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{collection.description}</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
