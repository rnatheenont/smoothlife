import Link from "next/link";
import { ArrowUpRight, PlayCircle } from "lucide-react";
import CampaignList from "./CampaignList";

// Admin → Flash Sale: the campaigns, and nothing else.
//
// The simulator used to sit on this page under the list, which put a made-up
// sale's numbers next to real ones — and they were read as the same thing at
// least once. It lives at /admin/flash-sale/demo now, one click away.

export const dynamic = "force-dynamic";

export default function FlashSaleAdminPage() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Link
          href="/admin/flash-sale/demo"
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-surface-soft"
        >
          <PlayCircle size={15} aria-hidden /> ลองระบบ (จำลอง)
        </Link>
        <Link
          href="/admin/flash-sale/create"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          สร้างแคมเปญจริง <ArrowUpRight size={15} />
        </Link>
      </div>
      <CampaignList />
    </div>
  );
}
