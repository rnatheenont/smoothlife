import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import { categories } from "@/data/categories";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import type { ReviewRow } from "@/app/api/reviews/route";
import type { QuestionRow } from "@/app/api/product-questions/route";
import ProductDetailInteractive from "@/components/ProductDetailInteractive";
import ProductCard from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import TrackRecentlyViewed from "@/components/TrackRecentlyViewed";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  return { title: product ? `${product.name} | Smoothlife.com` : "Product | Smoothlife.com" };
}

// Real, user-submitted reviews/questions only — see product_reviews /
// product_questions migrations. A product with none yet gets an honest
// empty state in the UI rather than any fabricated content.
async function getReviews(slug: string): Promise<ReviewRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRest<ReviewRow[]>(
      `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&select=id,product_slug,author_name,rating,title,body,created_at&order=created_at.desc`
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

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 4);
  const [reviews, questions] = await Promise.all([getReviews(product.slug), getQuestions(product.slug)]);
  const categoryInfo = categories.find((c) => c.slug === product.category);

  return (
    <div className="container-page pt-3 pb-8 md:py-10">
      <TrackRecentlyViewed slug={product.slug} />
      <div className="flex items-center gap-3 mb-4">
        <BackButton fallbackHref={`/shop/${product.category}`} />
        <Breadcrumb
          items={[
            { label: "หน้าแรก", href: "/" },
            { label: "ช้อป", href: "/shop" },
            ...(categoryInfo ? [{ label: categoryInfo.nameTh, href: `/shop/${categoryInfo.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </div>
      <ProductDetailInteractive product={product} related={related} reviews={reviews} questions={questions} />

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
