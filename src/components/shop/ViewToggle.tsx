"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";
import { LayoutGrid, List } from "lucide-react";
import type { ShopSearchParams } from "@/lib/filter-products";

/** Grid or one-per-row, kept in the URL so the choice survives paging. */
export default function ViewToggle({ current }: { current: ShopSearchParams }) {
  const router = useRouter();
  const view = current.view === "list" ? "list" : "grid";

  function setView(next: "grid" | "list") {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "view") params.set(k, v);
    });
    if (next === "list") params.set("view", "list");
    const qs = params.toString();
    router.push(qs ? `/shop?${qs}` : "/shop", { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-surface-line p-1">
      {(
        [
          ["grid", LayoutGrid, "แสดงแบบตาราง"],
          ["list", List, "แสดงแบบรายการ"],
        ] as const
      ).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setView(key)}
          aria-label={label}
          aria-pressed={view === key}
          className={clsx(
            "grid h-8 w-8 place-items-center rounded-lg transition-colors",
            view === key ? "bg-brand-gradient-soft text-brand-800" : "text-slate-400 hover:text-brand-ink"
          )}
        >
          <Icon size={17} />
        </button>
      ))}
    </div>
  );
}
