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
import { AlertTriangle, Check, Clock, Loader2, Mail, Upload, X } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { CLOSES_LABEL, GENERAL_THRESHOLD, OPENS_LABEL } from "@/lib/receipt-campaign";
import { shopifyAuthStartPath } from "@/lib/shopify-email-login";

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

type Upload = {
  id: string;
  entryId: string;
  current: boolean;
  aiVerdict: "ok" | "unclear" | "mismatch" | null;
  aiMessage: string | null;
  createdAt: string;
};

type Entry = {
  id: string;
  paymentTransactionId: string | null;
  orderNumber: string | null;
  orderTotal: number | null;
  dentisteAmount: number;
  keychainAmount: number;
  status: "pending_review" | "approved" | "rejected";
  rejectReason: string | null;
  entries: number;
  createdAt: string;
};

const STATUS: Record<Entry["status"], { label: string; tone: string; Icon: typeof Check }> = {
  pending_review: { label: "รอตรวจสอบ", tone: "bg-amber-50 text-amber-900 border-amber-200", Icon: Clock },
  approved: { label: "ใบเสร็จผ่านการตรวจ", tone: "bg-emerald-50 text-emerald-900 border-emerald-200", Icon: Check },
  rejected: { label: "ใบเสร็จถูกตีกลับ", tone: "bg-rose-50 text-rose-900 border-rose-200", Icon: X },
};

/** AI's reading, in three words, for a list rather than a card. */
const AI_SHORT: Record<"ok" | "unclear" | "mismatch", { label: string; tone: string }> = {
  ok: { label: "รูปผ่านการตรวจเบื้องต้น", tone: "text-emerald-700" },
  unclear: { label: "รูปไม่ชัด", tone: "text-amber-700" },
  mismatch: { label: "รูปไม่ตรงกับคำสั่งซื้อ", tone: "text-rose-700" },
};

const whenTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
  // From the URL rather than the API answer: a signed-out visitor never reaches
  // the branch that renders the API's reply, and "am I in test mode" is exactly
  // the question they have while looking at a form that should not be open yet.
  const [test, setTest] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is not available during render
    setTest(new URLSearchParams(window.location.search).get("test") === "1");
  }, []);
  const [ai, setAi] = useState<AiCheck | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [approved, setApproved] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
      const res = await fetch(`/api/campaigns/dentiste-x-kengnamping/receipts${q}`, { cache: "no-store" });
      if (res.status === 401) return setState("guest");
      const data = await res.json();
      if (!res.ok || !data.ok) return setState("error");
      setOrders(data.orders as Order[]);
      setEntries(data.entries as Entry[]);
      setUploads((data.uploads ?? []) as Upload[]);
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

  // Paying and arriving here are minutes apart: the order is written when 2C2P
  // confirms, which can land after the page has already been read. Someone who
  // paid in another tab and came back to this one was looking at an answer we
  // gathered before their money did.
  useEffect(() => {
    if (state !== "ready" || orders.length > 0) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state, orders.length, load]);

  // A picker for one order is not a choice, it is the same card printed twice —
  // once to select, once in the history right below it. Pick it for them.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the loaded orders
    if (orders.length === 1) setSelected(orders[0].id);
  }, [orders]);

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

  const testBanner = test && (
    <p className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-[13px] text-sky-900">
      <b>โหมดทดลอง</b> — ฟอร์มเปิดให้ลองใช้ก่อนวันเริ่มจริง และรับคำสั่งซื้อ DENTISTE&apos; ทุกใบไม่จำกัดช่วงเวลา
      ใบเสร็จที่ส่งในโหมดนี้จะถูกทำเครื่องหมายไว้เพื่อลบทิ้งก่อนเปิดจริง
    </p>
  );

  if (state === "loading") {
    return (
      <div className="flex justify-center py-10 text-black/40">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (state === "guest") {
    // One way in, on the page itself. Everyone this campaign is for bought on
    // smoothlife.com, so they have an account there — sending them to a second
    // page to choose between five ways of proving it was a step that asked a
    // question they do not have.
    return (
      <div className="flex flex-col gap-6">
        {testBanner}
        <div>
          <a
            href={shopifyAuthStartPath({
              intent: "login",
              returnTo: `/campaigns/dentiste-x-kengnamping${window.location.search}`,
            })}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white hover:opacity-90"
          >
            <Mail size={18} aria-hidden /> เข้าสู่ระบบด้วยบัญชี Smoothlife.com
          </a>
          <p className="mt-2.5 text-center text-[13px] leading-relaxed text-black/60">
            ใช้บัญชีเดียวกับที่สั่งซื้อ — ถ้าเข้าสู่ระบบที่ smoothlife.com อยู่แล้ว จะเข้าได้ทันทีโดยไม่ต้องกรอกอะไร
          </p>
        </div>
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

  // Two columns only when there are two things to show. Alone, each takes the
  // full width; together, half each.
  const twoUp = open && entries.length > 0;

  const pendingEntries = entries
    .filter((e) => e.status === "pending_review")
    .reduce((n, e) => n + e.entries, 0);
  const totalDentiste = entries.reduce((n, e) => n + e.dentisteAmount, 0);

  // One row per attempt, newest first. A receipt with no upload row behind it
  // still gets a line: a receipt that vanishes from their own history because
  // of how we happen to store photos is worse than a row that says little.
  const rows = [
    ...uploads.flatMap((u) => {
      const entry = entries.find((e) => e.id === u.entryId);
      return entry ? [{ key: u.id, at: u.createdAt, entry, verdict: u.aiVerdict, current: u.current }] : [];
    }),
    ...entries
      .filter((e) => !uploads.some((u) => u.entryId === e.id))
      .map((e) => ({ key: e.id, at: e.createdAt, entry: e, verdict: null, current: true })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-8">
      {testBanner}
      {approved > 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[15px] font-bold text-emerald-900">
          คุณมีสิทธิ์ลุ้นรางวัลแล้ว {approved} สิทธิ์
        </p>
      )}

      {/* What they have already sent on the left, what they are sending now on
          the right. The form comes first in the source so a phone shows the
          action above the archive. */}
      <div className={`grid gap-8 ${twoUp ? "lg:grid-cols-2 lg:items-start" : ""}`}>
        {open && (
          <section className={twoUp ? "lg:col-start-2 lg:row-start-1" : ""}>
            {ai && (
              <div className={`mb-5 rounded-2xl border px-5 py-4 text-[14px] ${AI_TONE[ai.verdict]}`}>
                <p className="font-bold">
                  {ai.verdict === "ok"
                    ? "ตรวจเบื้องต้นแล้ว รูปใช้ได้"
                    : ai.verdict === "unclear"
                      ? "อ่านรูปได้ไม่ชัด"
                      : "รูปไม่ตรงกับคำสั่งซื้อที่เลือก"}
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

            <h2 className="text-lg font-bold text-black">แนบรูปใบเสร็จ</h2>

            {orders.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-black/10 p-5">
                <p className="text-[14px] font-bold text-black">ยังไม่พบคำสั่งซื้อที่เข้าเงื่อนไข</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
                  ต้องเป็นคำสั่งซื้อผลิตภัณฑ์ DENTISTE&apos; ที่ชำระเงินสำเร็จบน Smoothlife.com ระหว่าง{" "}
                  {OPENS_LABEL} – {CLOSES_LABEL}
                </p>
                {/* The most common reason for landing here is being early, not
                    being ineligible — the order row is written when 2C2P
                    confirms the payment, a little after the customer is done
                    paying. Saying so beats letting them conclude their purchase
                    does not count. */}
                <p className="mt-3 text-[13px] leading-relaxed text-black/55">
                  เพิ่งชำระเงินไปเมื่อสักครู่? คำสั่งซื้อจะขึ้นที่นี่หลังระบบยืนยันการชำระเงินเสร็จ ลองกดตรวจสอบอีกครั้ง
                </p>
                <button
                  type="button"
                  disabled={rechecking}
                  onClick={async () => {
                    setRechecking(true);
                    await load();
                    setRechecking(false);
                  }}
                  className="mt-4 flex min-h-11 items-center gap-2 rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black hover:bg-black/5 disabled:opacity-50"
                >
                  {rechecking && <Loader2 size={15} className="animate-spin" />}
                  {rechecking ? "กำลังตรวจสอบ…" : "ตรวจสอบอีกครั้ง"}
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
                  แคปหน้าจออีเมลยืนยันคำสั่งซื้อที่ได้รับจาก Smoothlife.com ให้เห็น
                  <b>เลขคำสั่งซื้อ (ORDER #)</b> รายการสินค้า และยอดรวม · JPG, PNG หรือ WEBP ไม่เกิน 8MB
                  <br />
                  กรุณาเก็บใบเสร็จตัวจริงไว้เป็นหลักฐานด้วย
                </p>

                {/* The choice only appears when there is one to make. */}
                {orders.length === 1 ? (
                  <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3 text-[13px] text-black/70">
                    สำหรับคำสั่งซื้อ{" "}
                    <b className="text-black">{orders[0].orderNumber ?? orders[0].invoiceNo}</b> ·{" "}
                    {when(orders[0].paidAt)} · DENTISTE&apos; {formatTHB(orders[0].dentisteAmount)}
                  </p>
                ) : (
                  <label className="mt-4 block">
                    <span className="text-[13px] font-semibold text-black/60">คำสั่งซื้อ</span>
                    <select
                      value={selected ?? ""}
                      onChange={(e) => setSelected(e.target.value || null)}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-[14px] text-black"
                    >
                      <option value="">เลือกคำสั่งซื้อ</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {`${o.orderNumber ?? o.invoiceNo} · ${when(o.paidAt)} · ${formatTHB(o.dentisteAmount)} · ${o.entries} สิทธิ์${o.alreadySent ? " (ส่งแล้ว)" : ""}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

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
        )}

        {entries.length > 0 && (
          // @container: in a column this card sizes itself against the column,
          // not the window, which is the only measurement that means anything
          // once the page has two of them.
          <section className={`@container ${twoUp ? "lg:col-start-1 lg:row-start-1" : ""}`}>
            <h2 className="text-lg font-bold text-black">ประวัติการส่งใบเสร็จ</h2>

            {/* Where they stand, before the list of how they got there. Someone
                who has sent five photos wants one number, not five cards to
                add up. */}
            <div className="mt-3 rounded-2xl border border-black/10 p-4">
              <dl className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-[12px] leading-tight text-black/50">สิทธิ์ที่ได้รับแล้ว</dt>
                  <dd className="mt-1 text-[26px] font-extrabold leading-none text-black tabular-nums">{approved}</dd>
                </div>
                <div>
                  <dt className="text-[12px] leading-tight text-black/50">สิทธิ์รอยืนยัน</dt>
                  <dd className="mt-1 text-[26px] font-extrabold leading-none text-black tabular-nums">
                    {pendingEntries}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] leading-tight text-black/50">ยอดซื้อ DENTISTE&apos; รวม</dt>
                  <dd className="mt-1 text-[26px] font-extrabold leading-none text-black tabular-nums">
                    {formatTHB(totalDentiste)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-black/10 pt-3 text-[13px] text-black/60">
                ส่งใบเสร็จแล้ว {entries.length} คำสั่งซื้อ · อัปโหลด {rows.length} ครั้ง
              </p>
              {approved === 0 && pendingEntries === 0 && totalDentiste < GENERAL_THRESHOLD && (
                // Zero with nothing said about it is a support ticket. The
                // reason is arithmetic we already did.
                <p className="mt-2 text-[13px] text-black/60">
                  ยอดซื้อ DENTISTE&apos; รวมยังไม่ถึง {formatTHB(GENERAL_THRESHOLD)} จึงยังไม่ได้รับสิทธิ์ —
                  ซื้อเพิ่มแล้วส่งใบเสร็จใบใหม่ได้เลย
                </p>
              )}
            </div>

            <h3 className="mt-6 text-[15px] font-bold text-black">การอัปโหลดแต่ละครั้ง</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {rows.map(({ key, at, entry, verdict, current }) => {
                // The photo's own result heads the row; the receipt's status is
                // a fact about the order, so it only belongs on the attempt the
                // team is actually looking at.
                const v = verdict
                  ? AI_SHORT[verdict]
                  : { label: "ไม่ได้ตรวจอัตโนมัติ", tone: "text-black/50" };
                const st = STATUS[entry.status];
                return (
                  <li key={key} className="overflow-hidden rounded-2xl border border-black/10">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-black/10 bg-black/[0.02] px-4 py-2.5">
                      <span className={`text-[13px] font-bold ${v.tone}`}>{v.label}</span>
                      <span className="text-[12px] tabular-nums text-black/50">{whenTime(at)}</span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-[13px] @lg:grid-cols-4">
                      <div>
                        <dt className="text-black/50">เลขคำสั่งซื้อ</dt>
                        <dd className="mt-0.5 font-bold text-black">{entry.orderNumber ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-black/50">สถานะ</dt>
                        <dd className="mt-0.5 font-bold text-black">
                          {current ? (
                            <span className="inline-flex items-center gap-1">
                              <st.Icon size={13} aria-hidden /> {st.label}
                            </span>
                          ) : (
                            <span className="font-medium text-black/45">ถูกแทนที่</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-black/50">ยอดซื้อ DENTISTE&apos;</dt>
                        <dd className="mt-0.5 font-bold text-black tabular-nums">{formatTHB(entry.dentisteAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-black/50">สิทธิ์ที่ได้</dt>
                        <dd className="mt-0.5 font-bold text-black tabular-nums">{entry.entries} สิทธิ์</dd>
                      </div>
                    </dl>

                    {!current && (
                      <p className="border-t border-black/10 px-4 py-2 text-[12px] text-black/45">
                        ถูกแทนที่ด้วยรูปที่ส่งทีหลัง — ทีมงานจะตรวจเฉพาะรูปล่าสุดของคำสั่งซื้อนี้
                      </p>
                    )}

                    {current && entry.status === "rejected" && entry.rejectReason && (
                      <p className="flex items-start gap-1.5 border-t border-black/10 px-4 py-3 text-[13px] text-rose-800">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                        {entry.rejectReason} — ส่งรูปใหม่สำหรับคำสั่งซื้อนี้ได้เลย
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
