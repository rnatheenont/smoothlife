import Link from "next/link";
import Image from "next/image";
import { Sparkles, ShieldCheck, Truck, Award, MessageCircle } from "lucide-react";
import { products } from "@/data/products";
import { categories, concerns } from "@/data/categories";
import { brands } from "@/data/brands";
import { promotions, promotionImage } from "@/data/promotions";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";

export default function HomePage() {
  const bestSellers = products.filter((p) => p.badges?.includes("Bestseller")).slice(0, 8);
  const newArrivals = products.filter((p) => p.badges?.includes("New")).concat(products.slice(0, 4)).slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-radial">
        <div className="container-page py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
          <div className="animate-fadeUp">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald shadow-card mb-4">
              <Sparkles size={13} /> AI Beauty Advisor ใหม่ล่าสุด
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-brand-ink">
              สุขภาพดี ผิวสวย <br />
              <span className="brand-text-gradient">ครบทุก Lifestyle</span> ที่เดียว
            </h1>
            <p className="mt-4 text-slate-600 max-w-md">
              ค้นหาสินค้าง่าย ซื้อเร็ว เข้าสู่ระบบด้วย OTP หรือ LINE พร้อมรับคะแนนสะสมทุกการช้อป
              ของแท้ 100% มีอย. จัดส่งฟรีทั่วไทย
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm hover:opacity-90 transition-opacity">
                เริ่มช้อปเลย
              </Link>
              <Link href="/advisor" className="rounded-full bg-white border border-slate-200 text-brand-ink font-semibold px-6 py-3 text-sm hover:border-brand-teal transition-colors">
                ให้ AI แนะนำสกินแคร์
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-xl2 overflow-hidden shadow-cardHover">
            <Image
              src="https://www.smoothlife.com/cdn/shop/files/434082539_932456655336906_65767955414828336_n.jpg?width=900"
              alt="Smooth Life"
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-page py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs md:text-sm">
          {[
            { icon: ShieldCheck, label: "ของแท้ 100% มีอย." },
            { icon: Truck, label: "ส่งฟรีเมื่อครบ 990 บาท" },
            { icon: Award, label: "สะสมคะแนนทุกออเดอร์" },
            { icon: MessageCircle, label: "ปรึกษาผู้เชี่ยวชาญฟรี" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-slate-600">
              <f.icon size={18} className="text-brand-emerald shrink-0" />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-10 md:py-14">
        <SectionHeading title="ช้อปตามหมวดหมู่" subtitle="Product Categories" href="/shop" />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/shop/${c.slug}`} className="group flex flex-col items-center gap-2">
              <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-full overflow-hidden bg-surface-soft ring-1 ring-slate-100 group-hover:ring-brand-teal transition-all">
                <Image src={c.image} alt={c.name} fill className="object-cover" />
              </div>
              <span className="text-xs md:text-sm text-center font-medium text-slate-600 group-hover:text-brand-emerald">
                {c.nameTh}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Promotions */}
      <section className="bg-surface-soft py-10 md:py-14">
        <div className="container-page">
          <SectionHeading title="โปรโมชั่นและดีลเด็ด" subtitle="New, Best Sellers and Promotions" href="/promotions" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {promotions.map((promo) => (
              <Link
                key={promo.slug}
                href={`/promotions#${promo.slug}`}
                className="relative rounded-xl2 overflow-hidden aspect-[4/3] group shadow-card"
              >
                <Image
                  src={promotionImage(promo, products)}
                  alt={promo.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 p-3 md:p-4 text-white">
                  <span className="text-[10px] font-bold uppercase bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                    {promo.badge}
                  </span>
                  <h3 className="font-bold text-sm md:text-base mt-1">{promo.title}</h3>
                  <p className="text-[11px] md:text-xs text-white/80">{promo.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Best sellers */}
      <section className="container-page py-10 md:py-14">
        <SectionHeading title="สินค้าขายดี" subtitle="Best Sellers" href="/shop?sort=bestseller" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {bestSellers.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Concern hub teaser */}
      <section className="bg-brand-gradient-soft py-10 md:py-14">
        <div className="container-page">
          <SectionHeading title="ช้อปตามปัญหาผิวที่กังวล" subtitle="Shop by Concern" href="/concern" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {concerns.map((c) => (
              <Link key={c.slug} href={`/concern/${c.slug}`} className="group rounded-xl2 bg-white overflow-hidden shadow-card">
                <div className="relative aspect-square">
                  <Image src={c.image} alt={c.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-brand-ink line-clamp-2">{c.nameTh}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor CTA */}
      <section className="container-page py-10 md:py-14">
        <div className="rounded-xl2 bg-brand-ink text-white p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center overflow-hidden relative">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold mb-4">
              <Sparkles size={13} /> Personalized Shopping
            </span>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">ให้ AI Beauty Advisor ช่วยเลือกสกินแคร์ที่ใช่สำหรับคุณ</h2>
            <p className="text-white/70 mb-6 max-w-md">
              ตอบคำถามเกี่ยวกับผิวของคุณ 2 นาที รับคำแนะนำผลิตภัณฑ์และรูทีนที่ออกแบบมาเฉพาะคุณ
            </p>
            <Link href="/advisor" className="inline-block rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity">
              เริ่มทำแบบประเมิน
            </Link>
          </div>
        </div>
      </section>

      {/* Brands strip */}
      <section className="container-page py-10 md:py-14">
        <SectionHeading title="แบรนด์ที่คุณไว้วางใจ" subtitle="Brands" href="/brands" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {brands.slice(0, 10).map((b) => (
            <Link
              key={b.slug}
              href={`/shop?brand=${b.slug}`}
              className="rounded-xl2 border border-slate-100 shadow-card p-3 flex items-center justify-center h-32 hover:border-brand-teal transition-colors"
            >
              {b.image ? (
                <div className="relative h-full w-full">
                  <Image src={b.image} alt={b.name} fill className="object-contain" sizes="220px" />
                </div>
              ) : (
                <span className="text-sm font-medium text-slate-600">{b.name}</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-page pb-14">
        <SectionHeading title="แนะนำสำหรับคุณ" subtitle="New & Trending" href="/shop" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {newArrivals.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
