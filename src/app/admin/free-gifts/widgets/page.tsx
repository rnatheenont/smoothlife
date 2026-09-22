"use client";

import { SlidersHorizontal } from "lucide-react";
import WidgetsPanel from "@/components/admin/WidgetsPanel";
import { PageHeader } from "@/components/admin/layout-kit";

export default function AdminWidgetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<SlidersHorizontal size={20} className="text-brand-emerald" />}
        title="กล่องโปรโมชั่นหน้าเว็บ"
        subtitle="เปิด/ปิดและปรับแต่งวิดเจ็ตที่แสดงของแถมและโปรโมชั่นบนหน้าร้าน"
      />
      <WidgetsPanel />
    </div>
  );
}
