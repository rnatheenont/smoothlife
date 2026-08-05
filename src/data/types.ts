export type Category =
  | "skincare"
  | "oral-care"
  | "hair-care"
  | "personal-care"
  | "wellness"
  | "body-care";

export type Concern =
  | "acne"
  | "dryness"
  | "dark-spots"
  | "aging"
  | "hair-scalp"
  | "sleep-stress";

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: Category;
  concerns: Concern[];
  price: number;
  compareAtPrice?: number;
  image: string;
  image2?: string;
  rating: number;
  reviewCount: number;
  badges?: ("Bestseller" | "New" | "Sale" | "BOGO" | "Bundle")[];
  shortDesc: string;
  description?: string;
  benefits: string[];
  howToUse: string;
  ingredients: string;
  whoFor: string;
  inStock: boolean;
  size?: string;
};

export type Brand = {
  slug: string;
  name: string;
  tagline: string;
  productCount: number;
  logo: string;
};

export type CategoryInfo = {
  slug: Category;
  name: string;
  nameTh: string;
  image: string;
};

export type ConcernInfo = {
  slug: Concern;
  name: string;
  nameTh: string;
  description: string;
  image: string;
};

export type Article = {
  slug: string;
  title: string;
  category: "guide" | "ingredient" | "routine" | "qa" | "video";
  excerpt: string;
  body: string[];
  image: string;
  sources: { name: string; url: string }[];
  readMins: number;
  productSlug?: string;
};

export type Review = {
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
};
