import Image from "next/image";
import { notFound } from "next/navigation";
import { concerns, concernImage } from "@/data/categories";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import { sortSoldOutLast } from "@/lib/filter-products";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { ogImages, withSeoOverride } from "@/lib/seo-overrides";

export function generateStaticParams() {
  return concerns.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const c = concerns.find((c) => c.slug === params.slug);
  const meta = await withSeoOverride("concern", params.slug, {
    title: c ? `${c.nameTh} | Smoothlife.com` : "Concern | Smoothlife.com",
    description: c?.description,
    image: c ? concernImage(c.slug) : undefined,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/concern/${params.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `/concern/${params.slug}`,
      ...ogImages(meta.image),
    },
  };
}

export default async function ConcernDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const concern = concerns.find((c) => c.slug === params.slug);
  if (!concern) notFound();

  const items = sortSoldOutLast(products.filter((p) => p.concerns.includes(concern.slug)));

  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "ปัญหาผิวที่กังวล", href: "/concern" },
    { label: concern.nameTh },
  ];

  return (
    <div className="container-page py-8 md:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }} />
      <div className="relative rounded-xl2 overflow-hidden h-48 md:h-64 mb-8">
        {/* The photos are square portraits and this banner is a wide strip, so a
            centred crop lands on a chin. Pulled up to keep the face in frame. */}
        <Image src={concernImage(concern.slug)} alt={concern.name} fill className="object-cover object-[50%_35%]" />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 p-6 text-white max-w-xl">
          <h1 className="text-2xl md:text-3xl font-bold">{concern.nameTh}</h1>
          <p className="text-sm text-white/80 mt-1">{concern.description}</p>
        </div>
      </div>

      <div className="rounded-xl2 bg-brand-gradient-soft p-5 mb-8">
        <h2 className="font-bold text-brand-ink mb-2">Routine แนะนำสำหรับปัญหานี้</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
          <div className="rounded-lg bg-white p-3">
            <span className="text-xs font-bold text-brand-800">ขั้นที่ 1</span>
            <p className="mt-1">ทำความสะอาดผิวด้วยผลิตภัณฑ์อ่อนโยน</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <span className="text-xs font-bold text-brand-800">ขั้นที่ 2</span>
            <p className="mt-1">ใช้เซรั่มหรือทรีทเมนต์เฉพาะจุด</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <span className="text-xs font-bold text-brand-800">ขั้นที่ 3</span>
            <p className="mt-1">ปิดท้ายด้วยมอยส์เจอร์ไรเซอร์และกันแดด</p>
          </div>
        </div>
      </div>

      <h2 className="font-bold text-brand-ink mb-4">สินค้าแนะนำ ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">เร็วๆ นี้จะมีสินค้าเพิ่มเติมสำหรับหมวดนี้</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
