"use client";

import { useEffect, useState } from "react";
import { CreditCard, Undo2, Loader2, RefreshCw } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { Badge } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, Panel, adminTable } from "@/components/admin/layout-kit";

type Transaction = {
  id: string;
  invoice_no: string;
  amount: number;
  currency_code: string;
  status: "success" | "refunded";
  shopify_order_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  refunded_at: string | null;
  refund_note: string | null;
  created_at: string;
  confirmed_at: string | null;
};

function RefundControls({ tx, onDone }: { tx: Transaction; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitRefund() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/checkout-transactions/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id, amount: Number(amount) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "คืนเงินไม่สำเร็จ");
        return;
      }
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/checkout-transactions/mark-refunded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id, note }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
      >
        <Undo2 size={13} /> คืนเงิน
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-surface-soft p-3 text-xs w-64">
      <label className="flex items-center gap-2">
        ยอดคืน (฿)
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          max={tx.amount}
          min={1}
          className="w-24 rounded-sm border border-slate-200 px-2 py-1"
        />
      </label>
      {error && <p className="text-rose-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submitRefund}
          disabled={busy}
          className="flex items-center gap-1 rounded-full bg-rose-600 text-white font-semibold px-3 py-1.5 disabled:opacity-60"
        >
          {busy && <Loader2 size={12} className="animate-spin" />} คืนเงินผ่าน 2C2P
        </button>
        <button onClick={() => setOpen(false)} className="text-slate-400">
          ยกเลิก
        </button>
      </div>
      <div className="border-t border-slate-200 pt-2 mt-1">
        <p className="text-slate-500 mb-1">หรือถ้าคืนเงินให้ลูกค้าด้วยวิธีอื่นแล้ว (เช่น ผ่าน 2C2P portal เอง):</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (ถ้ามี)"
          className="w-full rounded-sm border border-slate-200 px-2 py-1 mb-2"
        />
        <button onClick={submitManual} disabled={busy} className="text-slate-600 underline disabled:opacity-60">
          บันทึกว่าคืนเงินแล้ว
        </button>
      </div>
    </div>
  );
}

export default function AdminCheckoutTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checkout-transactions");
      const data = await res.json();
      if (data.ok) setTransactions(data.transactions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useAdminAction({
    label: "รีเฟรชรายการซื้อ",
    icon: <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />,
    onClick: load,
    disabled: loading,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<CreditCard size={20} className="text-brand-emerald" />}
        title="รายการซื้อ (Custom Checkout)"
        subtitle="รายการชำระเงินครั้งเดียวผ่านหน้าชำระเงินของเว็บไซต์เอง (2C2P) — คืนเงินได้จากที่นี่"
        actions={
          transactions.length > 0 && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-800">
              {transactions.length} รายการ
            </span>
          )
        }
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : transactions.length === 0 ? (
        <p className="rounded-xl2 border border-slate-100 bg-white py-10 text-center text-sm text-slate-400">
          ยังไม่มีรายการ
        </p>
      ) : (
        <Panel>
          {/* The table was 12px with a sideways scroll on anything narrower
              than a laptop, which hid the status and the refund button — the
              two columns the page exists for. Full width on a desktop, one
              card per payment on a phone. */}
          <div className="hidden md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="w-44">Invoice</th>
                  <th>ลูกค้า</th>
                  <th className="w-28 text-right">ยอด</th>
                  <th className="w-56">Shopify Order</th>
                  <th className="w-44">สถานะ</th>
                  <th className="w-64 text-right">คืนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className={adminTable.row}>
                    <td className={adminTable.mono}>{tx.invoice_no}</td>
                    <td className={adminTable.cell}>
                      {tx.contact_email || "-"}
                      <br />
                      <span className="text-[12px] text-slate-400">{tx.contact_phone}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatTHB(tx.amount)}</td>
                    <td className={adminTable.cell}>
                      {tx.shopify_order_id ? (
                        <span className="font-mono text-[12px] text-slate-700">{tx.shopify_order_id}</span>
                      ) : (
                        <span className="text-[12px] font-medium text-amber-600">ยังไม่มีออเดอร์ (ตรวจด้วยตนเอง)</span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      {tx.status === "refunded" ? (
                        <Badge tone="neutral">คืนเงินแล้ว</Badge>
                      ) : (
                        <Badge tone="brand">สำเร็จ</Badge>
                      )}
                      {tx.refund_note && (
                        <p className="mt-1 max-w-[18rem] text-[11px] leading-relaxed text-slate-400">
                          {tx.refund_note}
                        </p>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {tx.status === "success" ? <RefundControls tx={tx} onDone={load} /> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {transactions.map((tx) => (
              <li key={tx.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-semibold text-brand-ink">{tx.invoice_no}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {tx.contact_email || "-"}
                      {tx.contact_phone ? ` · ${tx.contact_phone}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-brand-ink">{formatTHB(tx.amount)}</p>
                    <span className="mt-1 block">
                      {tx.status === "refunded" ? (
                        <Badge tone="neutral">คืนเงินแล้ว</Badge>
                      ) : (
                        <Badge tone="brand">สำเร็จ</Badge>
                      )}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {tx.shopify_order_id ? (
                    <span className="font-mono">Shopify: {tx.shopify_order_id}</span>
                  ) : (
                    <span className="font-medium text-amber-600">ยังไม่มีออเดอร์ (ตรวจด้วยตนเอง)</span>
                  )}
                </p>
                {tx.refund_note && <p className="mt-1 text-[11px] text-slate-400">{tx.refund_note}</p>}
                {tx.status === "success" && (
                  <div className="mt-2">
                    <RefundControls tx={tx} onDone={load} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
