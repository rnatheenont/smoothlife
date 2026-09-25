"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CampaignSetup, { type CatalogueItem, type ProductGroup } from "@/components/flash-sale-demo/CampaignSetup";
import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import { campaignBody } from "@/lib/flash-sale-campaign-body";

// Creating a real campaign, on the same form the simulator uses.
//
// There were two forms. This one was the plainer of the pair — no product
// list with pictures and prices, no group campaigns, no price preview, no
// banner fields — and it was the one behind "สร้างแคมเปญจริง", so the better
// form was the one that could not create anything real. They are the same
// component now; only what happens on submit differs.

export default function CreateCampaign({
  catalogue,
  groups,
  now,
}: {
  catalogue: CatalogueItem[];
  groups: ProductGroup[];
  now: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial: CampaignConfig = {
    mode: "single",
    kind: "regular",
    title: "",
    products: [],
    stockPerProduct: 25,
    windowMinutes: 15,
    maxRequeue: 10,
  };

  async function create(config: CampaignConfig, startsAt: number, endsAt?: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flash-sale/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignBody(config, startsAt, endsAt)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "สร้างแคมเปญไม่สำเร็จ");
      // Back to the list, which is where the new campaign now is — and where
      // its sale page, its schedule and the rest of the row can be seen.
      router.push("/admin/flash-sale");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างแคมเปญไม่สำเร็จ");
      setSaving(false);
    }
  }

  return (
    <>
      {error && <p className="mb-4 rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      <CampaignSetup config={initial} catalogue={catalogue} groups={groups} now={now} saving={saving} onCreate={create} />
    </>
  );
}
