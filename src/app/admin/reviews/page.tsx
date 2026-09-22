"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Star, Check, X, RefreshCw } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader } from "@/components/admin/layout-kit";

type PendingReview = {
  id: string;
  product_slug: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  review_type: string | null;
  media_urls: string[] | null;
  points_awarded: number | null;
  order_id: string | null;
  status: string;
  created_at: string;
};

const REVIEW_TYPE_LABELS: Record<string, string> = {
  star_only: "ให้ดาวอย่างเดียว",
  star_text: "ดาว + เขียนรีวิว",
  star_text_media: "ดาว + รีวิว + สื่อ",
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews?status=pending_review");
      const data = await res.json();
      setReviews(data.ok ? data.reviews : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) setReviews((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  useAdminAction({
    label: "รีเฟรชรายการรีวิว",
    icon: <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />,
    onClick: load,
    disabled: loading,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<MessageSquareText size={20} className="text-brand-emerald" />}
        title="รีวิวรออนุมัติ"
        subtitle="อนุมัติแล้วรีวิวจะขึ้นแสดงในหน้าสินค้าทันที และลูกค้าจะได้รับแต้มตามระดับรีวิว"
        actions={
          reviews.length > 0 && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-800">
              {reviews.length} รีวิว
            </span>
          )
        }
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl2 border border-slate-100 bg-white py-10 text-center text-sm text-slate-400">
          ไม่มีรีวิวที่รออนุมัติในตอนนี้
        </p>
      ) : (
        /* A grid, not a column. Moderation is comparison work — the reviewer
           reads several and approves the obvious ones — and one card per row
           on a wide screen made that a scroll instead of a glance. */
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl2 border border-slate-100 bg-white p-4 shadow-card">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-ink">{r.author_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {r.product_slug} · {new Date(r.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-gradient-soft px-2.5 py-1 text-[11px] font-semibold text-brand-800">
                  +{r.points_awarded ?? 0} แต้ม
                </span>
              </div>
              <div className="mb-2 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={14}
                    className={n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                  />
                ))}
                <span className="ml-2 text-[11px] text-slate-400">
                  {r.review_type ? (REVIEW_TYPE_LABELS[r.review_type] ?? r.review_type) : "-"}
                </span>
              </div>
              {r.title && <p className="mb-1 text-sm font-semibold text-brand-ink">{r.title}</p>}
              {r.body && <p className="mb-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{r.body}</p>}
              {r.media_urls && r.media_urls.length > 0 && (
                <div className="mb-2 flex gap-2 overflow-x-auto">
                  {r.media_urls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      width={64}
                      height={64}
                      className="size-16 shrink-0 rounded-l object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => act(r.id, "approve")}
                  disabled={busyId === r.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand-gradient py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check size={14} /> อนุมัติ
                </button>
                <button
                  onClick={() => act(r.id, "reject")}
                  disabled={busyId === r.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full border border-rose-200 py-2 text-xs font-semibold text-rose-500 disabled:opacity-50"
                >
                  <X size={14} /> ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
