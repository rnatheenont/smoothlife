import type { Product } from "@/data/types";
import type { ReviewRow } from "@/app/api/reviews/route";

import { SITE_URL } from "@/lib/site-url";
import { headlineRating } from "@/lib/product-rating";

// Escapes "</" so a product name/review body containing it can never break
// out of the <script> tag it's embedded in.
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * How the shop delivers and takes things back, as Google expects it stated.
 *
 * The numbers are the ones on /help and in the shop's own terms, and there
 * is a test (shop-facts.test.ts) that fails when the customer-facing pages
 * and the checkout stop agreeing about them. Repeating them here is the
 * third place they appear, so they are written once as constants and the
 * comment says where the truth lives.
 *
 * Both blocks are what turn a plain listing into one that can show "free
 * delivery" and "free 14-day returns" in a search result.
 */
const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "THB" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "TH" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
  },
} as const;

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "TH",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
} as const;

export function productJsonLd(product: Product, reviews: ReviewRow[]) {
  const url = `${SITE_URL}/product/${product.slug}`;
  // Every photo, not the two the cards use. A listing is shown with the
  // picture Google picks, and giving it one choice is choosing for it.
  const images = (
    product.images?.length ? product.images : [product.image, product.image2]
  ).filter(Boolean) as string[];

  const offers =
    product.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "THB",
          lowPrice: Math.min(...product.variants.map((v) => v.price)),
          highPrice: Math.max(...product.variants.map((v) => v.price)),
          offerCount: product.variants.length,
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url,
          shippingDetails: SHIPPING_DETAILS,
          hasMerchantReturnPolicy: RETURN_POLICY,
        }
      : {
          "@type": "Offer",
          priceCurrency: "THB",
          price: product.price,
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url,
          shippingDetails: SHIPPING_DETAILS,
          hasMerchantReturnPolicy: RETURN_POLICY,
        };

  // The same rating the page prints, from the same function — see
  // product-rating.ts for why this is not simply "the reviews on this site".
  const headline = headlineRating(product, reviews);
  const aggregateRating = headline
    ? {
        "@type": "AggregateRating",
        ratingValue: headline.value.toFixed(1),
        reviewCount: headline.count,
        bestRating: 5,
        worstRating: 1,
      }
    : undefined;

  const review = reviews.slice(0, 5).map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.author_name },
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    reviewBody: r.body,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: images,
    description: product.shortDesc || product.description || undefined,
    brand: { "@type": "Brand", name: product.brand },
    // The real SKU when the catalogue has one. It used to send the slug,
    // which is a URL fragment wearing a SKU's name: nothing in the warehouse
    // or in Merchant Center can be matched with it, and an identifier that
    // identifies nothing is worse than none.
    //
    // No gtin13. Every barcode in this shop was flattened to "8.85E+12" by a
    // spreadsheet before it was imported, so there is not one real EAN to
    // send — see merchant-center-checklist.md. Sending a wrong one is worse
    // than sending none, because Google checks the check digit.
    //
    // Only when the product is one thing. A product with several sizes has a
    // SKU per size and none of its own, and picking one of them to stand for
    // the product is how a listing ends up pointing at the 30 ml when the
    // customer is looking at the 100 ml.
    ...(product.variants.length === 1 && product.variants[0].sku
      ? { sku: product.variants[0].sku }
      : {}),
    offers,
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(review.length ? { review } : {}),
  };
}

// Site-wide (rendered once, in the root layout) — not per-page like
// productJsonLd/breadcrumbJsonLd above.
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Smoothlife.com",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Smoothlife.com",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { label: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };
}

/**
 * A guide/blog page, marked up so a crawler (or a model) can tell when it
 * was written and whether it has been kept current — without a date, two
 * otherwise-identical answers are indistinguishable on the one signal that
 * tells a reader (or a model) which one to trust more.
 *
 * `datePublished`/`dateModified` are only included when the caller actually
 * has them — see the comment on `Article.publishedAt` in data/types.ts for
 * why an invented date is worse than an absent one here.
 */
export function articleJsonLd(article: {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  sources: string[];
  publishedAt?: string;
  updatedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    image: article.image,
    url: `${SITE_URL}/knowledge/article/${article.slug}`,
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    ...(article.sources.length ? { citation: article.sources } : {}),
  };
}

/**
 * A page that answers questions, marked up so Google can show the answers
 * directly — the "People also ask" style result.
 *
 * Only for questions genuinely answered on the page itself: the markup has to
 * match what a visitor reads, and Google drops (or penalises) a FAQPage whose
 * answers are not visible where it says they are.
 */
export function faqPageJsonLd(items: { question: string; answer: string; dateModified?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
      // A page that visibly says when it was last checked reads as
      // maintained rather than abandoned — to a search crawler and to a
      // model deciding which of several similar answers to trust.
      ...(item.dateModified ? { dateModified: item.dateModified } : {}),
    })),
  };
}

/**
 * A brand hub page, told to Google as the brand it collects.
 *
 * `url` is the hub itself rather than the brand's own website: this page is
 * where the brand is sold here, and claiming to be the brand's homepage would
 * be a different — and wrong — statement.
 */
export function brandJsonLd(brand: { slug: string; name: string; tagline: string; image?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    description: brand.tagline,
    url: `${SITE_URL}/brands/${brand.slug}`,
    ...(brand.image ? { logo: brand.image } : {}),
  };
}
