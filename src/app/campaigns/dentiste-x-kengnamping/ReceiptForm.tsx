"use client";

// Sending in a receipt: pick the order, attach the photo, see what it is worth.
//
// The order list is the part that does the work. Asking someone to type a
// receipt number and a total is asking them to make a mistake a reviewer then
// has to catch; the orders they actually paid for on this site are already
// known, already inside the campaign window, and already add up. The photo is
// what the conditions tell them to keep, and what a reviewer compares against.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Clock, Loader2, Upload, X } from "lucide-react";
import { formatTHB } from "@/lib/format";

type AiCheck = { verdict: "ok" | "unclear" | "mismatch"; message: string; findings: string[] };

type Order = {
  id: string;
  orderNumber: string | null;
  invoiceNo: string;
  paidAt: string | null;
  total: number;
  dentisteAmount: number;
  keychainAmount: number;
  entries: number;
  alreadySent: boolean;
};

type Entry = {
  id: string;
  paymentTransactionId: string | null;
  status: "pending_review" | "approved" | "rejected";
  rejectReason: string | null;
  entries: number;
  createdAt: string;
};

const STATUS: Record<Entry["status"], { label: string; tone: string; Icon: typeof Check }> = {
  pending_review: { label: "รอตรวจสอบ", tone: "bg-amber-50 text-amber-900 border-amber-200", Icon: Clock },
  approved: { label: "ได้รับสิทธิ์แล้ว", tone: "bg-emerald-50 text-emerald-900 border-emerald-200", Icon: Check },
  rejected: { label: "ใบเสร็จถูกตีกลับ", tone: "bg-rose-50 text-rose-900 border-rose-200", Icon: X },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—";

const AI_TONE: Record<AiCheck["verdict"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  unclear: "border-amber-200 bg-amber-50 text-amber-900",
  mismatch: "border-rose-200 bg-rose-50 text-rose-900",
};

export default function ReceiptForm({ open }: { open: boolean }) {
  // ?test=1 before the campaign opens: the form works on any paid Dentiste
  // order so the whole path can be walked once before it matters.
  const [test, setTest] = useState(false);
  const [ai, setAi] = useState<AiCheck | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [approved, setApproved] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
      const res = await fetch(`/api/campaigns/dentiste-x-kengnamping/receipts${q}`, { cache: "no-store" });
      if (res.status === 401) return setState("guest");
      const data = await res.json();
      if (!res.ok || !data.ok) return setState("error");
      setTest(Boolean(data.test));
      setOrders(data.orders as Order[]);
      setEntries(data.entries as Entry[]);
      setApproved(data.approvedEntries as number);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  async function send() {
    if (!selected || !file) return;
    setSending(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.set("orderId", selected);
      body.set("photo", file);
      const q = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
      const res = await fetch(`/api/campaigns/dentiste-x-kengnamping/receipts${q}`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setNotice(data.error || "ส่งใบเสร็จไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setAi((data.entry?.aiCheck as AiCheck | null) ?? null);
      setSelected(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice("ส่งใบเสร็จเรียบร้อย ทีมงานจะตรวจสอบให้เร็วที่สุด");
      await load();
    } finally {
      setSending(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex justify-center py-10 text-black/40">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (state === "guest") {
    return (
      <div className="rounded-2xl border border-black/10 p-6 text-center">
        <p className="text-[15px] font-bold text-black">เข้าสู่ระบบเพื่อส่งใบเสร็จ</p>
        <p className="mt-1.5 text-[14px] text-black/70">
          ใช้บัญชีเดียวกับที่สั่งซื้อ ระบบจะดึงคำสั่งซื้อที่เข้าเงื่อนไขมาให้เลือกโดยอัตโนมัติ
        </p>
        <a
          // Back to the campaign page, still in whatever mode they were in.
          href={`/campaigns/dentiste-x-kengnamping/login?returnTo=${encodeURIComponent(
            `/campaigns/dentiste-x-kengnamping${window.location.search}`
          )}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-black px-6 text-[14px] font-semibold text-white hover:opacity-90"
        >
          เข้าสู่ระบบ
        </a>
      </div>
    );
  }

  if (state === "error") {
    return (
      <p className="rounded-2xl border border-black/10 p-6 text-center text-[14px] text-black/60">
        โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง
      </p>
    );
  }

  const selectable = orders.filter((o) => !o.alreadySent);

  return (
    <div className="flex flex-col gap-8">
      {test && (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-[13px] text-sky-900">
          <b>โหมดทดลอง</b> — ฟอร์มเปิดให้ลองใช้ก่อนวันเริ่มจริง และรับคำสั่งซื้อ DENTISTE&apos; ทุกใบไม่จำกัดช่วงเวลา
          ใบเสร็จที่ส่งในโหมดนี้จะถูกทำเครื่องหมายไว้เพื่อลบทิ้งก่อนเปิดจริง
        </p>
      )}
      {ai && (
        <div className={`rounded-2xl border px-5 py-4 text-[14px] ${AI_TONE[ai.verdict]}`}>
          <p className="font-bold">
            {ai.verdict === "ok" ? "ตรวจเบื้องต้นแล้ว รูปใช้ได้" : ai.verdict === "unclear" ? "อ่านรูปได้ไม่ชัด" : "รูปไม่ตรงกับคำสั่งซื้อที่เลือก"}
          </p>
          {ai.message && <p className="mt-1">{ai.message}</p>}
          {ai.findings.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-[13px] opacity-80">
              {ai.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] opacity-70">
            เป็นการตรวจเบื้องต้นด้วย AI เท่านั้น ทีมงานจะตรวจอีกครั้งเสมอ — ถ้ารูปไม่ชัด ส่งใหม่ได้เลย
          </p>
        </div>
      )}
      {approved > 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[15px] font-bold text-emerald-900">
          คุณมีสิทธิ์ลุ้นรางวัลแล้ว {approved} สิทธิ์
        </p>
      )}

      {open ? (
        <section>
          <h2 className="text-lg font-bold text-black">เลือกคำสั่งซื้อ</h2>
          {orders.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-black/10 p-5 text-[14px] leading-relaxed text-black/70">
              ยังไม่พบคำสั่งซื้อที่เข้าเงื่อนไข — ต้องเป็นคำสั่งซื้อผลิตภัณฑ์ DENTISTE&apos; ที่ชำระเงินสำเร็จบน
              Smoothlife.com ระหว่าง 28 ก.ย. – 26 ต.ค. 2569
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={o.alreadySent}
                    onClick={() => setSelected(o.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      selected === o.id ? "border-black bg-black/[0.03]" : "border-black/10 hover:border-black/30"
                    } ${o.alreadySent ? "opacity-50" : ""}`}
                  >
                    <span>
                      <span className="block text-[14px] font-bold text-black">{o.orderNumber ?? o.invoiceNo}</span>
                      <span className="mt-0.5 block text-[13px] text-black/60">
                        {when(o.paidAt)} · DENTISTE&apos; {formatTHB(o.dentisteAmount)}
                        {o.keychainAmount > 0 && ` · Keychain ${formatTHB(o.keychainAmount)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-bold text-black">
                      {o.alreadySent ? "ส่งแล้ว" : `${o.entries} สิทธิ์`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectable.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-bold text-black">แนบรูปใบเสร็จ</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
                แคปหน้าจออีเมลยืนยันคำสั่งซื้อที่ได้รับจาก Smoothlife.com ให้เห็น
                <b>เลขคำสั่งซื้อ (ORDER #)</b> รายการสินค้า และยอดรวม · JPG, PNG หรือ WEBP ไม่เกิน 8MB
                <br />
                กรุณาเก็บใบเสร็จตัวจริงไว้เป็นหลักฐานด้วย
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-black/25 px-4 py-4 hover:border-black/50">
                <Upload size={18} className="shrink-0 text-black/50" aria-hidden />
                <span className="min-w-0 truncate text-[14px] text-black/70">{file ? file.name : "เลือกรูปใบเสร็จ"}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                type="button"
                disabled={!selected || !file || sending}
                onClick={send}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {sending && <Loader2 size={16} className="animate-spin" />}
                {sending ? "กำลังส่ง…" : "ส่งใบเสร็จ"}
              </button>
            </>
          )}

          {notice && (
            <p role="status" className="mt-3 rounded-xl border border-black/10 px-4 py-3 text-[14px] text-black/80">
              {notice}
            </p>
          )}
        </section>
      ) : null}

      {entries.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-black">ใบเสร็จที่ส่งแล้ว</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {entries.map((e) => {
              const s = STATUS[e.status];
              return (
                <li key={e.id} className={`rounded-2xl border px-4 py-3.5 ${s.tone}`}>
                  <p className="flex items-center gap-2 text-[14px] font-bold">
                    <s.Icon size={15} aria-hidden /> {s.label}
                    {e.status === "approved" && ` · ${e.entries} สิทธิ์`}
                  </p>
                  <p className="mt-1 text-[13px] opacity-80">ส่งเมื่อ {when(e.createdAt)}</p>
                  {e.status === "rejected" && e.rejectReason && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[13px]">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                      {e.rejectReason} — เลือกคำสั่งซื้อเดิมแล้วแนบรูปใหม่ได้เลย
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
