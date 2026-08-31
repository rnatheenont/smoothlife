"use client";

import { useRouter } from "next/navigation";
import { ShopSearchParams } from "@/lib/filter-products";

export default function SortSelect({ current }: { current: ShopSearchParams }) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (e.target.value) params.set("sort", e.target.value);
    else params.delete("sort");
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <select
      defaultValue={current.sort || ""}
      onChange={onChange}
      className="h-10 w-full lg:w-auto rounded-full border border-slate-200 text-sm pl-4 pr-8 outline-hidden bg-white text-center lg:text-left"
    >
      <option value="">แนะนำ</option>
      <option value="bestseller">ขายดีที่สุด</option>
      <option value="price-asc">ราคา: ต่ำ-สูง</option>
      <option value="price-desc">ราคา: สูง-ต่ำ</option>
      <option value="rating">คะแนนสูงสุด</option>
    </select>
  );
}
