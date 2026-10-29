"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import DrawRehearsal from "./DrawRehearsal";

// The rehearsal on a page of its own, for the night itself: nothing on
// screen but the machine and the list. The same component is a tab of the
// campaign console, which is where it is found while the campaign is still
// running.

export default function LuckyDrawPreviewPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/campaigns"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-brand-ink"
          >
            <ArrowLeft size={13} aria-hidden /> กลับไปหน้ากิจกรรม
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-brand-ink">
            <Sparkles size={18} className="text-brand-emerald" aria-hidden />
            ซ้อมจับรางวัล
          </h1>
        </div>
        <Badge tone="warning">
          <TriangleAlert size={12} aria-hidden /> โหมดทดลอง · ยังไม่บันทึกผล
        </Badge>
      </div>

      <DrawRehearsal />
    </div>
  );
}
