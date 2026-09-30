import Image from "next/image";
import Link from "next/link";
import { Noto_Serif_Thai } from "next/font/google";
import { ArrowRight, Sparkles } from "lucide-react";
// categoryImage/concernImage fall back to a real product photo: three
// categories carry no picture of their own and rendered as blank circles.
import { categories, categoryImage, concerns, concernImage } from "@/data/categories";
import { products } from "@/data/products";
import { articles } from "@/data/articles";
import { brands } from "@/data/brands";
import { formatTHB } from "@/lib/format";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";
import { heroBanners } from "@/data/heroBanners";

// A second opinion about the home page, at its own address.
//
// The brief was a Shopify theme — Hyper's Ceramide preset — and what it is
// actually asking for is quiet: a warm ground, one large serif line, and room
// around everything. Our home page is the opposite, a mint gradient with a
// chip on every surface, and the two cannot be compared by description.
//
// So this is the whole argument laid out at /home-preview, built from the same
// data the real page reads, and nothing on the live page is touched. Ceramide
// is a single-brand skincare theme; the parts of it that speak for one brand —
// the Vegan/Paraben Free values row, the influencer wall — are left out,
// because this shop sells Blackmores and Dentiste out of the same window and
// cannot put words in either mouth.

export const revalidate = 300;

// Noto Sans Thai is the whole site's typeface and has no serif. The display
// line is the one thing Ceramide is really made of, so it gets a Thai serif
// from the same family — a Latin serif would drop every sara and mai ek.
const display = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/** Ceramide's ground, in this shop's colours: warm paper, forest-green ink. */
const PAPER = "#FAF7F2";
const INK = "#003529";

function Display({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-[family-name:var(--font-display)] font-medium tracking-tight ${className}`}>{children}</h2>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  // Not tracked-out capitals: this sits above every heading on the page and
  // the shouting version is the tell that a template wrote it.
  return <p className="text-[13px] text-[#7d8a83]">{children}</p>;
}

function ProductCard({ p }: { p: (typeof products)[number] }) {
  return (
    <Link href={`/product/${p.slug}`} className="group flex flex-col">
      <span className="relative aspect-square overflow-hidden rounded-2xl bg-white">
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="(max-width: 768px) 45vw, 22vw"
          className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </span>
      <span className="mt-3 text-[11px] text-[#8b978f]">{p.brand}</span>
      <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#20302a]">{p.name}</span>
      <span className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold" style={{ color: INK }}>
          {formatTHB(p.price)}
        </span>
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="text-[11px] text-[#a9b3ad] line-through">{formatTHB(p.compareAtPrice)}</span>
        )}
      </span>
    </Link>
  );
}

export default async function HomePreview() {
  const banners = (await getStorefrontHeroBanners()) ?? heroBanners;
  const hero = banners[0];

  // Real shop data, same sources the live page reads.
  const bestSellers = [...products]
    .filter((p) => p.inStock && p.image)
    .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0) || b.reviewCount - a.reviewCount)
    .slice(0, 8);
  const latest = articles.slice(0, 3);
  const shownBrands = brands.slice(0, 8);

  return (
    <div className={`${display.variable} min-h-screen`} style={{ backgroundColor: PAPER, color: "#20302a" }}>
      {/* 1 — the hero. One line, said once, with the artwork given room. */}
      <section className="mx-auto grid w-full max-w-[1280px] items-center gap-8 px-5 pb-14 pt-8 md:grid-cols-[0.9fr_1.1fr] md:gap-14 md:pb-24 md:pt-16">
        <div>
          <Eyebrow>ของแท้ 100% · ส่งฟรีทั่วไทย</Eyebrow>
          <Display className="mt-4 text-[38px] leading-[1.15] md:text-[58px]" >
            <span style={{ color: INK }}>ดูแลตัวเอง</span>
            <br />
            <span style={{ color: INK }}>ให้ถูกวิธี</span>
          </Display>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[#5d6b64]">
            สกินแคร์ ดูแลช่องปาก และวิตามินจากแบรนด์ที่เชื่อถือได้ คัดมาให้แล้วว่าเหมาะกับปัญหาแบบไหน
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: INK }}
            >
              เริ่มช้อป <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/ai-assistant"
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold ring-1 transition-colors hover:bg-white"
              style={{ color: INK, borderColor: "transparent", boxShadow: "inset 0 0 0 1px rgba(0,53,41,0.18)" }}
            >
              <Sparkles size={15} aria-hidden /> ให้ AI ช่วยเลือก
            </Link>
          </div>
        </div>
        {hero && (
          <Link href={hero.href} className="relative block aspect-[4/3] overflow-hidden rounded-[28px] bg-white md:aspect-[5/4]">
            <Image src={hero.image} alt="" fill sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" priority />
          </Link>
        )}
      </section>

      {/* 2 — categories as round tiles, Ceramide's one structural idea worth taking. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <ul className="flex gap-5 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-6 md:gap-8 md:overflow-visible">
          {categories.slice(0, 6).map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/shop/${c.slug}`} className="group flex w-[88px] flex-col items-center gap-3 md:w-auto">
                <span className="relative aspect-square w-[88px] overflow-hidden rounded-full bg-white md:w-full">
                  <Image src={categoryImage(c.slug)} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="text-center text-[12px] leading-tight text-[#41514a]">{c.nameTh}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3 — the assistant, high up, because it is the thing this shop has that
             a shelf of products does not. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <div className="rounded-[28px] bg-white px-6 py-10 md:px-14 md:py-14">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <Eyebrow>ยังไม่รู้ว่าต้องใช้อะไร</Eyebrow>
              <Display className="mt-3 text-[26px] leading-snug md:text-[36px]" >
                <span style={{ color: INK }}>บอกปัญหามา เดี๋ยวเราหาให้</span>
              </Display>
              <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[#5d6b64]">
                ตอบไม่กี่คำถาม แล้วให้ผู้ช่วยคัดสินค้าที่ตรงกับผิวและปัญหาของคุณจริง ๆ
              </p>
            </div>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["ผิวและสิว", "/skin-coach"],
                ["ช่องปากและฟัน", "/oral-care-advisor"],
                ["วิตามินและอาหารเสริม", "/supplement-advisor"],
                ["ถามผู้ช่วยได้ทุกเรื่อง", "/ai-assistant"],
              ] as const
            ).map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-5 text-[14px] transition-colors hover:bg-[#f3f7f5]"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(0,53,41,0.10)", color: INK }}
                >
                  {label}
                  <ArrowRight size={15} className="shrink-0 opacity-45" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 — by concern, which is how somebody who does not know a product name shops. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <Eyebrow>เลือกจากสิ่งที่กังวล</Eyebrow>
        <Display className="mt-3 text-[26px] md:text-[36px]">
          <span style={{ color: INK }}>ช้อปตามปัญหา</span>
        </Display>
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {concerns.slice(0, 6).map((c) => (
            <li key={c.slug}>
              <Link href={`/concern/${c.slug}`} className="group block">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                  <Image src={concernImage(c.slug)} alt="" fill sizes="(max-width: 768px) 45vw, 18vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="mt-3 block text-[13px] leading-snug" style={{ color: INK }}>
                  {c.nameTh}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — products, quiet. The photographs carry it. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>ที่คนซื้อซ้ำมากที่สุด</Eyebrow>
            <Display className="mt-3 text-[26px] md:text-[36px]">
              <span style={{ color: INK }}>ขายดีตอนนี้</span>
            </Display>
          </div>
          <Link href="/shop" className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: INK }}>
            ดูทั้งหมด <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-4">
          {bestSellers.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      </section>

      {/* 6 — the gift, said as a number the shopper is already close to. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <div className="grid items-center gap-8 rounded-[28px] px-7 py-10 md:grid-cols-[1.2fr_1fr] md:px-14 md:py-14" style={{ backgroundColor: "#EFEAE1" }}>
          <div>
            <Eyebrow>ยิ่งช้อป ยิ่งได้เพิ่ม</Eyebrow>
            <Display className="mt-3 text-[26px] leading-snug md:text-[34px]">
              <span style={{ color: INK }}>ซื้อครบรับของแถม</span>
            </Display>
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-[#5d6b64]">
              ของแถมจะขึ้นในตะกร้าเองเมื่อยอดถึงเกณฑ์ ไม่ต้องกรอกโค้ด ไม่ต้องกดเพิ่ม
            </p>
            <Link
              href="/promotions"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
              style={{ backgroundColor: INK }}
            >
              ดูของแถมทั้งหมด <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <ul className="grid gap-2.5">
            {(
              [
                ["สะสมแต้มทุกคำสั่งซื้อ", "แลกส่วนลดและของรางวัลได้"],
                ["Flash Sale แบบเข้าคิว", "ถึงคิวแล้วมีเวลาชำระเงิน ไม่ต้องแย่งกดกับใคร"],
              ] as const
            ).map(([title, sub]) => (
              <li key={title} className="rounded-2xl bg-white px-5 py-4">
                <p className="text-[14px] font-semibold" style={{ color: INK }}>
                  {title}
                </p>
                <p className="mt-0.5 text-[12px] text-[#6b7a72]">{sub}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7 — brands, as names rather than logos we do not have rights to redraw. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-16 md:pb-24">
        <Eyebrow>แบรนด์ที่เราคัดมา</Eyebrow>
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {shownBrands.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/brands/${b.slug}`}
                className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-[13px] transition-colors hover:bg-[#f0efe9]"
                style={{ color: INK }}
              >
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 8 — the articles, which are the reason somebody trusts the shelf. */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-20 md:pb-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>อ่านก่อนเลือก</Eyebrow>
            <Display className="mt-3 text-[26px] md:text-[36px]">
              <span style={{ color: INK }}>ดูแลตัวเองให้ถูกวิธี</span>
            </Display>
          </div>
          <Link href="/knowledge" className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: INK }}>
            บทความทั้งหมด <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {latest.map((a) => (
            <Link key={a.slug} href={`/knowledge/article/${a.slug}`} className="group">
              <span className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-white">
                <Image src={a.image} alt="" fill sizes="(max-width: 768px) 100vw, 32vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              </span>
              <span className="mt-4 block text-[15px] leading-snug" style={{ color: INK }}>
                {a.title}
              </span>
              <span className="mt-1.5 block line-clamp-2 text-[13px] leading-relaxed text-[#6b7a72]">{a.excerpt}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 9 — the promises, in the shop's own words, at the bottom where a
             shopper checks them rather than at the top where they are noise. */}
      <section className="border-t border-[rgba(0,53,41,0.08)]">
        <ul className="mx-auto grid w-full max-w-[1280px] grid-cols-2 gap-6 px-5 py-12 text-[13px] md:grid-cols-4">
          {["ของแท้ 100% จากตัวแทนจำหน่าย", "ส่งฟรีทั่วไทย", "สะสมแต้มทุกคำสั่งซื้อ", "มีผู้ช่วย AI ช่วยเลือก"].map((t) => (
            <li key={t} style={{ color: INK }}>
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
