import { Product } from "./types";
import { generatedProductsLite } from "./products-lite.generated";

// The catalogue, card-sized.
//
// Pulled live from the Shopify storefront at smoothlife.com at build time
// (see scripts/fetch-products.js). No hand-written/demo products are mixed
// in — every item on the site is a real Shopify product.
//
// This is the catalogue every page and component imports, and it is
// deliberately the small one: name, brand, price, two pictures, a short line,
// ratings, stock and sizes. It used to be the whole thing — descriptions,
// ingredient lists, galleries — and because the cart, search and a dozen
// other client components import this module, all ~3 MB of it went to every
// visitor's browser on every page. The long fields are empty here.
//
// Code that needs a product's full text (the product page, the chat's
// product context, the SEO tools) reads ./product-details instead, and only
// server code may do that.

// The two prefixes the generator strips to keep the file small — see
// serialiseLite in scripts/fetch-products.js, which must stay in step.
const IMG_PREFIX = "https://cdn.shopify.com/s/files/1/0663/8334/7863/files/";
const GID_PREFIX = "gid://shopify/ProductVariant/";
const img = <T extends string | undefined>(u: T): T =>
  (u && u.startsWith("~") ? IMG_PREFIX + u.slice(1) : u) as T;
const gid = (id: string) => (id.startsWith("#") ? GID_PREFIX + id.slice(1) : id);

/** Expands one stored record into a full `Product`.
 *
 *  A product with one size is stored without its variant list, because the
 *  variant is the same numbers as the product; it is rebuilt here, with the
 *  stock count (`q`) that is the one thing the top level does not carry. */
function expand(p: Product & { q?: number }): Product {
  const { q, ...stored } = p;
  const product: Product = {
    ...stored,
    variantId: gid(stored.variantId),
    image: img(stored.image),
    image2: img(stored.image2),
    variants: stored.variants.map((v) => ({ ...v, variantId: gid(v.variantId), image: img(v.image) })),
  };
  if (product.variants.length > 0) return product;
  product.variants = [
    {
      variantId: product.variantId,
      size: product.size ?? "",
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      inStock: product.inStock,
      ...(typeof q === "number" ? { quantity: q } : {}),
    },
  ];
  return product;
}

export const products: Product[] = generatedProductsLite.map(expand);

export const isLiveCatalogue = products.length > 0;

const bySlug = new Map(products.map((p) => [p.slug, p]));

export function getProductBySlug(slug: string) {
  return bySlug.get(slug);
}

export function getRelatedProducts(product: Product, limit = 4) {
  return products
    .filter(
      (p) =>
        p.inStock &&
        p.slug !== product.slug &&
        (p.category === product.category ||
          p.brand === product.brand ||
          p.concerns.some((c) => product.concerns.includes(c)))
    )
    .slice(0, limit);
}
