import { products } from "@/data/products";
import { Product } from "@/data/types";

export type ShopSearchParams = {
  category?: string;
  brand?: string;
  concern?: string;
  sort?: string;
  q?: string;
  minPrice?: string;
  maxPrice?: string;
};

export function filterProducts(params: ShopSearchParams): Product[] {
  let result = [...products];

  if (params.category) {
    result = result.filter((p) => p.category === params.category);
  }
  if (params.brand) {
    result = result.filter((p) => p.brand.toLowerCase().replace(/[^a-z0-9]/g, "-") === params.brand);
  }
  if (params.concern) {
    result = result.filter((p) => p.concerns.includes(params.concern as Product["concerns"][number]));
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.shortDesc.toLowerCase().includes(q)
    );
  }
  if (params.minPrice) {
    result = result.filter((p) => p.price >= Number(params.minPrice));
  }
  if (params.maxPrice) {
    result = result.filter((p) => p.price <= Number(params.maxPrice));
  }

  switch (params.sort) {
    case "price-asc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      result.sort((a, b) => b.rating - a.rating);
      break;
    case "bestseller":
      result.sort((a, b) => (b.badges?.includes("Bestseller") ? 1 : 0) - (a.badges?.includes("Bestseller") ? 1 : 0));
      break;
    default:
      break;
  }

  return result;
}
