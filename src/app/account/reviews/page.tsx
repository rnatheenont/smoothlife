"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MessageSquareText } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { getProductBySlug } from "@/data/products";

type MyReviewRow = {
  id: string;
  product_slug: string;
  rating: number;
  title: string | null;
  body: string;
  review_type: string | null;
  points_awarded: number | null;
  status: string;
  created_at: string;
  approved_at: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_review: { label: "รอตรวจสอบ", className: "bg-amber-50 text-amber-600" },
  approved: { label: "อนุมัติแล้ว", className: "bg-brand-gradient-soft text-brand-emerald" },
  rejected: { label: "ไม่ผ่านการตรวจสอบ", className: "bg-rose-50 text-rose-500" },
};

function ReviewsContent() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<MyReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/reviews");
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "โหลดข้อมูลไม่สำเร็จ");
          return;
        }
        setReviews(data.reviews || []);
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-2 flex items-center gap-2">
        <MessageSquareText size={22} className="text-brand-emerald" /> รีวิวของฉัน
      </h1>
      <p className="text-sm text-slate-500 mb-6">ประวัติรีวิวสินค้าที่คุณเคยเขียน และสถานะการอนุมัติ</p>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">กำลังโหลด...</p>
      ) : error ? (
        <p className="text-sm text-rose-500 text-center py-10">{error}</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500">คุณยังไม่เคยเขียนรีวิวสินค้าเลยค่ะ</p>
          <Link href="/account/orders" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">
            ไปดูคำสั่งซื้อของคุณ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const product = getProductBySlug(r.product_slug);
            const status = STATUS_LABELS[r.status] ?? { label: r.status, className: "bg-slate-100 text-slate-500" };
            return (
              <div key={r.id} className="rounded-xl2 border border-slate-100 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  {product && (
                    <Link href={`/product/${product.slug}`} className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                      <Image src={product.image} alt={product.name} fill sizes="56px" className="object-cover" />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {product ? (
                          <Link href={`/product/${product.slug}`} className="text-sm font-bold text-brand-ink truncate block hover:text-brand-emerald">
                            {product.name}
                          </Link>
                        ) : (
                          <p className="text-sm font-bold text-brand-ink truncate">{r.product_slug}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("th-TH")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full text-[11px] font-semibold px-2.5 py-1 ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={13} className={n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                      ))}
                      {r.points_awarded != null && (
                        <span className="ml-2 text-[11px] font-semibold text-brand-emerald">
                          {r.status === "approved" ? `+${r.points_awarded} แต้ม` : `+${r.points_awarded} แต้ม (รออนุมัติ)`}
                        </span>
                      )}
                    </div>
                    {r.title && <p className="text-sm font-semibold text-brand-ink mt-2">{r.title}</p>}
                    {r.body && <p className="text-sm text-slate-600 mt-1 line-clamp-3">{r.body}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyReviewsPage() {
  return (
    <AccountLayout>
      <ReviewsContent />
    </AccountLayout>
  );
}
