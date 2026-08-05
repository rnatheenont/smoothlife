"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/cart-context";
import { products } from "@/data/products";
import AccountGate from "@/components/AccountGate";
import ProductCard from "@/components/ProductCard";

function WishlistContent() {
  const { slugs } = useWishlist();
  const items = products.filter((p) => slugs.includes(p.slug));

  if (items.length === 0) {
    return (
      <div className="container-page py-16 text-center">
        <Heart size={40} className="mx-auto text-slate-300" />
        <p className="text-slate-500 mt-4">คุณยังไม่มีสินค้าในรายการโปรด</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">เลือกดูสินค้า</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl font-bold text-brand-ink mb-6">รายการโปรดและรูทีนที่บันทึกไว้</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}

export default function WishlistPage() {
  return (
    <AccountGate>
      <WishlistContent />
    </AccountGate>
  );
}
