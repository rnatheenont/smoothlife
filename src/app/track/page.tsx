"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import ShipmentTracker from "@/components/ShipmentTracker";
import type { TrackedShipment } from "@/lib/tracking";

// Tracking without signing in. Deliberately asks for the order number *and*
// the phone or email on the order: order numbers run in sequence, so the
// number by itself would let anyone read the next customer's delivery status.

type Result = { orderName: string; shipments: TrackedShipment[]; hasCourierFeed: boolean };

export default function TrackPage() {
  const [orderName, setOrderName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderName, contact }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ค้นหาไม่สำเร็จ");
        return;
      }
      setResult(data);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page max-w-xl py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
          <PackageSearch size={22} />
        </span>
        <h1 className="text-xl font-bold text-brand-ink">ติดตามพัสดุ</h1>
        <p className="mt-1 text-sm text-slate-500">
          กรอกเลขคำสั่งซื้อ พร้อมเบอร์โทรหรืออีเมลที่ใช้สั่งซื้อ
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field
            label="เลขคำสั่งซื้อ"
            required
            placeholder="เช่น #4195"
            value={orderName}
            onChange={(e) => setOrderName(e.target.value)}
            hint="ดูได้จากอีเมลยืนยันคำสั่งซื้อ"
          />
          <Field
            label="เบอร์โทรหรืออีเมลที่ใช้สั่งซื้อ"
            required
            placeholder="0891234567 หรือ you@example.com"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            error={error || undefined}
          />
          <Button type="submit" size="lg" fullWidth loading={loading} disabled={!orderName || !contact}>
            {loading ? "กำลังค้นหา..." : "ติดตามพัสดุ"}
          </Button>
        </form>
      </Card>

      {result && (
        <div className="mt-5">
          <ShipmentTracker
            orderName={result.orderName}
            shipments={result.shipments}
            hasCourierFeed={result.hasCourierFeed}
          />
        </div>
      )}

      <p className="mt-5 text-center text-xs text-slate-400">
        มีบัญชีอยู่แล้ว?{" "}
        <a href="/account/orders" className="font-semibold text-brand-800 underline">
          ดูคำสั่งซื้อทั้งหมดในบัญชี
        </a>
      </p>
    </div>
  );
}
