"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Heart, ShoppingBag, Minus, Plus, Truck, ShieldCheck, RotateCcw, CheckCircle2 } from "lucide-react";
import { Product, Review } from "@/data/types";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import MobileStickyBar from "./MobileStickyBar";
import { useCart, useWishlist } from "@/lib/cart-context";

const tabs = [
  { id: "benefits", label: "คุณประโยชน์และส่วนผสม" },
  { id: "howto", label: "เหมาะกับใครและวิธีใช้" },
  { id: "compare", label: "เปรียบเทียบและทางเลือกอื่น" },
  { id: "reviews", label: "รีวิวจากลูกค้าจริง" },
  { id: "delivery", label: "สต็อกและการจัดส่ง" },
];

export default function ProductDetailInteractive({
  product,
  related,
  reviews,
}: {
  product: Product;
  related: Product[];
  reviews: Review[];
}) {
  const [activeImage, setActiveImage] = useState(product.image);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("benefits");
  const [added, setAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variantId);
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const images = [product.image, product.image2].filter(Boolean) as string[];
  const selectedVariant =
    product.variants.find((v) => v.variantId === selectedVariantId) || product.variants[0];
  const hasSizeChoice = product.variants.length > 1;

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
          <div className="relative aspect-square rounded-xl2 overflow-hidden bg-surface-soft">
            <Image src={activeImage} alt={product.name} fill className="object-cover" priority />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(img)}
                  className={`relative h-16 w-16 rounded-lg overflow-hidden border-2 ${
                    activeImage === img ? "border-brand-teal" : "border-transparent"
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
          {product.reviewCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={product.rating} />
              <span className="text-sm text-slate-500">{product.rating} ({product.reviewCount} รีวิว)</span>
            </div>
          )}
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl font-bold text-brand-ink">{formatTHB(selectedVariant.price)}</span>
            {selectedVariant.compareAtPrice ? (
              <span className="text-lg text-slate-400 line-through">{formatTHB(selectedVariant.compareAtPrice)}</span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 mt-4">{product.shortDesc}</p>

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
                      <th className="py-2 pr-4 font-medium">คะแนน</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 bg-brand-gradient-soft">
                      <td className="py-2.5 pr-4 font-medium">{product.name} (สินค้านี้)</td>
                      <td className="py-2.5 pr-4">{formatTHB(product.price)}</td>
                      <td className="py-2.5 pr-4">{product.rating} ★</td>
                    </tr>
                    {related.slice(0, 3).map((r) => (
                      <tr key={r.slug} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4">{r.name}</td>
                        <td className="py-2.5 pr-4">{formatTHB(r.price)}</td>
                        <td className="py-2.5 pr-4">{r.rating} ★</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "reviews" && (
            <div>
              <h3 className="font-bold text-brand-ink mb-4">รีวิวจากลูกค้าที่ซื้อจริง</h3>
              <div className="space-y-5">
                {reviews.map((r, i) => (
                  <div key={i} className="border-b border-slate-100 pb-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{r.author}</span>
                        {r.verified && (
                          <span className="text-[10px] font-semibold text-brand-emerald bg-brand-gradient-soft px-2 py-0.5 rounded-full">
                            ซื้อสินค้าจริง
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{r.date}</span>
                    </div>
                    <StarRating rating={r.rating} size={12} />
                    <p className="text-sm font-medium mt-1.5">{r.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{r.body}</p>
                  </div>
                ))}
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
