"use client";

import { SlidersHorizontal } from "lucide-react";
import WidgetsPanel from "@/components/admin/WidgetsPanel";

export default function AdminWidgetsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <SlidersHorizontal size={22} className="text-brand-emerald" /> Widgets
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          เปิด/ปิดและปรับแต่งวิดเจ็ตที่แสดงของแถมและโปรโมชั่นบนหน้าร้าน
        </p>
      </div>
      <WidgetsPanel />
    </div>
  );
}
