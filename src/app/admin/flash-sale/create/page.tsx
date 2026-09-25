import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/layout-kit";
import { saleCatalogue, saleGroups } from "@/lib/flash-sale-catalogue";
import CreateCampaign from "./CreateCampaign";
import "../heroui-demo.css";

// Admin → Flash Sale → สร้างแคมเปญจริง.
//
// The form itself is CampaignSetup, the same one the simulator uses, because
// there is no version of "the real one should be worse" that makes sense.

// Rendered per request: the form defaults to starting ten minutes from now.
export const dynamic = "force-dynamic";

export default function CreateFlashSaleCampaignPage() {
  const catalogue = saleCatalogue();
  return (
    <div>
      <PageHeader
        title="สร้างแคมเปญ Flash Sale"
        subtitle="เลือกสินค้า ตั้งวันเวลาและราคา แล้วระบบจะเปิดและปิดการขายให้เองตามเวลา"
        actions={
          <Link
            href="/admin/flash-sale"
            className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
          >
            <ArrowLeft size={13} aria-hidden /> แคมเปญทั้งหมด
          </Link>
        }
      />
      {/* eslint-disable-next-line react-hooks/purity -- render time seeds the form's default start; the page is rendered per request */}
      <CreateCampaign catalogue={catalogue} groups={saleGroups(catalogue)} now={Date.now()} />
    </div>
  );
}
