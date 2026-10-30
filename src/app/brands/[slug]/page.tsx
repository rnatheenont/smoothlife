import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Truck, Star } from "lucide-react";
import { brands, isHouseBrand } from "@/data/brands";
import { groupBrandProducts } from "@/lib/brand-groups";
import { formatTHB } from "@/lib/format";
import { brandFacts, brandSeoDefaults } from "@/lib/brand-seo";
import { brandJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { withSeoOverride, shareMeta } from "@/lib/seo-overrides";
import ProductCard from "@/components/ProductCard";
import { shelfItemClass } from "@/lib/brand-page";
import StarRating from "@/components/StarRating";
import { withCustomImages } from "@/lib/product-images";
import { PAGES_BRAND_ENABLED } from "@/lib/feature-flags";
import { renderSections } from "@/lib/pages/render";
import { publishedDoc } from "@/lib/pages/store";
import { defaultBrandDoc } from "@/lib/pages/default-docs/brand";
import { toCardData } from "@/data/card";
import SuperbrushStage from "@/components/brand/SuperbrushStage";
import ProductGridScroll from "@/components/ProductGridScroll";
import ProductTabs from "@/components/ProductTabs";
import { janekeModels } from "@/lib/janeke-stage";
import { DEFAULT_LOCALE } from "@/lib/i18n/localized";

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

/** The same shelf at xl, where the grid is five across rather than four.
 *  Both counts are whole rows, so an expanded shelf never ends on a part
 *  row with empty columns beside it. */
const PER_GROUP_XL = 10;

/** One row, for the shelves that only show one.
 *
 *  The grid is four across from md and five from xl, so one count cannot
 *  fill the row at both widths. The page draws five and hides the fifth
 *  below xl, which is what keeps every shelf a whole row — a shelf cut to
 *  four left an empty column on a wide screen and read as stock running out.
 */
const FIRST_ROW = 4;
const FIRST_ROW_XL = 5;

/** The card at `index` of a first row: the fifth belongs to xl alone. */
const firstRowClass = (index: number) => (index >= FIRST_ROW ? "hidden xl:block" : undefined);

export function generateStaticParams() {
  return brands.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const facts = brandFacts(params.slug);
  if (!facts) return { title: "ไม่พบแบรนด์ | Smoothlife.com" };

  const meta = await withSeoOverride("brand", params.slug, {
    ...brandSeoDefaults(facts),
    image: facts.brand.image,
  });
  return {
    title: meta.title,
    description: meta.description,
    // A brand whose whole range is out of stock has nothing to sell and
    // nothing to rank for. The page stays reachable — it is linked from
    // /brands and people do arrive on it — but asking Google to index an
    // empty shelf earns the site a thin page and the visitor a dead end.
    ...(facts.items.length === 0 ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/brands/${params.slug}` },
    ...shareMeta({
      title: meta.title,
      description: meta.description,
      url: `/brands/${params.slug}`,
      // See the product page: attached picture as it is, otherwise the
      // white card beside this file.
      image: meta.imageIsCustom ? meta.image : undefined,
      square: meta.imageIsCustom,
    }),
  };
}

/**
 * A brand page, assembled from a document.
 *
 * The brand's own published page if the team laid one out, otherwise the
 * automatic brand template — which every brand has without anyone building
 * it, and which is also what a page that cannot be read falls back to. The
 * structured data stays here rather than in a section: it describes the
 * brand, not the layout, and has to be on the page however it is arranged.
 */
async function StoredBrandPage({ slug }: { slug: string }) {
  const facts = brandFacts(slug);
  if (!facts) notFound();

  const doc = (await publishedDoc("brand", slug)) ?? defaultBrandDoc();
  const sections = await renderSections(doc, { kind: "brand", slug, now: new Date(),
        locale: DEFAULT_LOCALE, isPreview: false });

  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "แบรนด์ทั้งหมด", href: "/brands" },
    { label: facts.brand.name },
  ];
  return (
    <div className="py-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(brandJsonLd(facts.brand)) }} />
      {sections}
    </div>
  );
}

/**
 * Janeke's shelf is one product in twenty colours, which the standard grid
 * shows as twenty near-identical cards. The stage puts one comb on screen at a
 * time and makes the colour the thing you choose — the shelf still follows,
 * for anyone who would rather scan a grid.
 *
 * Above whichever page body is in use, so it does not depend on the pages
 * system being switched on.
 */
async function BrandStage({ slug }: { slug: string }) {
  if (slug !== "janeke") return null;
  const facts = brandFacts(slug);
  if (!facts) return null;
  const items = await withCustomImages(facts.items);
  const models = janekeModels(items);
  if (models.length === 0) return null;
  const from = Math.min(...models.flatMap((m) => m.items.map((i) => i.price)));
  return (
    <SuperbrushStage
      models={models}
      headline="Find your perfect match"
      intro={`เริ่มต้น ${formatTHB(from)} · เลือกสีที่ใช่ แล้วช้อปได้เลย`}
    />
  );
}

export default async function BrandHubPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return (
    <>
      <BrandStage slug={params.slug} />
      <div id="shelf">
        {PAGES_BRAND_ENABLED ? (
          <StoredBrandPage slug={params.slug} />
        ) : (
          <LegacyBrandPage slug={params.slug} />
        )}
      </div>
    </>
  );
}

async function LegacyBrandPage({ slug }: { slug: string }) {
  const facts = brandFacts(slug);
  if (!facts) notFound();

  const { brand, reviews, rating, minPrice, categoryNames } = facts;
  // Overlaid once here, before the groups and the bestseller row are cut
  // out of it, so every card on the page comes from the same list.
  const items = await withCustomImages(facts.items);
  const groups = groupBrandProducts(items);
  // Most-reviewed first: the only popularity signal in the catalogue that is
  // real (`sold` is 0 for every item here), so it is the one we use. Skipped
  // for a small brand, where "most reviewed" would just be the same four
  // products the shopper is about to scroll past.
  const moreLink = (group: (typeof groups)[number]) =>
    group.items.length > PER_GROUP && (
      <Link
        href={`/shop?brand=${brand.slug}`}
        className="shrink-0 text-xs font-bold text-brand-800 underline-offset-2 hover:underline"
      >
        ดูทั้งหมด →
      </Link>
    );

  // A brand with one kind of product has no tabs to label its shelf, so that
  // shelf keeps the heading — and the way to the rest — that it has always had.
  const groupShelf = (group: (typeof groups)[number], visibleHeading: boolean, full = false) => (
    <section key={group.key} id={group.key} className="scroll-mt-24">
      {visibleHeading ? (
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-ink md:text-xl">
            {group.label} <span className="text-sm font-normal text-slate-500">({group.items.length} รายการ)</span>
          </h2>
          {moreLink(group)}
        </div>
      ) : (
        <>
          <h2 className="sr-only">{group.label}</h2>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{group.items.length} รายการ</p>
            {/* Not on the "ทั้งหมด" shelf: "ดูทั้งหมด →" beside a shelf that
                is already all of them reads as a promise of more. */}
            {!full && moreLink(group)}
          </div>
        </>
      )}
      {/* Both rows at once. They used to arrive behind a button, which kept
          the HTML small but put a click between a shopper and the rest of the
          shelf. shelfItemClass is the same per-width cut the sections system
          uses: eight cards below xl, ten at xl, so both rows are whole rows at
          every width. */}
      {full ? (
        // The whole catalogue, a batch at a time as the page is scrolled.
        <ProductGridScroll
          items={group.items.map(toCardData)}
          className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
          {group.items.slice(0, PER_GROUP_XL).map((p, i) => (
            <div key={p.slug} className={shelfItemClass(i, 2)}>
              <ProductCard product={toCardData(p)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const bestsellers =
    items.length > PER_GROUP
      ? [...items].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, FIRST_ROW_XL)
      : [];

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

      {bestsellers.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-ink md:text-xl">
            <Star size={18} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            สินค้า<span translate="no">{brand.name}</span>ที่มีคนรีวิวมากที่สุด
          </h2>
          <p className="mb-4 text-xs text-slate-500">เรียงจากจำนวนรีวิวจริงของผู้ซื้อบนเว็บไซต์</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
            {bestsellers.map((p, i) => (
              <div key={p.slug} className={firstRowClass(i)}>
                <ProductCard product={toCardData(p)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* One kind of product at a time, chosen from the row of tabs.
          These used to be ten shelves stacked down the page with a row of
          chips at the top that jumped to them — which meant the control and
          the thing it controlled were a screen apart, and a brand like
          Dentiste ran to ten screens of grid.

          Every shelf is still in the HTML (see ProductTabs); the tabs only
          decide which one is on screen. The heading of each shelf is for a
          screen reader rather than the eye, because the tab above it already
          says the same words — what is left visible is the part the tab does
          not say: how many there are, and the way to the rest. */}
      {groups.length > 0 && (
        <div className="mt-10">
          {groups.length > 1 ? (
            <ProductTabs
              ariaLabel="ประเภทสินค้า"
              hashKeys={["all", ...groups.map((g) => g.key)]}
              labels={[`สินค้าทั้งหมด (${items.length})`, ...groups.map((g) => `${g.label} (${g.items.length})`)]}
              panels={[
                groupShelf({ key: "all", label: "สินค้าทั้งหมด", items }, false, true),
                ...groups.map((group) => groupShelf(group, false)),
              ]}
            />
          ) : (
            groups.map((group) => groupShelf(group, true))
          )}
        </div>
      )}

      {/* The list of every product as plain links used to sit here. It was
          how the products past each shelf's two rows stayed one click away —
          for a shopper scanning for a name, and for a crawler. The
          "สินค้าทั้งหมด" tab above carries all of them now, as cards, so the
          list was the same links twice. */}

      <p className="mt-8 text-center text-sm">
        <Link href="/brands" className="font-bold text-brand-800 underline-offset-2 hover:underline">
          ดูแบรนด์อื่นทั้งหมด
        </Link>
      </p>
    </div>
  );
}
