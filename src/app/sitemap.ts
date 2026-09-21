import { MetadataRoute } from "next";
import { products } from "@/data/products";
import { categories, concerns } from "@/data/categories";
import { collections } from "@/data/collections";
import { articles } from "@/data/articles";
import { brands } from "@/data/brands";
import { getPublicQuestions } from "@/lib/kb-public";

import { SITE_URL } from "@/lib/site-url";

const STATIC_ROUTES = [
  "",
  "/shop",
  "/brands",
  "/concern",
  "/about",
  "/about/experts",
  "/about/quality",
  "/about/sustainability",
  "/advisor",
  "/knowledge",
  "/knowledge/ingredients",
  "/knowledge/questions",
  "/knowledge/routines",
  "/knowledge/videos",
  "/help",
  "/help/contact",
  "/help/delivery",
  "/help/payment",
  "/promotions",
  "/stores",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
  }));

  for (const p of products) {
    entries.push({ url: `${SITE_URL}/product/${p.slug}`, lastModified: now });
  }
  for (const c of categories) {
    entries.push({ url: `${SITE_URL}/shop/${c.slug}`, lastModified: now });
  }
  for (const c of collections) {
    entries.push({ url: `${SITE_URL}/collections/${c.handle}`, lastModified: now });
  }
  for (const c of concerns) {
    entries.push({ url: `${SITE_URL}/concern/${c.slug}`, lastModified: now });
  }
  for (const a of articles) {
    entries.push({ url: `${SITE_URL}/knowledge/article/${a.slug}`, lastModified: now });
  }
  for (const b of brands) {
    entries.push({ url: `${SITE_URL}/brands#${b.slug}`, lastModified: now });
  }
  // Questions someone chose to publish. Read from the database rather than
  // the build, so publishing one does not need a deploy to be findable.
  for (const q of await getPublicQuestions()) {
    entries.push({
      url: `${SITE_URL}/knowledge/questions/${encodeURIComponent(q.public_slug)}`,
      lastModified: new Date(q.updated_at),
    });
  }

  return entries;
}
