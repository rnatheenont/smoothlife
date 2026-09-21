import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Truck, Star } from "lucide-react";
import { brands, isHouseBrand } from "@/data/brands";
import { groupBrandProducts } from "@/lib/brand-groups";
import { formatTHB } from "@/lib/format";
import { brandFacts, brandSeoDefaults } from "@/lib/brand-seo";
import { brandJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { withSeoOverride } from "@/lib/seo-overrides";
import ProductCard from "@/components/ProductCard";
import StarRating from "@/components/StarRating";

// One page per brand.
//
// Until now every brand lived at /brands#<slug> — an anchor on a page listing
// all 65 of them. Someone searching a brand name (the most-searched kind of
// term this shop has, and the kind a brand's own retailer can actually rank
// for) landed on a directory and had to find the logo. This is the page that
// term deserves: the brand's own catalogue, sorted into the kinds of thing it
// sells, with the numbers taken from the live catalogue rather than written
// by hand.

const PER_GROUP = 8;

export function generateStaticParams() {
  return brands.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const facts = brandFacts(params.slug);
  if (!facts) return { title: "ไม่พบแบรนด์ | Smoothlife.com" };

  const meta = await withSeoOverride("brand", params.slug, brandSeoDefaults(facts));
  return {
    title: meta.title,
    description: meta.description,
    // A brand whose whole range is out of stock has nothing to sell and
    // nothing to rank for. The page stays reachable — it is linked from
    // /brands and people do arrive on it — but asking Google to index an
    // empty shelf earns the site a thin page and the visitor a dead end.
    ...(facts.items.length === 0 ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/brands/${params.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `/brands/${params.slug}`,
      ...(facts.brand.image ? { images: [{ url: facts.brand.image }] } : {}),
    },
  };
}

export default async function BrandHubPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const facts = brandFacts(params.slug);
  if (!facts) notFound();

  const { brand, items, reviews, rating, minPrice, categoryNames } = facts;
  const groups = groupBrandProducts(items);
  // Most-reviewed first: the only popularity signal in the catalogue that is
  // real (`sold` is 0 for every item here), so it is the one we use. Skipped
  // for a small brand, where "most reviewed" would just be the same four
  // products the shopper is about to scroll past.
  const bestsellers =
    items.length > PER_GROUP ? [...items].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4) : [];

  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "แบรนด์ทั้งหมด", href: "/brands" },
    { label: brand.name },
  ];

  return (
    <div className="container-page py-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(brandJsonLd(brand)) }} />

      <nav aria-label="breadcrumb" className="mb-5 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-800">
          หน้าแรก
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/brands" className="hover:text-brand-800">
          แบรนด์ทั้งหมด
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-brand-ink" translate="no">
          {brand.name}
        </span>
      </nav>

      <header className="rounded-xl2 border border-surface-line bg-brand-gradient-soft p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          {brand.image && (
            <div className="relative h-20 w-44 shrink-0 rounded-xl bg-white p-3 shadow-card md:h-24 md:w-56">
              <Image src={brand.image} alt={brand.name} fill priority className="object-contain" sizes="224px" />
            </div>
          )}
          <div className="min-w-0">
            {isHouseBrand(brand.slug) && (
              <span className="mb-2 inline-block rounded-full bg-brand-gradient px-2.5 py-0.5 text-[11px] font-bold text-white">
                แบรนด์ในเครือ Life So Smooth
              </span>
            )}
            <h1 className="text-2xl font-bold text-brand-ink md:text-3xl" translate="no">
              {brand.name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 md:text-base">{brand.tagline}</p>
            {categoryNames.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">หมวดสินค้า: {categoryNames.join(" · ")}</p>
            )}
          </div>
        </div>

        {/* The numbers a shopper weighs before scrolling: how much there is,
            what people said, and where the prices start. Every one of them is
            counted from the catalogue on this page, so none can go stale. */}
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-white px-4 py-3">
            <dt className="text-[11px] text-slate-500">สินค้าพร้อมส่ง</dt>
            <dd className="text-lg font-bold text-brand-ink">{items.length} รายการ</dd>
          </div>
          {rating > 0 && (
            <div className="rounded-lg bg-white px-4 py-3">
              <dt className="text-[11px] text-slate-500">คะแนนรีวิวเฉลี่ย</dt>
              <dd className="flex items-center gap-1.5 text-lg font-bold text-brand-ink">
                {rating.toFixed(1)}
                <StarRating rating={rating} size={13} />
              </dd>
            </div>
          )}
          {reviews > 0 && (
            <div className="rounded-lg bg-white px-4 py-3">
              <dt className="text-[11px] text-slate-500">รีวิวจากผู้ซื้อ</dt>
              <dd className="text-lg font-bold text-brand-ink">{reviews.toLocaleString("th-TH")}</dd>
            </div>
          )}
          {minPrice > 0 && (
            <div className="rounded-lg bg-white px-4 py-3">
              <dt className="text-[11px] text-slate-500">ราคาเริ่มต้น</dt>
              <dd className="text-lg font-bold text-brand-ink">{formatTHB(minPrice)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-brand-emerald" aria-hidden="true" /> ของแท้ 100% มี อย.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck size={15} className="text-brand-emerald" aria-hidden="true" /> ส่งฟรีทั่วไทย ไม่มียอดขั้นต่ำ
          </span>
          <Link
            href={`/shop?brand=${brand.slug}`}
            className="font-bold text-brand-800 underline-offset-2 hover:underline"
          >
            ดูสินค้าทั้งหมดพร้อมตัวกรอง →
          </Link>
        </div>
      </header>

      {items.length === 0 && (
        <section className="mt-8 rounded-xl2 border border-surface-line bg-surface-mist p-8 text-center">
          <p className="font-bold text-brand-ink">สินค้าของแบรนด์นี้หมดชั่วคราว</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            ตอนนี้ยังไม่มีสินค้าของแบรนด์นี้พร้อมส่ง ลองดูแบรนด์อื่นในหมวดเดียวกัน หรือทักแชทให้ทีมงานแจ้งเมื่อของเข้า
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm font-bold">
            <Link href="/shop" className="rounded-full bg-brand-gradient px-5 py-2 text-white">
              ดูสินค้าทั้งหมด
            </Link>
            <Link href="/brands" className="rounded-full border border-surface-line bg-white px-5 py-2 text-brand-ink">
              ดูแบรนด์อื่น
            </Link>
          </div>
        </section>
      )}

      {groups.length > 1 && (
        <nav aria-label="ประเภทสินค้า" className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <a
              key={g.key}
              href={`#${g.key}`}
              className="rounded-full border border-surface-line bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:border-brand-teal hover:text-brand-800"
            >
              {g.label} ({g.items.length})
            </a>
          ))}
        </nav>
      )}

      {bestsellers.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-ink md:text-xl">
            <Star size={18} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            สินค้า<span translate="no">{brand.name}</span>ที่มีคนรีวิวมากที่สุด
          </h2>
          <p className="mb-4 text-xs text-slate-500">เรียงจากจำนวนรีวิวจริงของผู้ซื้อบนเว็บไซต์</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {bestsellers.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.key} id={group.key} className="mt-10 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-ink md:text-xl">
              {group.label} <span className="text-sm font-normal text-slate-500">({group.items.length} รายการ)</span>
            </h2>
            {group.items.length > PER_GROUP && (
              <Link
                href={`/shop?brand=${brand.slug}`}
                className="shrink-0 text-xs font-bold text-brand-800 underline-offset-2 hover:underline"
              >
                ดูทั้งหมด →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {group.items.slice(0, PER_GROUP).map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      ))}

      {/* Every product the brand sells, as plain links. The grids above stop
          at eight per section to keep the page light; this is how the rest
          stay one click from here — for a shopper scanning for a name, and
          for a crawler that would otherwise never reach them. */}
      {items.length > PER_GROUP && (
        <section className="mt-12 rounded-xl2 border border-surface-line bg-surface-mist p-5">
          <h2 className="mb-3 text-sm font-bold text-brand-ink">
            สินค้า<span translate="no">{brand.name}</span>ทั้งหมด ({items.length} รายการ)
          </h2>
          <ul className="grid gap-x-6 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.slug}>
                <Link href={`/product/${p.slug}`} className="underline-offset-2 hover:text-brand-800 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-sm">
        <Link href="/brands" className="font-bold text-brand-800 underline-offset-2 hover:underline">
          ดูแบรนด์อื่นทั้งหมด
        </Link>
      </p>
    </div>
  );
}
