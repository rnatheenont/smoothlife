"use client";

import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/lib/cart-context";
import { cardFromLite } from "@/data/cart-product";
import { useLiteProducts } from "@/lib/use-lite-products";
import AccountLayout from "@/components/account/AccountLayout";
import ProductCard from "@/components/ProductCard";

function WishlistContent() {
  const { slugs } = useWishlist();
  // The list lives on this device and in the customer's account, not in the
  // catalogue — so the catalogue is asked about exactly these slugs rather
  // than shipped to the browser to be filtered.
  const { products } = useLiteProducts(slugs);
  const items = products;

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <span className="relative mx-auto block h-20 w-20">
          <Image src="/mascot/smoothie-new.png" alt="" fill sizes="80px" className="object-contain" />
        </span>
        <p className="text-slate-500 mt-2">คุณยังไม่มีสินค้าในรายการโปรด</p>
        <Link href="/shop" className="mt-4 inline-flex h-11 items-center text-sm font-semibold text-brand-800">เลือกดูสินค้า</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">รายการโปรดและรูทีนที่บันทึกไว้</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
        {items.map((p) => (
          <ProductCard key={p.slug} product={cardFromLite(p)} />
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
