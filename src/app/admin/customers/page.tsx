"use client";

import { useState } from "react";
import clsx from "clsx";
import { Users, Search, Link2, Unlink, Loader2, ShoppingBag, AlertTriangle, Check, ExternalLink } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";

// Attaching a returning customer's purchase history to their login.
//
// The case this is for: someone bought as a guest with one email, signed up
// later with another, and their orders are invisible in their account. Both
// halves of that are shown side by side — the site accounts and the Shopify
// records that match the same search — because the whole difficulty is working
// out which of several near-identical Shopify records is the one with the
// orders in it.

type Identity = { provider: string; uid: string; verified: boolean };
type Account = {
  id: string;
  display_name: string | null;
  phone: string | null;
  shopify_customer_id: string | null;
  created_at: string;
  identities: Identity[];
};
type Candidate = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  numberOfOrders: string;
  amountSpent: string;
  currency: string;
  createdAt: string;
  lastOrderAt: string | null;
  address: string | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  email: "อีเมล",
  line: "LINE",
  google: "Google",
  apple: "Apple",
  phone: "เบอร์โทร",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function shortId(gid: string | null) {
  return gid ? gid.replace("gid://shopify/Customer/", "") : "";
}

export default function AdminCustomersPage() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [shopify, setShopify] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState("");

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (term.trim().length < 3) {
      setError("พิมพ์อย่างน้อย 3 ตัวอักษร");
      return;
    }
    setLoading(true);
    setError("");
    setDone("");
    try {
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(term.trim())}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "ค้นหาไม่สำเร็จ");
        return;
      }
      setAccounts(json.accounts);
      setShopify(json.shopify);
      setSelected(json.accounts.length === 1 ? json.accounts[0].id : null);
    } catch {
      setError("ค้นหาไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  async function link(shopifyCustomerId: string | null) {
    if (!selected) return;
    setBusy(shopifyCustomerId || "unlink");
    setError("");
    try {
      const res = await fetch("/api/admin/customers/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected,
          shopifyCustomerId,
          unlink: shopifyCustomerId === null,
          note,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "ทำรายการไม่สำเร็จ");
        return;
      }
      setAccounts((list) =>
        (list || []).map((a) => (a.id === selected ? { ...a, shopify_customer_id: json.shopifyCustomerId } : a))
      );
      setDone(shopifyCustomerId ? "ผูกบัญชีเรียบร้อย — ลูกค้ารีเฟรชหน้าคำสั่งซื้อจะเห็นทันที" : "ปลดการผูกเรียบร้อย");
      setNote("");
    } finally {
      setBusy("");
    }
  }

  const account = accounts?.find((a) => a.id === selected) || null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-brand-emerald" />
        <h1 className="text-lg font-bold text-brand-ink">ลูกค้า &amp; การผูกบัญชี</h1>
      </div>
      <p className="text-xs text-slate-500 -mt-3 max-w-2xl">
        ใช้เมื่อลูกค้าเคยซื้อด้วยอีเมล/เบอร์เดิม แล้วมาสมัครสมาชิกด้วยอีเมลใหม่ จนออเดอร์เก่าไม่ขึ้นในบัญชี — ค้นหา
        เลือกบัญชีเว็บ แล้วกดผูกกับใบ Shopify ที่มีประวัติการซื้ออยู่
      </p>

      <form onSubmit={search} className="flex gap-2 max-w-xl">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="อีเมล / เบอร์โทร / ชื่อลูกค้า"
          className="flex-1 min-w-0 rounded-xl2 border border-slate-200 px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          ค้นหา
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-xl2 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {done && (
        <div className="flex items-start gap-2 rounded-xl2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Check size={14} className="mt-0.5 shrink-0" />
          {done}
        </div>
      )}

      {accounts && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="text-sm font-bold text-brand-ink mb-1">บัญชีในเว็บ ({accounts.length})</h2>
            <p className="text-[11px] text-slate-400 mb-3">เลือกบัญชีที่ลูกค้าใช้ล็อกอินอยู่</p>
            {accounts.length === 0 && <p className="text-xs text-slate-400">ไม่พบบัญชีที่ตรงกับคำค้นนี้</p>}
            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className={clsx(
                    "w-full text-left rounded-xl2 border px-3 py-2.5 transition-colors",
                    selected === a.id ? "border-brand-emerald bg-brand-gradient-soft" : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-brand-ink truncate">
                      {a.display_name || "(ไม่มีชื่อ)"}
                    </span>
                    {a.shopify_customer_id ? (
                      <Badge tone="success">ผูกแล้ว #{shortId(a.shopify_customer_id)}</Badge>
                    ) : (
                      <Badge tone="warning">ยังไม่ผูก</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {a.phone && <span>{a.phone}</span>}
                    {a.identities.map((i) => (
                      <span key={i.provider + i.uid}>
                        {PROVIDER_LABEL[i.provider] || i.provider}: {i.uid.length > 30 ? `${i.uid.slice(0, 12)}…` : i.uid}
                        {i.provider === "email" && !i.verified && " (ยังไม่ยืนยัน)"}
                      </span>
                    ))}
                    <span>สมัคร {fmtDate(a.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-bold text-brand-ink mb-1">ใบลูกค้าใน Shopify ({shopify.length})</h2>
            <p className="text-[11px] text-slate-400 mb-3">
              เลือกใบที่มีประวัติการซื้อ — ดูจากจำนวนออเดอร์ ที่อยู่ และเบอร์ว่าตรงกับลูกค้าจริงไหม
            </p>
            {shopify.length === 0 && <p className="text-xs text-slate-400">ไม่พบใบลูกค้าใน Shopify</p>}
            <div className="space-y-2">
              {shopify.map((c) => {
                const linkedHere = account?.shopify_customer_id === c.id;
                return (
                  <div
                    key={c.id}
                    className={clsx(
                      "rounded-xl2 border px-3 py-2.5",
                      linkedHere ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-brand-ink truncate">{c.displayName || c.email || "—"}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-emerald shrink-0">
                        <ShoppingBag size={12} />
                        {c.numberOfOrders} ออเดอร์ · ฿{Number(c.amountSpent).toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div>{c.phone}</div>}
                      {c.address && <div className="truncate">{c.address}</div>}
                      <div>ซื้อล่าสุด {fmtDate(c.lastOrderAt)} · สร้าง {fmtDate(c.createdAt)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {linkedHere ? (
                        <Badge tone="success">ผูกกับบัญชีนี้อยู่</Badge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!selected || busy !== "" || note.trim().length < 3}
                          onClick={() => link(c.id)}
                        >
                          {busy === c.id ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                          ผูกกับบัญชีนี้
                        </Button>
                      )}
                      <a
                        href={`https://admin.shopify.com/store/smoothlifethailand/customers/${shortId(c.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-emerald"
                      >
                        <ExternalLink size={11} /> เปิดใน Shopify
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {account && (
        <Card className="p-4 max-w-2xl">
          <h2 className="text-sm font-bold text-brand-ink mb-1">ยืนยันตัวตนก่อนผูก</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            การผูกทำให้ลูกค้าเห็นออเดอร์ ที่อยู่ และเบอร์ในใบนั้นทั้งหมด — ผูกผิดใบคือเปิดข้อมูลของคนอื่น
            บันทึกไว้ว่าตรวจจากอะไร (เช่น &quot;ลูกค้าแจ้งเลขออเดอร์ #4207 และชื่อ-ที่อยู่ตรงกัน&quot;) ทุกครั้งที่กดจะถูกบันทึกใน audit log
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ยืนยันตัวตนจากอะไร (จำเป็น)"
            className="w-full rounded-xl2 border border-slate-200 px-3 py-2 text-sm"
          />
          {account.shopify_customer_id && (
            <button
              onClick={() => link(null)}
              disabled={busy !== "" || note.trim().length < 3}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40"
            >
              {busy === "unlink" ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
              ปลดการผูกบัญชีนี้
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
