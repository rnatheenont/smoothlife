import type { Product } from "@/data/types";
import type { ReviewRow } from "@/app/api/reviews/route";

import { SITE_URL } from "@/lib/site-url";

// Escapes "</" so a product name/review body containing it can never break
// out of the <script> tag it's embedded in.
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function productJsonLd(product: Product, reviews: ReviewRow[]) {
  const url = `${SITE_URL}/product/${product.slug}`;
  const images = [product.image, product.image2].filter(Boolean) as string[];

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
        }
      : {
          "@type": "Offer",
          priceCurrency: "THB",
          price: product.price,
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url,
        };

  const aggregateRating =
    reviews.length > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
          reviewCount: reviews.length,
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
    sku: product.slug,
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
