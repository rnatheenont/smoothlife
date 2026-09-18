import { notFound } from "next/navigation";
import { getProductBySlug } from "@/data/products";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { UUID_RE } from "@/lib/flash-sale";
import FlashSaleLive, { type LiveProduct } from "@/components/flash-sale/FlashSaleLive";
import type { CampaignTheme } from "@/components/flash-sale/special";
import { DEFAULT_ACCENT } from "@/lib/flash-sale-campaigns";

// A flash-sale campaign's sale page: real stock, real queue (fs_* functions).
// The page itself only needs what doesn't change during the sale — title and
// products; everything live comes from /api/flash-sale/[id].
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  product_slugs: string[];
  kind: "regular" | "special";
  hero_image_url: string | null;
  hero_headline: string | null;
  hero_note: string | null;
  accent_color: string | null;
  faq: { q: string; a: string }[];
  flash_sales: { product_slug: string; sale_price: number | string | null }[];
};

async function getCampaign(id: string): Promise<Row | null> {
  if (!UUID_RE.test(id) || !supabaseConfigured()) return null;
  const rows = await supabaseRest<Row[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=id,title,product_slugs,kind,hero_image_url,hero_headline,hero_note,accent_color,faq,flash_sales(product_slug,sale_price)`);
  return rows[0] ?? null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const campaign = await getCampaign((await props.params).id);
  return { title: campaign ? `${campaign.title} | Smoothlife.com` : "Flash Sale | Smoothlife.com" };
}

export default async function FlashSalePage(props: { params: Promise<{ id: string }> }) {
  const campaign = await getCampaign((await props.params).id);
  if (!campaign) notFound();
  const products: LiveProduct[] = campaign.product_slugs
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const regular = p.variants.find((v) => v.variantId === p.variantId)?.price ?? p.price;
      const sale = campaign.flash_sales.find((s) => s.product_slug === p.slug)?.sale_price;
      return {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        image: p.image,
        price: regular,
        compareAtPrice: p.compareAtPrice,
        salePrice: sale === null || sale === undefined ? null : Number(sale),
      };
    });
  const theme: CampaignTheme = {
    kind: campaign.kind === "special" ? "special" : "regular",
    heroImage: campaign.hero_image_url,
    heroHeadline: campaign.hero_headline,
    heroNote: campaign.hero_note,
    accent: campaign.accent_color ?? DEFAULT_ACCENT,
    faq: Array.isArray(campaign.faq) ? campaign.faq : [],
  };
  return <FlashSaleLive campaignId={campaign.id} title={campaign.title} products={products} theme={theme} />;
}
