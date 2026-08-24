import type { Product } from "@/data/types";
import type { ReviewRow } from "@/app/api/reviews/route";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.smoothlife.com";

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
