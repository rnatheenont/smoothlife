import { z } from "zod";
import ProductDetailInteractive from "@/components/ProductDetailInteractive";
import TrackRecentlyViewed from "@/components/TrackRecentlyViewed";
import { brandHrefFor } from "@/data/brands";
import { getRelatedProducts } from "@/data/products";
import { getProductDetail } from "@/data/product-details";
import type { Product } from "@/data/types";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
import { jsonLdScript, productJsonLd } from "@/lib/json-ld";
import { getPublishedProductContent } from "@/lib/product-content";
import { customVideosFor, withCustomImages } from "@/lib/product-images";
import { supabaseConfigured, supabaseRestCached, productPageTags } from "@/lib/supabase-server";
import type { ReviewRow } from "@/app/api/reviews/route";
import type { QuestionRow } from "@/app/api/product-questions/route";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The part of a product page that sells the product.
//
// Locked, and this is the one lock in the whole library that is not a matter
// of taste: the gallery, the price, the variant picker, the subscribe option
// and the add-to-cart button are one component because they share one piece
// of state, and a shop where this can be removed from a page is a shop with
// 991 pages that cannot take money. The plan says the same thing in §G7 —
// auxiliary blocks move and hide, the buying part does not.
//
// It also owns the Product structured data and the recently-viewed tracker,
// because both describe *this* product: split off, they would be two more
// things that could end up on a page about something else.

const schema = z.object({});

// The same window the route declares, and they have to agree: the route's
// `revalidate` is how often the page may be rebuilt, this is how long these
// reads may be reused inside it. The tags are what makes an approved review
// or a new question appear without waiting for either.
const REVALIDATE = 300;

type Data = {
  product: Product;
  related: Product[];
  reviews: ReviewRow[];
  questions: QuestionRow[];
  subscribable: boolean;
  contentBlocks: Awaited<ReturnType<typeof getPublishedProductContent>>;
  videos: Awaited<ReturnType<typeof customVideosFor>>;
  /** The brand hub this product belongs to, or null when it has none. */
  brandHref: string | null;
  subscriptionBillingEnabled: boolean;
};

// Real, user-submitted reviews/questions only — see the product_reviews /
// product_questions migrations. A product with none yet gets an honest empty
// state in the UI rather than any fabricated content.
async function getReviews(slug: string): Promise<ReviewRow[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<ReviewRow[]>(
      `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&select=id,product_slug,author_name,rating,title,body,review_type,status,created_at&order=created_at.desc`,
      { revalidate: REVALIDATE, tags: productPageTags(slug) }
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
      { revalidate: REVALIDATE, tags: productPageTags(slug) }
    );
  } catch {
    return [];
  }
}

// No row = never explicitly opted in, so it defaults ineligible — a product
// only shows the subscribe option once someone turns it on from the admin
// side (/admin/subscription-products).
async function getSubscribable(slug: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    const [row] = await supabaseRestCached<{ subscribable: boolean }[]>(
      `product_subscription_settings?product_slug=eq.${encodeURIComponent(slug)}&select=subscribable`,
      { revalidate: REVALIDATE, tags: productPageTags(slug) }
    );
    return row ? row.subscribable : false;
  } catch {
    return false;
  }
}

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<Data | null> {
  const slug = ctx.entity?.slug;
  const found = slug ? getProductDetail(slug) : undefined;
  if (!found) return null;

  // Our own photographs, if this product has any switched on — one query for
  // the product and the four related cards below it. Everything downstream
  // reads product.image as it always has.
  const [product, ...related] = await withCustomImages([found, ...getRelatedProducts(found, 4)]);
  const [reviews, questions, subscribable, contentBlocks, videos] = await Promise.all([
    getReviews(product.slug),
    getQuestions(product.slug),
    getSubscribable(product.slug),
    // Every variant id, not just the default one: the row is keyed on a
    // single variant and a product's sizes come and go, so matching on any of
    // them keeps the copy attached to the product it was written for.
    getPublishedProductContent(product.slug, [
      ...new Set([product.variantId, ...(product.variants?.map((v) => v.variantId) ?? [])]),
    ]),
    // Their own prop, not part of the product: Product.images is read by
    // <Image>, the link preview and the JSON-LD, none of which can show a clip.
    customVideosFor(product),
  ]);

  return {
    product,
    related,
    reviews,
    questions,
    subscribable,
    contentBlocks,
    videos,
    brandHref: brandHrefFor(product.brand),
    subscriptionBillingEnabled: subscriptionBillingConfigured(),
  };
}

function Component({ data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  return (
    <section className="container-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(data.product, data.reviews)) }}
      />
      <TrackRecentlyViewed slug={data.product.slug} />
      <ProductDetailInteractive
        product={data.product}
        related={data.related}
        reviews={data.reviews}
        questions={data.questions}
        subscriptionBillingEnabled={data.subscriptionBillingEnabled}
        subscribable={data.subscribable}
        contentBlocks={data.contentBlocks}
        videos={data.videos}
        brandHref={data.brandHref}
      />
    </section>
  );
}

export const productDetail: SectionDefinition<typeof schema> = {
  type: "product_detail",
  version: 1,
  label: "ส่วนซื้อสินค้า",
  description: "แกลเลอรี ราคา ตัวเลือก ปุ่มหยิบใส่ตะกร้า รีวิวและคำถาม — ล็อก ลบออกจากหน้าไม่ได้",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["template"],
  requiresEntity: ["product"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};
