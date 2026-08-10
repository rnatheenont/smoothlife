"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/cart-context";
import { products } from "@/data/products";
import AccountLayout from "@/components/account/AccountLayout";
import ProductCard from "@/components/ProductCard";

function WishlistContent() {
  const { slugs } = useWishlist();
  const items = products.filter((p) => slugs.includes(p.slug));

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <Heart size={40} className="mx-auto text-slate-300" />
        <p className="text-slate-500 mt-4">คุณยังไม่มีสินค้าในรายการโปรด</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">เลือกดูสินค้า</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">รายการโปรดและรูทีนที่บันทึกไว้</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}

export default function WishlistPage() {
  return (
    <AccountLayout>
      <WishlistContent />
    </AccountLayout>
  );
}
