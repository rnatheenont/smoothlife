import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/data/products";
import { categories } from "@/data/categories";
import { supabaseRestCached, supabaseConfigured, productPageTags } from "@/lib/supabase-server";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
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
import { canonicalSlugFor } from "@/lib/product-canonical";
import { ogImages, withSeoOverride } from "@/lib/seo-overrides";

// Pages render on first visit and are then served from the edge cache,
// refreshed at most every five minutes — and at once when a review is
// approved, a question is posted or the subscribe option changes, since those
// routes revalidate this page's tags. Nothing is prerendered at build time:
// 900-odd pages would add Supabase reads to every deploy for pages most people
// never open. The catalogue itself is baked into the build, so a redeploy
// already refreshes prices and stock.
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const product = getProductBySlug(params.slug);
  // Three sources, most deliberate first: a title written in /admin/seo wins;
  // then whatever the team already typed into Shopify's search-engine listing
  // for this product — 904 of the 944 have one, and they were written by
  // someone who knows the product; only then the generated fallback.
  const meta = await withSeoOverride("product", params.slug, {
    title: product?.seoTitle || (product ? `${product.name} | Smoothlife.com` : "Product | Smoothlife.com"),
    description: product?.seoDescription || product?.shortDesc || undefined,
    image: product?.image,
  });
  // A pack of twelve points at the single unit; everything else points at
  // itself. See product-canonical.ts for what counts as a pack and why a
  // colour family does not.
  const canonicalSlug = canonicalSlugFor(params.slug);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/product/${canonicalSlug}` },
    // Shared to LINE or Facebook, a product link previewed as the site's
    // front page — same wordmark, same blurb, for all 944 of them.
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `/product/${params.slug}`,
      type: "website",
      ...ogImages(meta.image),
    },
  };
}

// Real, user-submitted reviews/questions only — see product_reviews /
// product_questions migrations. A product with none yet gets an honest
// empty state in the UI rather than any fabricated content.
async function getReviews(slug: string): Promise<ReviewRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<ReviewRow[]>(
      `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&select=id,product_slug,author_name,rating,title,body,review_type,status,created_at&order=created_at.desc`,
      { revalidate, tags: productPageTags(slug) }
    );
  } catch {
    return [];
  }
}

async function getQuestions(slug: string): Promise<QuestionRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<QuestionRow[]>(
      `product_questions?product_slug=eq.${encodeURIComponent(slug)}&select=id,product_slug,author_name,question,answer,answered_at,created_at&order=created_at.desc`,
      { revalidate, tags: productPageTags(slug) }
    );
  } catch {
    return [];
  }
}

// No row = never explicitly opted in, so it defaults ineligible — a
// product only shows the subscribe option once someone turns it on from
// the admin side (/admin/subscription-products).
async function getSubscribable(slug: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    const [row] = await supabaseRestCached<{ subscribable: boolean }[]>(
      `product_subscription_settings?product_slug=eq.${encodeURIComponent(slug)}&select=subscribable`,
      { revalidate, tags: productPageTags(slug) }
    );
    return row ? row.subscribable : false;
  } catch {
    return false;
  }
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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
        subscriptionBillingEnabled={subscriptionBillingConfigured()}
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
