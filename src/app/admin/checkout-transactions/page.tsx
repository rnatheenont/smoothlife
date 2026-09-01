"use client";

import { useEffect, useState } from "react";
import { CreditCard, Undo2, Loader2 } from "lucide-react";
import { formatTHB } from "@/lib/format";

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
          className="w-24 rounded border border-slate-200 px-2 py-1"
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
          className="w-full rounded border border-slate-200 px-2 py-1 mb-2"
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

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-ink mb-1 flex items-center gap-2">
        <CreditCard size={20} className="text-brand-emerald" /> รายการซื้อ (Custom Checkout)
      </h1>
      <p className="text-sm text-slate-500 mb-6">รายการชำระเงินครั้งเดียวผ่านหน้าชำระเงินของเว็บไซต์เอง (2C2P) — คืนเงินได้จากที่นี่</p>

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีรายการ</p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-slate-100 shadow-card">
          <table className="w-full text-xs">
            <thead className="bg-surface-soft text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">ลูกค้า</th>
                <th className="text-right px-3 py-2">ยอด</th>
                <th className="text-left px-3 py-2">Shopify Order</th>
                <th className="text-left px-3 py-2">สถานะ</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-mono">{tx.invoice_no}</td>
                  <td className="px-3 py-2">
                    {tx.contact_email || "-"}
                    <br />
                    <span className="text-slate-400">{tx.contact_phone}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatTHB(tx.amount)}</td>
                  <td className="px-3 py-2">
                    {tx.shopify_order_id ? (
                      tx.shopify_order_id
                    ) : (
                      <span className="text-amber-600">ยังไม่มีออเดอร์ (ตรวจสอบด้วยตนเอง)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {tx.status === "refunded" ? (
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">คืนเงินแล้ว</span>
                    ) : (
                      <span className="rounded-full bg-brand-gradient-soft text-brand-emerald px-2 py-0.5">สำเร็จ</span>
                    )}
                    {tx.refund_note && <p className="text-slate-400 mt-1 max-w-[16rem]">{tx.refund_note}</p>}
                  </td>
                  <td className="px-3 py-2">{tx.status === "success" && <RefundControls tx={tx} onDone={load} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
