"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Heart,
  ShoppingBag,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Star,
  MessageCircleQuestion,
} from "lucide-react";
import { Product } from "@/data/types";
import type { ReviewRow } from "@/app/api/reviews/route";
import type { QuestionRow } from "@/app/api/product-questions/route";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import MobileStickyBar from "./MobileStickyBar";
import { useCart, useWishlist } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

const tabs = [
  { id: "benefits", label: "คุณประโยชน์และส่วนผสม" },
  { id: "howto", label: "เหมาะกับใครและวิธีใช้" },
  { id: "compare", label: "เปรียบเทียบและทางเลือกอื่น" },
  { id: "reviews", label: "รีวิวและคำถาม" },
  { id: "delivery", label: "สต็อกและการจัดส่ง" },
];

export default function ProductDetailInteractive({
  product,
  related,
  reviews,
  questions,
}: {
  product: Product;
  related: Product[];
  reviews: ReviewRow[];
  questions: QuestionRow[];
}) {
  const images = [product.image, product.image2].filter(Boolean) as string[];
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("benefits");
  const [added, setAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variantId);
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { user } = useAuth();
  const router = useRouter();
  const activeImage = images[activeIndex] || images[0];
  const touchStartX = useRef<number | null>(null);

  function showPrev() {
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }
  function showNext() {
    setActiveIndex((i) => (i + 1) % images.length);
  }
  function onImageTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onImageTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) showPrev();
    else if (delta < -SWIPE_THRESHOLD) showNext();
  }
  const selectedVariant =
    product.variants.find((v) => v.variantId === selectedVariantId) || product.variants[0];
  const hasSizeChoice = product.variants.length > 1;

  const [reviewsList, setReviewsList] = useState(reviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessPoints, setReviewSuccessPoints] = useState<number | null>(null);
  const avgRating = reviewsList.length
    ? reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length
    : 0;

  const [questionsList, setQuestionsList] = useState(questions);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  function requireLoginThen(action: () => void) {
    if (!user) {
      router.push(`/account/login?returnTo=/product/${product.slug}`);
      return;
    }
    action();
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: product.slug, rating: reviewRating, title: reviewTitle, body: reviewBody }),
      });
      const data = await res.json();
      if (!data.ok) {
        setReviewError(data.error || "ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setReviewsList((prev) => [data.review, ...prev]);
      setReviewTitle("");
      setReviewBody("");
      setReviewRating(5);
      setShowReviewForm(false);
      if (data.pointsAwarded) {
        setReviewSuccessPoints(data.pointsAwarded);
        setTimeout(() => setReviewSuccessPoints(null), 5000);
      }
    } catch {
      setReviewError("ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQuestionSubmitting(true);
    setQuestionError(null);
    try {
      const res = await fetch("/api/product-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: product.slug, question: questionText }),
      });
      const data = await res.json();
      if (!data.ok) {
        setQuestionError(data.error || "ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setQuestionsList((prev) => [data.question, ...prev]);
      setQuestionText("");
      setShowQuestionForm(false);
    } catch {
      setQuestionError("ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setQuestionSubmitting(false);
    }
  }

  function handleAdd() {
    addItem(product.slug, qty, selectedVariant.variantId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  const buyButtonRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div
            className="relative aspect-square rounded-xl2 overflow-hidden bg-surface-soft select-none touch-pan-y"
            onTouchStart={onImageTouchStart}
            onTouchEnd={onImageTouchEnd}
          >
            <Image src={activeImage} alt={product.name} fill className="object-cover" priority />
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((img, i) => (
                  <span
                    key={img}
                    className={`h-1.5 rounded-full transition-all shadow-[0_0_0_1px_rgba(0,0,0,0.15)] ${
                      i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveIndex(i)}
                  className={`relative h-16 w-16 rounded-lg overflow-hidden border-2 ${
                    i === activeIndex ? "border-brand-teal" : "border-transparent"
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-brand-teal">{product.brand}</span>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mt-1">{product.name}</h1>
          {reviewsList.length > 0 && (
            <button onClick={() => setTab("reviews")} className="flex items-center gap-2 mt-2">
              <StarRating rating={avgRating} />
              <span className="text-sm text-slate-500">
                {avgRating.toFixed(1)} ({reviewsList.length} รีวิว)
              </span>
            </button>
          )}
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl font-bold text-brand-ink">{formatTHB(selectedVariant.price)}</span>
            {selectedVariant.compareAtPrice ? (
              <span className="text-lg text-slate-400 line-through">{formatTHB(selectedVariant.compareAtPrice)}</span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 mt-4">{product.shortDesc}</p>
          {typeof selectedVariant.quantity === "number" &&
            selectedVariant.quantity > 0 &&
            selectedVariant.quantity <= 10 && (
              <p className="text-xs font-semibold text-amber-600 mt-2">เหลือเพียง {selectedVariant.quantity} ชิ้นในสต็อก</p>
            )}

          {hasSizeChoice ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">เลือกขนาด</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.variantId}
                    onClick={() => setSelectedVariantId(v.variantId)}
                    disabled={!v.inStock}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      selectedVariant.variantId === v.variantId
                        ? "border-brand-emerald bg-brand-gradient-soft text-brand-ink"
                        : v.inStock
                        ? "border-slate-200 text-slate-600 hover:border-brand-teal"
                        : "border-slate-100 text-slate-300 line-through cursor-not-allowed"
                    }`}
                  >
                    {v.size || v.variantId}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            product.size && <p className="text-xs text-slate-400 mt-1">ขนาด: {product.size}</p>
          )}

          <div ref={buyButtonRef} className="flex items-center gap-3 mt-6">
            <div className="flex items-center border border-slate-200 rounded-full">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2.5" aria-label="ลดจำนวน">
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="p-2.5" aria-label="เพิ่มจำนวน">
                <Plus size={14} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={!selectedVariant.inStock}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              {added ? <CheckCircle2 size={16} /> : <ShoppingBag size={16} />}
              {added ? "เพิ่มลงตะกร้าแล้ว" : selectedVariant.inStock ? "เพิ่มลงตะกร้า" : "สินค้าหมด"}
            </button>
            <button
              onClick={() => toggle(product.slug)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200"
              aria-label="Wishlist"
            >
              <Heart size={18} className={has(product.slug) ? "fill-rose-500 text-rose-500" : "text-slate-400"} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-6 text-xs text-slate-500">
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-soft p-3 text-center">
              <Truck size={16} className="text-brand-emerald" /> ส่งฟรีเมื่อครบ 990.-
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-soft p-3 text-center">
              <ShieldCheck size={16} className="text-brand-emerald" /> ของแท้ 100% มีอย.
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-surface-soft p-3 text-center">
              <RotateCcw size={16} className="text-brand-emerald" /> คืนสินค้าได้ใน 14 วัน
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12">
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? "border-brand-emerald text-brand-emerald" : "border-transparent text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="py-6 md:py-8">
          {tab === "benefits" && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-brand-ink mb-3">คุณประโยชน์</h3>
                <ul className="space-y-2">
                  {product.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={16} className="text-brand-emerald mt-0.5 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-600 mt-4">{product.shortDesc}</p>
              </div>
              <div>
                <h3 className="font-bold text-brand-ink mb-3">ส่วนผสมสำคัญ</h3>
                <p className="text-sm text-slate-600">
                  {product.ingredients || "ยังไม่มีข้อมูลส่วนผสมสำหรับสินค้านี้ค่ะ กรุณาติดต่อสอบถามเพิ่มเติมได้ที่ทีมงาน"}
                </p>
              </div>
            </div>
          )}
          {tab === "howto" && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-brand-ink mb-3">เหมาะสำหรับใคร</h3>
                <p className="text-sm text-slate-600">{product.whoFor}</p>
              </div>
              <div>
                <h3 className="font-bold text-brand-ink mb-3">วิธีใช้</h3>
                <p className="text-sm text-slate-600">{product.howToUse}</p>
              </div>
            </div>
          )}
          {tab === "compare" && (
            <div>
              <h3 className="font-bold text-brand-ink mb-4">เปรียบเทียบและทางเลือกอื่น</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-4 font-medium">สินค้า</th>
                      <th className="py-2 pr-4 font-medium">ราคา</th>
                      <th className="py-2 pr-4 font-medium">แบรนด์</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 bg-brand-gradient-soft">
                      <td className="py-2.5 pr-4 font-medium">{product.name} (สินค้านี้)</td>
                      <td className="py-2.5 pr-4">{formatTHB(product.price)}</td>
                      <td className="py-2.5 pr-4">{product.brand}</td>
                    </tr>
                    {related.slice(0, 3).map((r) => (
                      <tr key={r.slug} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4">{r.name}</td>
                        <td className="py-2.5 pr-4">{formatTHB(r.price)}</td>
                        <td className="py-2.5 pr-4">{r.brand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "reviews" && (
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-ink">รีวิวจากลูกค้า</h3>
                  <button
                    onClick={() => requireLoginThen(() => setShowReviewForm((s) => !s))}
                    className="text-xs font-semibold text-brand-emerald hover:text-brand-sky transition-colors"
                  >
                    + เขียนรีวิว
                  </button>
                </div>

                {reviewSuccessPoints !== null && (
                  <p className="mb-4 text-xs font-semibold text-brand-emerald">
                    ส่งรีวิวสำเร็จ ได้รับ {reviewSuccessPoints} คะแนน ขอบคุณค่ะ!
                  </p>
                )}

                {showReviewForm && (
                  <form onSubmit={submitReview} className="mb-5 rounded-xl border border-slate-100 p-4 space-y-3">
                    <p className="text-xs text-slate-400">
                      ต้องซื้อสินค้านี้และชำระเงินสำเร็จก่อนจึงจะรีวิวได้ครับ รับ 20 คะแนนเมื่อรีวิวสำเร็จ
                    </p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button type="button" key={n} onClick={() => setReviewRating(n)} aria-label={`${n} ดาว`}>
                          <Star size={20} className={n <= reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                        </button>
                      ))}
                    </div>
                    <input
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="หัวข้อรีวิว (ไม่บังคับ)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-teal"
                    />
                    <textarea
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      placeholder="เล่าประสบการณ์การใช้สินค้านี้..."
                      required
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-teal resize-none"
                    />
                    {reviewError && <p className="text-xs text-rose-500">{reviewError}</p>}
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="rounded-full bg-brand-gradient text-white text-sm font-semibold px-5 py-2 disabled:opacity-50"
                    >
                      {reviewSubmitting ? "กำลังส่ง..." : "ส่งรีวิว"}
                    </button>
                  </form>
                )}

                {reviewsList.length === 0 ? (
                  <p className="text-sm text-slate-400">ยังไม่มีรีวิวสำหรับสินค้านี้ค่ะ เป็นคนแรกที่รีวิวสิ!</p>
                ) : (
                  <div className="space-y-5">
                    {reviewsList.map((r) => (
                      <div key={r.id} className="border-b border-slate-100 pb-5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{r.author_name}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(r.created_at).toLocaleDateString("th-TH")}
                          </span>
                        </div>
                        <StarRating rating={r.rating} size={12} />
                        {r.title && <p className="text-sm font-medium mt-1.5">{r.title}</p>}
                        <p className="text-sm text-slate-600 mt-1">{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-ink">คำถามจากลูกค้า</h3>
                  <button
                    onClick={() => requireLoginThen(() => setShowQuestionForm((s) => !s))}
                    className="text-xs font-semibold text-brand-emerald hover:text-brand-sky transition-colors"
                  >
                    + ถามคำถาม
                  </button>
                </div>

                {showQuestionForm && (
                  <form onSubmit={submitQuestion} className="mb-5 rounded-xl border border-slate-100 p-4 space-y-3">
                    <textarea
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="อยากรู้อะไรเกี่ยวกับสินค้านี้..."
                      required
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-teal resize-none"
                    />
                    {questionError && <p className="text-xs text-rose-500">{questionError}</p>}
                    <button
                      type="submit"
                      disabled={questionSubmitting}
                      className="rounded-full bg-brand-gradient text-white text-sm font-semibold px-5 py-2 disabled:opacity-50"
                    >
                      {questionSubmitting ? "กำลังส่ง..." : "ส่งคำถาม"}
                    </button>
                  </form>
                )}

                {questionsList.length === 0 ? (
                  <p className="text-sm text-slate-400">ยังไม่มีคำถามสำหรับสินค้านี้ค่ะ ถามได้เลย!</p>
                ) : (
                  <div className="space-y-5">
                    {questionsList.map((q) => (
                      <div key={q.id} className="border-b border-slate-100 pb-5">
                        <p className="text-sm font-medium flex items-start gap-1.5">
                          <MessageCircleQuestion size={15} className="text-brand-emerald shrink-0 mt-0.5" />
                          {q.question}
                        </p>
                        {q.answer ? (
                          <p className="text-sm text-slate-600 mt-1.5 pl-[22px]">{q.answer}</p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1.5 pl-[22px] italic">รอทีมงานตอบกลับ</p>
                        )}
                        <span className="text-xs text-slate-400 pl-[22px] block mt-1">
                          {q.author_name} · {new Date(q.created_at).toLocaleDateString("th-TH")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "delivery" && (
            <div className="grid md:grid-cols-3 gap-6 text-sm text-slate-600">
              <div>
                <h4 className="font-bold text-brand-ink mb-2">สถานะสินค้า</h4>
                <p className={selectedVariant.inStock ? "text-brand-emerald font-medium" : "text-rose-500 font-medium"}>
                  {selectedVariant.inStock ? "มีสินค้าพร้อมส่ง" : "สินค้าหมดชั่วคราว"}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-brand-ink mb-2">การจัดส่ง</h4>
                <p>จัดส่งภายใน 1-3 วันทำการ ส่งฟรีเมื่อซื้อครบ 990 บาทขึ้นไป</p>
              </div>
              <div>
                <h4 className="font-bold text-brand-ink mb-2">การชำระเงิน</h4>
                <p>รองรับบัตรเครดิต, โอนเงิน, และ PromptPay QR</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileStickyBar hideWhenVisible={buyButtonRef}>
        <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
          <Image src={product.image} alt="" fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 truncate">
            {product.name}
            {selectedVariant.size ? ` · ${selectedVariant.size}` : ""}
          </p>
          <p className="text-sm font-bold text-brand-ink">{formatTHB(selectedVariant.price)}</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!selectedVariant.inStock}
          className="flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient text-white font-semibold px-5 py-2.5 text-xs shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
        >
          {added ? <CheckCircle2 size={15} /> : <ShoppingBag size={15} />}
          {added ? "เพิ่มแล้ว" : selectedVariant.inStock ? "เพิ่มลงตะกร้า" : "สินค้าหมด"}
        </button>
      </MobileStickyBar>
    </div>
  );
}
