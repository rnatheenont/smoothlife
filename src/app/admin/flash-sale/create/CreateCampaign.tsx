"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import CampaignSetup, {
  type CatalogueItem,
  type EditingCampaign,
  type ProductGroup,
} from "@/components/flash-sale-demo/CampaignSetup";
import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import type { FlashSaleCampaignDTO } from "@/lib/flash-sale-campaigns";
import { campaignBody, campaignToConfig } from "@/lib/flash-sale-campaign-body";

// Creating a real campaign, and editing one, on the same form.
//
// There were two forms. This one was the plainer of the pair — no product
// list with pictures and prices, no group campaigns, no price preview, no
// banner fields — and it was the one behind "สร้างแคมเปญจริง", so the better
// form was the one that could not create anything real. They are the same
// component now; ?id= is the only difference, and it decides whether submit
// writes a new row or updates that one.

const BLANK: CampaignConfig = {
  mode: "single",
  kind: "regular",
  title: "",
  products: [],
  stockPerProduct: 25,
  windowMinutes: 15,
  maxRequeue: 10,
};

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
  const id = useSearchParams().get("id");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<FlashSaleCampaignDTO | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch("/api/admin/flash-sale/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error || "โหลดแคมเปญไม่สำเร็จ");
        const found = (json.campaigns as FlashSaleCampaignDTO[]).find((c) => c.id === id);
        if (!found) throw new Error("ไม่พบแคมเปญนี้ อาจถูกลบไปแล้ว");
        setLoaded(found);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดแคมเปญไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submit(config: CampaignConfig, startsAt: number, endsAt?: number) {
    setSaving(true);
    setError(null);
    try {
      const body = campaignBody(config, startsAt, endsAt);
      const res = await fetch(
        loaded ? `/api/admin/flash-sale/campaigns/${loaded.id}` : "/api/admin/flash-sale/campaigns",
        {
          method: loaded ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loaded ? { action: "update", ...body } : body),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || (loaded ? "บันทึกไม่สำเร็จ" : "สร้างแคมเปญไม่สำเร็จ"));
      // Back to the list, which is where the campaign now is — and where its
      // sale page, its schedule and the rest of the row can be seen.
      router.push("/admin/flash-sale");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const config = loaded ? campaignToConfig(loaded, bySlug) : BLANK;
  if (id && !config) {
    return (
      <p className="rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
        {error ?? "แคมเปญนี้ขายสินค้าที่ไม่มีในแคตตาล็อกแล้ว แก้ไขผ่านหน้านี้ไม่ได้"}
      </p>
    );
  }

  // What may still be changed once people are involved. A campaign that has
  // opened has sold at a price and a stock somebody queued for, so only its
  // page, its title and its closing time move — the same rule the server
  // enforces, said here so the form does not offer what it cannot keep.
  const editing: EditingCampaign | undefined = loaded
    ? {
        id: loaded.id,
        title: loaded.title,
        startsAt: loaded.startsAt,
        endsAt: loaded.endsAt ?? undefined,
        salePrices: loaded.salePrices ?? {},
        scope: !loaded.endedManuallyAt && now < loaded.startsAt ? "full" : "limited",
      }
    : undefined;

  return (
    <>
      {error && <p className="mb-4 rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      <CampaignSetup
        key={loaded?.id ?? "new"}
        config={config ?? BLANK}
        catalogue={catalogue}
        groups={groups}
        now={now}
        saving={saving}
        editing={editing}
        onCancelEdit={() => router.push("/admin/flash-sale")}
        onCreate={submit}
      />
    </>
  );
}
