import Image from "next/image";
import { notFound } from "next/navigation";
import { articles, getArticleBySlug } from "@/data/articles";
import { getProductBySlug, getRelatedProducts } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import { BookOpen, ExternalLink, ShoppingBag } from "lucide-react";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const a = getArticleBySlug(params.slug);
  return { title: a ? `${a.title} | Smoothlife.com` : "Article | Smoothlife.com" };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();
  const primaryProduct = article.productSlug ? getProductBySlug(article.productSlug) : undefined;
  const relatedProducts = primaryProduct ? [primaryProduct, ...getRelatedProducts(primaryProduct, 2)] : [];

  return (
    <article className="container-page py-8 md:py-10 max-w-2xl mx-auto">
      <div className="relative aspect-[16/9] rounded-xl2 overflow-hidden mb-6">
        <Image src={article.image} alt={article.title} fill className="object-cover" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-3">{article.title}</h1>
      <p className="text-sm text-slate-500 mb-6">{article.readMins} นาทีในการอ่าน</p>
      <div className="flex flex-col gap-4 text-slate-700 leading-relaxed">
        {article.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {relatedProducts.length > 0 && (
        <section className="mt-10" aria-labelledby="related-products-title">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={18} className="text-brand-emerald" />
            <h2 id="related-products-title" className="font-bold text-brand-ink">สินค้าบน Smoothlife ที่เกี่ยวข้อง</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
            {relatedProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">ชื่อ รูป ราคา สถานะสินค้า และรายละเอียดในส่วนนี้ดึงจาก Shopify ชุดเดียวกับหน้า Shop โดยตรง โปรดอ่านฉลากและคำเตือนของสินค้าแต่ละชนิดก่อนใช้</p>
        </section>
      )}
      <div className="mt-8 rounded-xl2 border border-amber-100 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
        เนื้อหานี้จัดทำเพื่อให้ความรู้ทั่วไป ไม่ใช้แทนการวินิจฉัยหรือคำแนะนำเฉพาะบุคคลจากแพทย์ หากมีอาการรุนแรงหรือเรื้อรัง ควรพบแพทย์ผิวหนัง
      </div>
      <div className="mt-10 rounded-xl2 bg-surface-soft p-5">
        <div className="flex items-center gap-2 font-bold text-brand-ink mb-2 text-sm">
          <BookOpen size={16} /> แหล่งอ้างอิง
        </div>
        <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
          {article.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-emerald hover:underline">
                {source.name} <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
