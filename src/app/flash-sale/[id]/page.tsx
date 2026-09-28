import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/data/products";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { unpublishedProducts } from "@/lib/shopify-admin";
import { UUID_RE } from "@/lib/flash-sale";
import FlashSaleLive, { type LiveProduct } from "@/components/flash-sale/FlashSaleLive";
import type { CampaignTheme } from "@/components/flash-sale/special";
import { DEFAULT_ACCENT } from "@/lib/flash-sale-campaigns";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

// A flash-sale campaign's sale page: real stock, real queue (fs_* functions).
// The page itself only needs what doesn't change during the sale — title and
// products; everything live comes from /api/flash-sale/[id].
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  product_slugs: string[];
  kind: "regular" | "special";
  published?: boolean | null;
  hero_image_url: string | null;
  hero_headline: string | null;
  hero_note: string | null;
  hero_align: "top" | "center" | "bottom";
  accent_color: string | null;
  faq: { q: string; a: string }[];
  flash_sales: { product_slug: string; sale_price: number | string | null }[];
};

async function getCampaign(id: string): Promise<Row | null> {
  if (!UUID_RE.test(id) || !supabaseConfigured()) return null;
  const rows = await supabaseRest<Row[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=id,title,product_slugs,kind,published,hero_image_url,hero_headline,hero_note,hero_align,accent_color,faq,flash_sales(product_slug,sale_price)`);
  return rows[0] ?? null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const campaign = await getCampaign((await props.params).id);
  return { title: campaign ? `${campaign.title} | Smoothlife.com` : "Flash Sale | Smoothlife.com" };
}

export default async function FlashSalePage(props: { params: Promise<{ id: string }> }) {
  const campaign = await getCampaign((await props.params).id);
  if (!campaign) notFound();
  // Taken off the air: the row, the queue and the orders all stay, the page
  // does not. Whoever is signed in to the console can still open it, because
  // a sale you cannot look at is a sale you cannot check before putting back.
  if (campaign.published === false && !verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value)) {
    notFound();
  }
  // The sale page describes its product out of the static catalogue, which is
  // generated from the Storefront API — so a campaign set up for a launch
  // that has not been published yet found nothing and rendered as "not
  // found". The console can pick those products; this has to be able to show
  // them. Shopify answers for whatever the catalogue does not have.
  const salePriceOf = (slug: string) => {
    const sale = campaign.flash_sales.find((s) => s.product_slug === slug)?.sale_price;
    return sale === null || sale === undefined ? null : Number(sale);
  };

  const missing = campaign.product_slugs.filter((slug) => !getProductBySlug(slug));
  const unpublished = missing.length
    ? new Map((await unpublishedProducts()).map((p) => [p.slug, p]))
    : new Map<string, never>();

  const products: LiveProduct[] = campaign.product_slugs
    .map((slug): LiveProduct | null => {
      const p = getProductBySlug(slug);
      if (p) {
        return {
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          image: p.image,
          price: p.variants.find((v) => v.variantId === p.variantId)?.price ?? p.price,
          compareAtPrice: p.compareAtPrice,
          salePrice: salePriceOf(p.slug),
        };
      }
      const u = unpublished.get(slug);
      return u
        ? {
            slug: u.slug,
            name: u.name,
            brand: u.brand,
            image: u.image,
            price: u.price,
            compareAtPrice: u.compareAtPrice,
            salePrice: salePriceOf(u.slug),
          }
        : null;
    })
    .filter((p): p is LiveProduct => Boolean(p));
  const theme: CampaignTheme = {
    kind: campaign.kind === "special" ? "special" : "regular",
    heroImage: campaign.hero_image_url,
    heroHeadline: campaign.hero_headline,
    heroNote: campaign.hero_note,
    heroAlign: campaign.hero_align ?? "top",
    accent: campaign.accent_color ?? DEFAULT_ACCENT,
    faq: Array.isArray(campaign.faq) ? campaign.faq : [],
  };
  return <FlashSaleLive campaignId={campaign.id} title={campaign.title} products={products} theme={theme} />;
}
