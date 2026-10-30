"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@heroui/react";
import { Badge } from "@/components/ui";
import { FilterChip, Panel, adminTable } from "@/components/admin/layout-kit";
import type { StaffOrderStatus } from "@/lib/staff-sale";
import { fulfilmentOption, isPickup } from "@/lib/staff-fulfilment";
import type { AdminStaffOrder } from "./types";

// Staff orders, and the two buttons an admin has over one.
//
// The default filter is the flagged ones, not everything: on a page whose
// whole job is money that moved, the rows somebody has to act on come first.

const STATUS_TH: Record<StaffOrderStatus, string> = {
  pending: "รอชำระ",
  paid: "จ่ายแล้ว",
  expired: "หมดเวลา",
  cancelled: "ยกเลิก",
  refunded: "คืนเงินแล้ว",
};

const STATUS_TONE: Record<StaffOrderStatus, "brand" | "neutral" | "success" | "warning" | "danger"> = {
  pending: "warning",
  paid: "success",
  expired: "neutral",
  cancelled: "neutral",
  refunded: "danger",
};

const FILTERS = [
  { key: "flagged", label: "ต้องจัดการ" },
  { key: "", label: "ทั้งหมด" },
  { key: "pending", label: "รอชำระ" },
  { key: "paid", label: "จ่ายแล้ว" },
  { key: "refunded", label: "คืนเงินแล้ว" },
] as const;

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function thaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersTab({
  roundId,
  roundName,
  onReload,
}: {
  roundId: string | null;
  roundName: string | null;
  onReload: () => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("flagged");
  const [allRounds, setAllRounds] = useState(false);
  const [orders, setOrders] = useState<AdminStaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!allRounds && roundId) params.set("round", roundId);
      if (filter === "flagged") params.set("flagged", "1");
      else if (filter) params.set("status", filter);
      const res = await fetch(`/api/admin/staff-sale/orders?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดออร์เดอร์ไม่สำเร็จ");
      setOrders(json.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดออร์เดอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filter, roundId, allRounds]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * For an order 2C2P charged but our webhook never finished.
   *
   * The webhook answers 200 whatever happens, so a delivery we mishandle is
   * one we never see again — and on 28 Oct 2026 that was every staff payment
   * ever taken. This asks 2C2P what actually happened and finishes the job
   * only if the invoice, the response code and the amount all agree.
   */
  async function recover(order: AdminStaffOrder) {
    if (
      !confirm(
        `เช็คกับ 2C2P ว่าออร์เดอร์นี้ (${baht(order.subtotal_thb)} บาท) จ่ายสำเร็จแล้วหรือยัง?\n` +
          "ถ้าจ่ายแล้วจะปิดออร์เดอร์ ตัดสต็อก และสร้างออร์เดอร์ใน Shopify ให้\n" +
          "ถ้ายังไม่จ่าย จะไม่มีอะไรเปลี่ยน",
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff-sale/orders/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ปิดออร์เดอร์ไม่สำเร็จ");
      if (!json.synced) {
        setError("ปิดออร์เดอร์แล้ว แต่สร้างใน Shopify ไม่สำเร็จ — กด “ลอง Shopify อีกครั้ง” ที่แถวนี้");
      }
      await load();
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปิดออร์เดอร์ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function act(
    order: AdminStaffOrder,
    action: "refund_restore" | "cancel" | "clear_flag" | "retry_shopify",
  ) {
    const confirmText =
      action === "refund_restore"
        ? `คืนวงเงินและสต็อกของออร์เดอร์นี้ (${baht(order.subtotal_thb)} บาท)?\nคืนเงินจริงให้ทำใน Shopify หรือ 2C2P ก่อน — ปุ่มนี้แค่คืนสิทธิ์ให้พนักงาน`
        : action === "cancel"
          ? "ยกเลิกออร์เดอร์นี้และคืนของที่จองไว้?"
          : action === "retry_shopify"
            ? "ลองสร้างออร์เดอร์นี้ใน Shopify อีกครั้ง?"
            : "ปิดธง “ต้องคืนเงิน” ของออร์เดอร์นี้?";
    if (!confirm(confirmText)) return;

    setBusyId(order.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff-sale/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, action }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สำเร็จ");
      await load();
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      title={
        allRounds || !roundName ? "ออร์เดอร์พนักงานทุกรอบ" : `ออร์เดอร์ในรอบ ${roundName}`
      }
      toolbar={
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              dot={f.key === "flagged" ? "danger" : undefined}
              onClick={() => setFilter(f.key)}
            />
          ))}
          {roundId && (
            <FilterChip label="ทุกรอบ" active={allRounds} onClick={() => setAllRounds((v) => !v)} />
          )}
        </div>
      }
    >
      {error && (
        <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 p-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}
      <div className={`${adminTable.scroll} max-h-[600px]`}>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th>พนักงาน</th>
              <th>สินค้า</th>
              <th>รับของ</th>
              <th>ยอด</th>
              <th>สถานะ</th>
              <th>Shopify</th>
              <th>เวลา</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className={adminTable.muted} colSpan={8}>
                  กำลังโหลด…
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td className={adminTable.muted} colSpan={8}>
                  {filter === "flagged" ? "ไม่มีออร์เดอร์ที่ต้องจัดการ" : "ยังไม่มีออร์เดอร์"}
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className={adminTable.row}>
                <td className={adminTable.cell}>
                  <p className="font-medium text-brand-ink">{o.staff_email}</p>
                  {o.display_name && <p className="text-[11px] text-slate-400">{o.display_name}</p>}
                  {allRounds && o.round_name && (
                    <p className="text-[11px] text-slate-400">{o.round_name}</p>
                  )}
                </td>
                <td className={adminTable.cell}>
                  <ul className="space-y-0.5">
                    {(o.lines ?? []).map((l) => (
                      <li key={l.variant_id} className="text-[12px] text-slate-600">
                        {l.product_slug} × {l.qty}
                        <span className="ml-1 font-mono text-[11px] text-slate-400">
                          {baht(Number(l.staff_price))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                {/* Where this one goes. A collection that is packed and
                    handed to a courier is a box the employee is standing in
                    the lobby waiting for, so it is a column rather than a
                    line in the note. */}
                <td className={adminTable.cell}>
                  {isPickup(o.fulfilment ?? "ship") ? (
                    <>
                      <Badge tone="brand">{fulfilmentOption(o.fulfilment).label}</Badge>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {o.pickup_name ?? "—"}
                        {o.pickup_floor ? ` · ชั้น ${o.pickup_floor}` : ""}
                      </p>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">ส่งตามที่อยู่</span>
                  )}
                </td>
                <td className={adminTable.mono}>{baht(o.subtotal_thb)}</td>
                <td className={adminTable.cell}>
                  <Badge tone={STATUS_TONE[o.status]}>{STATUS_TH[o.status]}</Badge>
                  {o.needs_refund && (
                    <p className="mt-1">
                      <Badge tone="danger">ต้องคืนเงิน</Badge>
                    </p>
                  )}
                  {o.note && <p className="mt-1 text-[11px] text-slate-400">{o.note}</p>}
                </td>
                <td className={adminTable.cell}>
                  {o.shopify_order_id ? (
                    <span className="font-mono text-[11px] text-slate-600">
                      {o.shopify_order_id.split("/").pop()}
                    </span>
                  ) : o.shopify_sync_status === "failed" ? (
                    <Badge tone="danger">สร้างไม่สำเร็จ</Badge>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
                </td>
                <td className={adminTable.muted}>
                  {thaiDateTime(o.created_at)}
                  {o.status === "pending" && (
                    <>
                      <br />
                      หมดอายุ {thaiDateTime(o.expires_at)}
                    </>
                  )}
                </td>
                <td className={adminTable.cell}>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {o.status === "paid" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => act(o, "refund_restore")}
                        isDisabled={busyId === o.id}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        คืนวงเงิน
                      </Button>
                    )}
                    {o.status === "pending" && (
                      <>
                        {/* For the order that was paid for and never
                            completed. It asks 2C2P before it moves a row, so
                            pressing it on an unpaid order simply says so. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => recover(o)}
                          isDisabled={busyId === o.id}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          เช็ค 2C2P แล้วปิดให้
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => act(o, "cancel")}
                          isDisabled={busyId === o.id}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden />
                          ยกเลิก
                        </Button>
                      </>
                    )}
                    {o.status === "paid" && !o.shopify_order_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => act(o, "retry_shopify")}
                        isDisabled={busyId === o.id}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        สร้างใน Shopify อีกครั้ง
                      </Button>
                    )}
                    {o.needs_refund && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => act(o, "clear_flag")}
                        isDisabled={busyId === o.id}
                      >
                        ปิดธง
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 p-3 text-[12px] text-slate-500">
        “คืนวงเงิน” คืนสิทธิ์ให้พนักงานและคืนสต็อกให้รอบ — ไม่ได้คืนเงินจริง ให้ทำการคืนเงินใน Shopify หรือ 2C2P ก่อน
      </p>
    </Panel>
  );
}
