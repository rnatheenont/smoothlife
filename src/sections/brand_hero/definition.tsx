import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { ShieldCheck, Truck } from "lucide-react";
import StarRating from "@/components/StarRating";
import { formatTHB } from "@/lib/format";
import { srcSetFor } from "@/lib/media";
import { mediaSourcesFor } from "@/lib/media-lookup";
import { brandPageData, type BrandPageData } from "@/lib/brand-page";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The top of a brand page: where you are, whose page it is, and the numbers a
// shopper weighs before scrolling.
//
// Which brand comes from the page itself (ctx.slug), not from a setting. A
// brand page belongs to one brand; a field that could name another would only
// ever be a way to put the wrong logo over the wrong products.
//
// Without a profile picture this is the header the page has always had. With
// one, the picture goes above it — the header still carries the name and the
// numbers, because a photograph is not something a screen reader or a search
// engine can read the brand's name off.

const schema = z.object({
  showBreadcrumb: z.boolean().default(true),
  showStats: z.boolean().default(true),
  showPromises: z.boolean().default(true),
});

type Data = { page: BrandPageData; heroSources: Record<string, string> | null; mobileSources: Record<string, string> | null };

async function load(_settings: z.output<typeof schema>, ctx: { slug: string }): Promise<Data | null> {
  const page = await brandPageData(ctx.slug);
  if (!page) return null;
  const hero = page.profile?.hero_image ?? "";
  const mobile = page.profile?.hero_image_mobile ?? "";
  const [heroSources, mobileSources] = await Promise.all([
    hero ? mediaSourcesFor(hero) : null,
    mobile ? mediaSourcesFor(mobile) : null,
  ]);
  return { page, heroSources, mobileSources };
}

function Component({ settings, data, index }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;
  const { brand, isHouse, items, reviews, rating, minPrice, categoryNames, profile } = data.page;
  const hero = profile?.hero_image ?? "";
  const mobile = profile?.hero_image_mobile ?? "";

  return (
    <div className="container-page">
      {settings.showBreadcrumb && (
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
      )}

      {hero && (
        // A plain <picture>: images.unoptimized is on, so next/image would
        // serve the one file it was handed and the library's smaller widths
        // would never reach a phone.
        <picture className="mb-4 block overflow-hidden rounded-xl2 bg-surface-soft">
          {mobile && <source media="(max-width: 767px)" srcSet={srcSetFor(data.mobileSources ?? undefined) ?? mobile} />}
          {/* A plain img, inside <picture>: images.unoptimized is on, so
              next/image would serve one file and the library's smaller widths
              would never reach a phone. */}
          <img
            src={hero}
            srcSet={srcSetFor(data.heroSources ?? undefined)}
            sizes="(min-width: 1536px) 1512px, 100vw"
            alt={profile?.hero_alt ?? ""}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : undefined}
            // The drawn shape is reserved before the file arrives, so the
            // header under it does not jump down when it does.
            className={`block h-auto w-full object-cover ${mobile ? "aspect-[4/5] md:aspect-[20/7]" : "aspect-[20/7]"}`}
          />
        </picture>
      )}

      <header className="rounded-xl2 border border-surface-line bg-brand-gradient-soft p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          {brand.image && (
            <div className="relative h-20 w-44 shrink-0 rounded-xl bg-white p-3 shadow-card md:h-24 md:w-56">
              <Image src={brand.image} alt={brand.name} fill priority={!hero} className="object-contain" sizes="224px" />
            </div>
          )}
          <div className="min-w-0">
            {isHouse && (
              <span className="mb-2 inline-block rounded-full bg-brand-gradient px-2.5 py-0.5 text-[11px] font-bold text-white">
                แบรนด์ในเครือ Life So Smooth
              </span>
            )}
            {/* The page's one h1. It lives in this section rather than at the
                page root because a brand page's heading is the brand's name,
                and this is the section that knows it. */}
            <h1 className="text-2xl font-bold text-brand-ink md:text-3xl" translate="no">
              {brand.name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 md:text-base">{brand.tagline}</p>
            {categoryNames.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">หมวดสินค้า: {categoryNames.join(" · ")}</p>
            )}
          </div>
        </div>

        {/* Every number is counted from the catalogue on this page, so none
            of them can go stale. */}
        {settings.showStats && (
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
        )}

        {settings.showPromises && (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-brand-emerald" aria-hidden="true" /> ของแท้ 100% มี อย.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck size={15} className="text-brand-emerald" aria-hidden="true" /> ส่งฟรีทั่วไทย ไม่มียอดขั้นต่ำ
            </span>
            <Link
              href={`/shop?brand=${brand.slug}`}
              className="-my-1 py-1 font-bold text-brand-800 underline-offset-2 hover:underline"
            >
              ดูสินค้าทั้งหมดพร้อมตัวกรอง →
            </Link>
          </div>
        )}
      </header>
    </div>
  );
}

export const brandHero: SectionDefinition<typeof schema> = {
  type: "brand_hero",
  version: 1,
  label: "หัวหน้าแบรนด์",
  description: "โลโก้ ชื่อแบรนด์ ตัวเลขรีวิว/ราคา และรูปหัวจากโปรไฟล์แบรนด์",
  category: "brand",
  schema,
  defaults: { showBreadcrumb: true, showStats: true, showPromises: true },
  fields: [
    { key: "showBreadcrumb", type: "toggle", label: "แสดงเส้นทาง (หน้าแรก / แบรนด์ทั้งหมด / …)" },
    { key: "showStats", type: "toggle", label: "แสดงตัวเลข (จำนวนสินค้า รีวิว ราคาเริ่มต้น)" },
    { key: "showPromises", type: "toggle", label: "แสดงแถบของแท้ / ส่งฟรี" },
  ],
  enabledOn: ["brand"],
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};
