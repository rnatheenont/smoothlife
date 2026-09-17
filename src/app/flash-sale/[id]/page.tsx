import { notFound } from "next/navigation";
import { getProductBySlug } from "@/data/products";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { UUID_RE } from "@/lib/flash-sale";
import FlashSaleLive, { type LiveProduct } from "@/components/flash-sale/FlashSaleLive";

// A flash-sale campaign's sale page: real stock, real queue (fs_* functions).
// The page itself only needs what doesn't change during the sale — title and
// products; everything live comes from /api/flash-sale/[id].
export const dynamic = "force-dynamic";

type Row = { id: string; title: string; product_slugs: string[] };

async function getCampaign(id: string): Promise<Row | null> {
  if (!UUID_RE.test(id) || !supabaseConfigured()) return null;
  const rows = await supabaseRest<Row[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=id,title,product_slugs`);
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
    .map((p) => ({ slug: p.slug, name: p.name, brand: p.brand, image: p.image, price: p.price, compareAtPrice: p.compareAtPrice }));
  return <FlashSaleLive campaignId={campaign.id} title={campaign.title} products={products} />;
}
