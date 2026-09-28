import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/admin/layout-kit";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { UUID_RE } from "@/lib/flash-sale";
import { getProductBySlug } from "@/data/products";
import { unpublishedProducts } from "@/lib/shopify-admin";
import CampaignMonitor from "./CampaignMonitor";
import "../heroui-demo.css";

// Admin → Flash Sale → one campaign, watched live.

export const dynamic = "force-dynamic";

export default async function FlashSaleMonitorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id) || !supabaseConfigured()) notFound();

  const [campaign] = await supabaseRest<{ id: string; title: string; product_slugs: string[] }[]>(
    `flash_sale_campaigns?id=eq.${pgValue(id)}&select=id,title,product_slugs&limit=1`
  ).catch(() => []);
  if (!campaign) notFound();

  // The monitor labels its rows by slug; give it the names customers see.
  // Unpublished products are not in the catalogue, so Shopify answers for
  // those — the same fallback the sale page uses.
  const missing = campaign.product_slugs.filter((slug) => !getProductBySlug(slug));
  const drafts = missing.length ? new Map((await unpublishedProducts()).map((p) => [p.slug, p.name])) : new Map();
  const names = Object.fromEntries(
    campaign.product_slugs.map((slug) => [slug, getProductBySlug(slug)?.name ?? drafts.get(slug) ?? slug])
  );

  return (
    <div>
      <PageHeader
        title={campaign.title}
        subtitle="คิวสด ผู้ที่ถือสิทธิ์อยู่ เวลาที่เหลือ และรายการที่ต้องตามเก็บ — อัปเดตทุก 5 วินาที"
        actions={
          <span className="flex items-center gap-2">
            <Link
              href={`/flash-sale/${campaign.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
            >
              เปิดหน้าขาย <ArrowUpRight size={13} aria-hidden />
            </Link>
            <Link
              href="/admin/flash-sale"
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
            >
              <ArrowLeft size={13} aria-hidden /> แคมเปญทั้งหมด
            </Link>
          </span>
        }
      />
      <CampaignMonitor id={campaign.id} names={names} />
    </div>
  );
}
