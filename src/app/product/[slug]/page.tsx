import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import { categories } from "@/data/categories";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured } from "@/lib/2c2p";
import type { ReviewRow } from "@/app/api/reviews/route";
import type { QuestionRow } from "@/app/api/product-questions/route";
import ProductDetailInteractive from "@/components/ProductDetailInteractive";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import TrackRecentlyViewed from "@/components/TrackRecentlyViewed";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
import { productJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  return {
    title: product ? `${product.name} | Smoothlife.com` : "Product | Smoothlife.com",
    alternates: { canonical: `/product/${params.slug}` },
  };
}

// Real, user-submitted reviews/questions only — see product_reviews /
// product_questions migrations. A product with none yet gets an honest
// empty state in the UI rather than any fabricated content.
async function getReviews(slug: string): Promise<ReviewRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRest<ReviewRow[]>(
      `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&select=id,product_slug,author_name,rating,title,body,review_type,status,created_at&order=created_at.desc`
    );
  } catch {
    return [];
  }
}

async function getQuestions(slug: string): Promise<QuestionRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRest<QuestionRow[]>(
      `product_questions?product_slug=eq.${encodeURIComponent(slug)}&select=id,product_slug,author_name,question,answer,answered_at,created_at&order=created_at.desc`
    );
  } catch {
    return [];
  }
}

// No row = never explicitly turned off, so it defaults eligible — matches
// today's actual behavior (every product subscribable) until someone opts
// a product out from the admin side.
async function getSubscribable(slug: string): Promise<boolean> {
  if (!supabaseConfigured()) return true;
  try {
    const [row] = await supabaseRest<{ subscribable: boolean }[]>(
      `product_subscription_settings?product_slug=eq.${encodeURIComponent(slug)}&select=subscribable`
    );
    return row ? row.subscribable : true;
  } catch {
    return true;
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 4);
  const [reviews, questions, subscribable] = await Promise.all([
    getReviews(product.slug),
    getQuestions(product.slug),
    getSubscribable(product.slug),
  ]);
  const categoryInfo = categories.find((c) => c.slug === product.category);
  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "ช้อป", href: "/shop" },
    ...(categoryInfo ? [{ label: categoryInfo.nameTh, href: `/shop/${categoryInfo.slug}` }] : []),
    { label: product.name },
  ];

  return (
    <div className="container-page pt-3 pb-8 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(product, reviews)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }}
      />
      <TrackRecentlyViewed slug={product.slug} />
      <div className="flex items-center gap-3 mb-4">
        <BackButton fallbackHref={`/shop/${product.category}`} />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <ProductDetailInteractive
        product={product}
        related={related}
        reviews={reviews}
        questions={questions}
        subscriptionBillingEnabled={twoC2PConfigured()}
        subscribable={subscribable}
      />

      {related.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="สินค้าที่เกี่ยวข้อง" subtitle="You may also like" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}

      <RecentlyViewedSection excludeSlug={product.slug} />
    </div>
  );
}
