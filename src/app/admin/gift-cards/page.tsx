"use client";

import { useEffect, useState } from "react";
import { CreditCard, Check, Copy } from "lucide-react";

type GiftCardSummary = {
  id: string;
  maskedCode: string;
  lastCharacters: string;
  enabled: boolean;
  createdAt: string;
  expiresOn: string | null;
  note: string | null;
  balance: { amount: string; currencyCode: string };
  initialValue: { amount: string; currencyCode: string };
  customer: { firstName: string | null; lastName: string | null; defaultEmailAddress: { emailAddress: string } | null } | null;
};

const EMPTY_FORM = { email: "", firstName: "", lastName: "", amount: "", note: "", expiresOn: "" };

function formatTHB(amount: string | number) {
  return `฿${Number(amount).toLocaleString()}`;
}

export default function AdminGiftCardsPage() {
  const [history, setHistory] = useState<GiftCardSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ code: string; balance: number; currencyCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/gift-cards");
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) setHistory(data.giftCards);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIssued(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          amount: Number(form.amount),
          note: form.note || undefined,
          expiresOn: form.expiresOn || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ออกบัตรของขวัญไม่สำเร็จ");
        return;
      }
      setIssued(data.giftCard);
      setForm(EMPTY_FORM);
      loadHistory();
    } finally {
      setSubmitting(false);
    }
  }

  function copyCode() {
    if (!issued) return;
    navigator.clipboard.writeText(issued.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2">
          <CreditCard size={22} className="text-brand-emerald" /> บัตรของขวัญ
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          ออกบัตรของขวัญจริงให้ลูกค้าและส่งอีเมลแจ้งทันที (ผ่าน Shopify) — ลูกค้าเองก็ซื้อได้ที่หน้าสินค้า{" "}
          <a href="/product/smoothlife-gift-card" target="_blank" className="text-brand-emerald underline">
            Smoothlife Gift Card
          </a>
        </p>
      </div>

      <div className="rounded-xl2 border border-slate-100 p-4 shadow-card mb-8">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">อีเมลลูกค้า</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="customer@email.com"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">ชื่อ (ถ้าเป็นลูกค้าใหม่)</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">นามสกุล</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">มูลค่าบัตร (บาท)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="เช่น 500"
              required
              min="1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">หมายเหตุ (ไม่แสดงให้ลูกค้าเห็น)</label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">วันหมดอายุ (ไม่บังคับ)</label>
              <input
                type="date"
                value={form.expiresOn}
                onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-gradient text-white text-sm font-semibold py-2.5 disabled:opacity-50"
          >
            {submitting ? "กำลังออกบัตร..." : "ออกบัตรของขวัญและส่งอีเมล"}
          </button>
        </form>

        {issued && (
          <div className="mt-4 rounded-xl bg-brand-gradient-soft p-3.5">
            <p className="text-xs font-bold text-brand-emerald flex items-center gap-1 mb-2">
              <Check size={13} /> ออกบัตรสำเร็จ ส่งอีเมลให้ลูกค้าแล้ว
            </p>
            <div className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
              <span className="font-mono text-sm text-brand-ink tracking-wide">{issued.code}</span>
              <button onClick={copyCode} className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <Copy size={12} /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              มูลค่า {formatTHB(issued.balance)} — ระบบจะแสดงรหัสนี้ครั้งนี้ครั้งเดียวเท่านั้น กรุณาบันทึกไว้ถ้าจำเป็น
            </p>
          </div>
        )}
      </div>

      <h2 className="font-bold text-brand-ink mb-3">ประวัติบัตรของขวัญล่าสุด</h2>
      {loadingHistory ? (
        <p className="text-sm text-slate-400 text-center py-6">กำลังโหลด...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีบัตรของขวัญ</p>
      ) : (
        <div className="space-y-2">
          {history.map((g) => (
            <div key={g.id} className="rounded-xl2 border border-slate-100 p-3.5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink font-mono">•••• {g.lastCharacters}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {[g.customer?.firstName, g.customer?.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ"}
                    {g.customer?.defaultEmailAddress?.emailAddress ? ` · ${g.customer.defaultEmailAddress.emailAddress}` : ""}
                  </p>
                  {g.note && <p className="text-[11px] text-slate-400 mt-0.5">หมายเหตุ: {g.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-brand-ink">
                    {formatTHB(g.balance.amount)} <span className="text-[11px] font-normal text-slate-400">/ {formatTHB(g.initialValue.amount)}</span>
                  </p>
                  <span
                    className={`inline-block text-[10px] font-bold rounded-full px-2 py-0.5 mt-1 ${
                      g.enabled ? "bg-brand-gradient-soft text-brand-emerald" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {g.enabled ? "ใช้งานได้" : "ปิดใช้งานแล้ว"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
