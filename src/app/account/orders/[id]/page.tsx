"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Package } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import OrderDetailView from "@/components/account/OrderDetailView";
import { Button } from "@/components/ui";
import type { ShopifyOrderDetail } from "@/lib/shopify-admin";
import type { buildTracking } from "@/lib/tracking";

// One order in full. The list page shows every order at a glance; this is
// where the parcel, the address it's going to and what was actually charged
// live — the three things someone opens an order to check.

type Payload = { order: ShopifyOrderDetail; tracking: ReturnType<typeof buildTracking> };

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/orders/${params.id}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "ไม่พบคำสั่งซื้อนี้");
        return;
      }
      setData(json);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-slate-400">
        <Loader2 size={15} className="animate-spin" /> กำลังโหลด...
      </p>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <Package size={36} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">{error}</p>
        <Button href="/account/orders" variant="secondary" size="sm" className="mt-4">
          กลับไปหน้าคำสั่งซื้อ
        </Button>
      </div>
    );
  }

  return <OrderDetailView order={data.order} tracking={data.tracking} />;
}

export default function OrderDetailPage() {
  return (
    <AccountLayout>
      <OrderDetailContent />
    </AccountLayout>
  );
}
