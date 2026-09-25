import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/layout-kit";
import { catalogueWithDrafts, saleCatalogue, saleGroups } from "@/lib/flash-sale-catalogue";
import CreateCampaign from "./CreateCampaign";
import "../heroui-demo.css";

// Admin → Flash Sale → สร้างแคมเปญจริง, and ?id= to edit one.
//
// The form itself is CampaignSetup, the same one the simulator uses, because
// there is no version of "the real one should be worse" that makes sense —
// and editing deserves the same picker and the same price preview that
// creating gets, rather than a smaller form that can only move dates.

// Rendered per request: the form defaults to starting ten minutes from now.
export const dynamic = "force-dynamic";

export default async function CreateFlashSaleCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const editing = Boolean((await searchParams).id);
  // Drafts and unlisted products are in the picker here, so a sale can be set
  // up before the product goes live. Groups stay built from the published
  // catalogue: a category is a shelf customers can see.
  const catalogue = await catalogueWithDrafts();
  return (
    <div>
      <PageHeader
        title={editing ? "แก้ไขแคมเปญ Flash Sale" : "สร้างแคมเปญ Flash Sale"}
        subtitle={
          editing
            ? "แคมเปญที่เปิดขายไปแล้วจะแก้ได้เฉพาะชื่อ หน้าขาย และเวลาปิด — สต็อกกับราคาคือสิ่งที่ลูกค้าเข้าคิวมาแล้ว"
            : "เลือกสินค้า ตั้งวันเวลาและราคา แล้วระบบจะเปิดและปิดการขายให้เองตามเวลา"
        }
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
      <CreateCampaign catalogue={catalogue} groups={saleGroups(saleCatalogue())} now={Date.now()} />
    </div>
  );
}
