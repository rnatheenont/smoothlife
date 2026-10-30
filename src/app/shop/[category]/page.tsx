import Link from "next/link";
import { filterProducts } from "@/lib/filter-products";
import { categories} from "@/data/categories";
import { categoryImage } from "@/lib/category-image";
import ProductCard from "@/components/ProductCard";
import ShopHero from "@/components/shop/ShopHero";
import AdvisorPopup from "@/components/shop/AdvisorPopup";
import { categoryBanner } from "@/lib/category-banner";
import ShopFilters from "@/components/ShopFilters";
import SortMenu from "@/components/shop/SortMenu";
import StickyToolbar from "@/components/shop/StickyToolbar";
import CategoryChips from "@/components/CategoryChips";
import SortSelect from "@/components/SortSelect";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import { notFound } from "next/navigation";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { withSeoOverride, shareMeta } from "@/lib/seo-overrides";
import { withCustomImages } from "@/lib/product-images";
import { toCardData } from "@/data/card";
import { brandNames, brandOptions } from "@/lib/brand-options";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { TemplateBody } from "@/lib/pages/template-page";

const ADVISOR_ENTRY: Record<string, { href: string; title: string; subtitle: string }> = {
  "oral-care": {
    href: "/oral-care-advisor",
    title: "ไม่รู้จะเริ่มจากตัวไหนดี?",
    subtitle: "ตอบ 3 คำถาม ให้น้อง Smoothie จัดเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ",
  },
  wellness: {
    href: "/supplement-advisor",
    title: "อาหารเสริมเยอะจนเลือกไม่ถูก?",
    subtitle: "ตอบ 5 คำถาม ให้น้อง Smoothie ช่วยหาแพลนที่ตรงเป้าหมายและงบของคุณ",
  },
};

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  const c = categories.find((c) => c.slug === params.category);
  const meta = await withSeoOverride("category", params.category, {
    title: c ? `${c.nameTh} | Smoothlife.com` : "Shop | Smoothlife.com",
    description: c ? `ช้อปสินค้าหมวด ${c.nameTh} คุณภาพดี ราคาคุ้มค่า ที่ Smoothlife.com` : undefined,
    image: c ? categoryImage(c.slug) : undefined,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/shop/${params.category}` },
    ...shareMeta({
      title: meta.title,
      description: meta.description,
      url: `/shop/${params.category}`,
      image: meta.image,
    }),
  };
}

async function CategoryPageWritten({
  categoryInfo,
  searchParams,
  params,
}: {
  categoryInfo: (typeof categories)[number];
  searchParams: { sort?: string; brand?: string; concern?: string };
  params: { category: string };
}) {
  const current = { ...searchParams, category: params.category };
  const items = await withCustomImages(filterProducts(current));

  const breadcrumbItems = [{ label: "หน้าแรก", href: "/" }, { label: "ช้อป", href: "/shop" }, { label: categoryInfo.nameTh }];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }} />
      {/* The same banner /shop wears — see sections/category_header. A
          category page is the shop with one filter already on, so arriving
          here from ช้อป should not feel like arriving at a different site. */}
      <ShopHero
        title={categoryInfo.nameTh}
        subtitle="ดูแลตัวเองได้ง่าย ๆ ในทุกวัน"
        count={items.length}
        banner={categoryBanner(categoryInfo.slug)}
      >
      </ShopHero>

      {/* Tight at the top: the banner is directly above, and the trail
          belongs to it rather than opening a new stretch of page. */}
      <div className="container-page pt-3 pb-8 md:pt-4 md:pb-10">
      <div className="mb-3 flex items-center gap-3">
        <BackButton fallbackHref="/shop" />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      {/* A popup in the corner rather than a slab across the page — see
          AdvisorPopup, and sections/advisor_entry, which is the same thing
          for the document-rendered half of this route. */}
      {ADVISOR_ENTRY[params.category] && (
        <AdvisorPopup
          category={params.category}
          href={ADVISOR_ENTRY[params.category].href}
          title={ADVISOR_ENTRY[params.category].title}
          subtitle={ADVISOR_ENTRY[params.category].subtitle}
          image="/mascot/smoothie-hi.png"
        />
      )}

      <div className="flex flex-col gap-6">
        <div className="flex-1">
          {/* One toolbar, the same as /shop: filters on the left, ordering
              on the right. */}
          {/* The same sticky glass bar as /shop: the two pages are the same
              screen with a different heading, and one of them scrolling its
              filters away reads as a bug on whichever you saw second. */}
          <StickyToolbar>
            <div className="flex flex-wrap items-center justify-between gap-2">
            <ShopFilters
              current={current}
              houseBrands={brandOptions().house}
              otherBrands={brandOptions().other}
              mobileExtra={<SortSelect current={current} />}
            />
            <div className="hidden lg:flex">
              <SortMenu current={current} />
            </div>
            </div>
          </StickyToolbar>
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-500">ไม่พบสินค้าในหมวดนี้</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
              {items.map((p) => (
                <ProductCard key={p.slug} product={toCardData(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

/**
 * The page, from the category template when wave 2 is on and from the markup
 * above when it is not.
 *
 * The query string is read here and handed down either way: the sections
 * render on the server and cannot reach for it themselves, and the filters,
 * the sort, the count beside the name and the grid are all one reading of it.
 */
export default async function CategoryPage(props: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string; brand?: string; concern?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const categoryInfo = categories.find((c) => c.slug === params.category);
  if (!categoryInfo) notFound();

  if (PAGES_WAVE2_ENABLED) {
    return (
      <TemplateBody
        templateKey="category"
        entity={{ type: "category", slug: categoryInfo.slug, name: categoryInfo.nameTh }}
        query={searchParams}
      />
    );
  }
  return <CategoryPageWritten categoryInfo={categoryInfo} searchParams={searchParams} params={params} />;
}
