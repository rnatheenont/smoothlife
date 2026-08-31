"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Star, Check, X } from "lucide-react";

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <MessageSquareText size={22} className="text-brand-emerald" /> รีวิวรออนุมัติ
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          อนุมัติแล้วรีวิวจะขึ้นแสดงในหน้าสินค้าทันที และลูกค้าจะได้รับแต้มตามระดับรีวิว
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ไม่มีรีวิวที่รออนุมัติในตอนนี้</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl2 border border-slate-100 p-4 shadow-card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-ink truncate">{r.author_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {r.product_slug} · {new Date(r.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-gradient-soft text-brand-emerald text-[11px] font-semibold px-2.5 py-1">
                  +{r.points_awarded ?? 0} แต้ม
                </span>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} className={n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                ))}
                <span className="ml-2 text-[11px] text-slate-400">
                  {r.review_type ? REVIEW_TYPE_LABELS[r.review_type] ?? r.review_type : "-"}
                </span>
              </div>
              {r.title && <p className="text-sm font-semibold text-brand-ink mb-1">{r.title}</p>}
              {r.body && <p className="text-sm text-slate-600 whitespace-pre-wrap mb-2">{r.body}</p>}
              {r.media_urls && r.media_urls.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto">
                  {r.media_urls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => act(r.id, "approve")}
                  disabled={busyId === r.id}
                  className="flex-1 flex items-center justify-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold py-2 disabled:opacity-50"
                >
                  <Check size={14} /> อนุมัติ
                </button>
                <button
                  onClick={() => act(r.id, "reject")}
                  disabled={busyId === r.id}
                  className="flex-1 flex items-center justify-center gap-1 rounded-full border border-rose-200 text-rose-500 text-xs font-semibold py-2 disabled:opacity-50"
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
