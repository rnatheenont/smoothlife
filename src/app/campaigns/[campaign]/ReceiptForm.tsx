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
import { AlertTriangle, Check, Clock, Gift, Loader2, Mail, Upload, X } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { GENERAL_THRESHOLD } from "@/lib/receipt-campaign";
import { shopifyAuthStartPath } from "@/lib/shopify-email-login";

type AiCheck = { verdict: "ok" | "unclear" | "mismatch"; message: string; findings: string[] };

/** One receipt on its way: a photo, the order it belongs to, and how it went. */
type Item = {
  id: string;
  file: File;
  preview: string;
  orderId: string | null;
  /** How the order was chosen — read off the photo, or picked by hand. */
  matched: "photo" | "manual" | "none";
  /**
   * What this receipt says, read off it and editable before it is sent.
   *
   * Per row rather than per form now there are several: five receipts have
   * five order numbers, and the one the customer can correct has to be the one
   * attached to the photo they are looking at.
   */
  declared: { orderNumber: string; paidAt: string; total: string };
  /**
   * Sent for a person to check rather than matched to an order.
   *
   * For the receipt of a purchase this site has no record of — the card
   * cleared and the order was never written, or it was bought somewhere this
   * table does not reach. Nothing can be computed from it, so it carries what
   * the customer typed and waits for a reviewer.
   */
  manual: boolean;
  editing: boolean;
  reading: boolean;
  state: "ready" | "sending" | "sent" | "failed";
  error: string | null;
  note: string | null;
};

type Prize = {
  id: string;
  prizeType: "vip" | "lucky_fan";
  rank: number;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirmDeadline: string;
};

const PRIZE_NAME: Record<Prize["prizeType"], string> = {
  vip: "รางวัล VIP",
  lucky_fan: "รางวัล Lucky Fan",
};

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
  status: "pending_review" | "approved" | "rejected" | "revoked";
  rejectReason: string | null;
  entries: number;
  createdAt: string;
};

const STATUS: Record<Entry["status"], { label: string; tone: string; Icon: typeof Check }> = {
  pending_review: { label: "รอตรวจสอบ", tone: "bg-amber-50 text-amber-900 border-amber-200", Icon: Clock },
  approved: { label: "ใบเสร็จผ่านการตรวจ", tone: "bg-emerald-50 text-emerald-900 border-emerald-200", Icon: Check },
  rejected: { label: "ใบเสร็จถูกตีกลับ", tone: "bg-rose-50 text-rose-900 border-rose-200", Icon: X },
  // The purchase was undone, so the entries went with it. Said as its own
  // thing, because a customer told their receipt was rejected sends it again.
  revoked: { label: "ยกเลิกสิทธิ์ (คืนเงินแล้ว)", tone: "bg-slate-100 text-slate-700 border-slate-300", Icon: X },
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

export default function ReceiptForm({
  campaign,
  open,
  opensLabel,
  closesLabel,
}: {
  /** Which campaign this page is — the key from the route, not a constant. */
  campaign: string;
  open: boolean;
  opensLabel: string;
  closesLabel: string;
}) {
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
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [tab, setTab] = useState<"send" | "history">("send");
  // Built from the campaign this page is, so a second campaign needs no second
  // component — only a second row in the settings table.
  const base = `/campaigns/${campaign}`;
  const api = `/api/campaigns/${campaign}`;
  // One row per photo. A customer who buys every week has a stack of receipts
  // and no reason to come back five times to send them.
  const [items, setItems] = useState<Item[]>([]);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  // One receipt at a time is what almost everybody is doing, and a row in a
  // list is a worse way to look at the only photo you have. So the form is not
  // asking which one they want: it shows the photo on its own until there is
  // more than one, and picking several at once is the whole of "several".
  const mode = items.length > 1 ? "multi" : "single";
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // What the photo was read to say, after the customer has had a look at it.
  const [reading, setReading] = useState(false);
  const [approved, setApproved] = useState(0);
  const [sending, setSending] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
      const res = await fetch(`${api}/receipts${q}`, { cache: "no-store" });
      if (res.status === 401) return setState("guest");
      const data = await res.json();
      if (!res.ok || !data.ok) return setState("error");
      setOrders(data.orders as Order[]);
      setEntries(data.entries as Entry[]);
      setUploads((data.uploads ?? []) as Upload[]);
      setPrizes((data.prizes ?? []) as Prize[]);
      // Only ever a first guess — never overwrite what they are typing.
      const profile = (data.profile ?? {}) as { name?: string; phone?: string };
      setContactName((v) => v || profile.name || "");
      setContactPhone((v) => v || profile.phone || "");
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

  // Accepting a prize. Giving one up is deliberately not here — a tap that
  // hands ฿55,000 to the next person should not sit beside "ยืนยันสิทธิ์".
  async function claim(prize: Prize) {
    setClaiming(prize.id);
    try {
      const res = await fetch(`${api}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prize.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setNotice(data.error || "ยืนยันสิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      await load();
    } finally {
      setClaiming(null);
    }
  }

  const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
  // One receipt at a time: the photo goes in the drop area and its fields go
  // in the column with the rest of the form, because they are the form.
  const singleItem = mode === "single" ? (items[0] ?? null) : null;

  /**
   * Which order a receipt belongs to, worked out rather than asked.
   *
   * The customer is already looking at the order number — it is printed on
   * the photo and typed into the box under it. Asking them to pick the same
   * order a second time from a list of their own purchases is asking a
   * question they have already answered.
   */
  const orderFromNumber = (typed: string) => {
    const n = digits(typed);
    return n ? (orders.find((o) => digits(o.orderNumber) === n) ?? null) : null;
  };

  function setDeclared(id: string, key: "orderNumber" | "paidAt" | "total", value: string) {
    setItems((old) =>
      old.map((row) => {
        if (row.id !== id) return row;
        const declared = { ...row.declared, [key]: value };
        if (key !== "orderNumber") return { ...row, declared };
        // The number they typed decides the order; nothing else can.
        //
        // It used to fall back to "they only have one eligible order, so it
        // must be that one", which filed a ฿1,600 receipt for #4305 against
        // #4292 and told the customer the two matched. The case that fallback
        // was written for — a receipt for an order that is not in the list —
        // is the exact case worth catching, not papering over.
        const hit = orderFromNumber(value);
        // Typing a number that does match takes the row back out of the
        // special-case path: there is an order now, and it decides.
        return {
          ...row,
          declared,
          orderId: hit?.id ?? null,
          matched: hit ? "manual" : "none",
          manual: hit ? false : row.manual,
          note: null,
        };
      })
    );
  }

  /**
   * Adds photos and works out which order each one belongs to.
   *
   * The model reads the order number off the picture, which is exactly the
   * thing that makes a stack of receipts sortable without the customer doing
   * it: five photos land already paired with five orders. Where it cannot
   * read one, the row says so and asks rather than guessing — a receipt filed
   * against the wrong order is worse than one the customer had to point at.
   */
  async function addFiles(picked: File[]) {
    // One photo at a time, so a picker that hands over more than one (a
    // browser that ignores the attribute, a drop of several files) keeps the
    // newest rather than quietly filing the rest.
    const single = true;
    const fresh: Item[] = picked.slice(0, single ? 1 : 10).map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      orderId: null,
      matched: "none",
      declared: { orderNumber: "", paidAt: "", total: "" },
      manual: false,
      // On its own the receipt is the page, so its fields are open.
      editing: single,
      reading: true,
      state: "ready",
      error: null,
      note: null,
    }));
    // One at a time means the new photo is the photo, not another row.
    setItems((old) => {
      if (!single) return [...old, ...fresh];
      old.forEach((row) => URL.revokeObjectURL(row.preview));
      return fresh;
    });

    // One at a time: each is a model call, and a stack of ten arriving at once
    // is the shape of a bill nobody meant to run up.
    for (const item of fresh) {
      try {
        const body = new FormData();
        body.set("photo", item.file);
        const res = await fetch(`${api}/read`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        setItems((old) =>
          old.map((row) => {
            if (row.id !== item.id) return row;
            if (!res.ok || !data.ok) {
              return { ...row, reading: false, note: data.error || "อ่านรูปไม่สำเร็จ — กรอกเลขคำสั่งซื้อเอง" };
            }
            const read = (data.read ?? {}) as { orderNumber?: string | null; total?: number | null; paidAt?: string | null };
            const readNumber = digits(read.orderNumber);
            const hit = readNumber ? orders.find((o) => digits(o.orderNumber) === readNumber) : undefined;
            const bkk = (iso: string | null | undefined) =>
              iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 16).replace(" ", "T") : "";
            return {
              ...row,
              reading: false,
              orderId: hit?.id ?? null,
              matched: hit ? "photo" : "none",
              // The photo first — it is what they are looking at. The order
              // fills only what the picture could not answer.
              declared: {
                orderNumber: read.orderNumber ?? hit?.orderNumber ?? "",
                paidAt: read.paidAt ?? bkk(hit?.paidAt),
                total: String(read.total ?? hit?.total ?? ""),
              },
              // Two different failures, and telling them apart is the whole
              // of what to do next: nothing readable means type it, a number
              // that is not in the list means check which receipt this is.
              note: hit
                ? null
                : readNumber
                  ? `อ่านจากรูปได้เลข ${read.orderNumber} แต่ยังไม่พบคำสั่งซื้อนี้ในระบบ`
                  : "อ่านเลขคำสั่งซื้อจากรูปไม่ได้ — กรอกเลขจากใบเสร็จเอง",
            };
          })
        );
      } catch {
        setItems((old) =>
          old.map((row) => (row.id === item.id ? { ...row, reading: false, note: "อ่านรูปไม่สำเร็จ — กรอกเลขคำสั่งซื้อเอง" } : row))
        );
      }
    }
  }

  function removeItem(id: string) {
    setItems((old) => {
      const gone = old.find((row) => row.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return old.filter((row) => row.id !== id);
    });
  }

  /**
   * Whether the second column has anything to say yet.
   *
   * The summary and the prize recipient are worth a column the moment a photo
   * is picked — including a receipt with no order behind it, which is exactly
   * when the contact details matter most.
   */
  const twoUp = orders.length > 0 || items.length > 0;

  /** A row the send button will actually take: matched, or flagged for review. */
  const sendable = (row: Item) => Boolean(row.orderId) || row.manual;

  /** Everything a manual row has to carry, since no order can supply it. */
  const manualReady = (row: Item) =>
    row.declared.orderNumber.trim().length > 0 &&
    row.declared.paidAt.trim().length > 0 &&
    Number(row.declared.total.replace(/[^0-9.]/g, "")) > 0;

  /** Sends every row that has an order, one after another, and says how each went. */
  async function sendAll() {
    const ready = items.filter((row) => sendable(row) && row.state !== "sent");
    if (!ready.length) return;
    setSending(true);
    setNotice(null);
    let sent = 0;
    for (const item of ready) {
      setItems((old) => old.map((row) => (row.id === item.id ? { ...row, state: "sending", error: null } : row)));
      try {
        const body = new FormData();
        if (item.orderId) body.set("orderId", item.orderId);
        else body.set("manual", "1");
        body.set("photo", item.file);
        body.set("contactName", contactName.trim());
        body.set("contactPhone", contactPhone.trim());
        body.set("declaredOrderNumber", item.declared.orderNumber.trim());
        body.set("declaredPaidAt", item.declared.paidAt.trim());
        body.set("declaredTotal", item.declared.total.trim());
        const q = new URLSearchParams(window.location.search).get("test") === "1" ? "?test=1" : "";
        const res = await fetch(`${api}/receipts${q}`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        const ok = res.ok && data.ok;
        if (ok) sent += 1;
        setItems((old) =>
          old.map((row) =>
            row.id === item.id
              ? { ...row, state: ok ? "sent" : "failed", error: ok ? null : data.error || "ส่งไม่สำเร็จ" }
              : row
          )
        );
      } catch {
        setItems((old) => old.map((row) => (row.id === item.id ? { ...row, state: "failed", error: "ส่งไม่สำเร็จ" } : row)));
      }
    }
    setSending(false);
    if (sent) {
      setNotice(`ส่งใบเสร็จเรียบร้อย ${sent} ใบ ทีมงานจะตรวจสอบให้เร็วที่สุด`);
      await load();
      // Only the ones that made it leave the list; a failure stays put so it
      // can be looked at and tried again.
      setItems((old) => {
        old.filter((row) => row.state === "sent").forEach((row) => URL.revokeObjectURL(row.preview));
        return old.filter((row) => row.state !== "sent");
      });
      setTab("history");
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
              returnTo: `${base}${window.location.search}`,
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
  const hasHistory = entries.length > 0;

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

      {/* The one thing that outranks the form: they won something, and there
          is a date by which they have to say so. */}
      {prizes.map((prize) => (
        <div
          key={prize.id}
          className={`rounded-2xl border px-5 py-4 ${
            prize.status === "confirmed"
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="flex items-center gap-2 text-[16px] font-extrabold text-black">
            <Gift size={18} aria-hidden />
            {prize.status === "confirmed"
              ? `ยืนยันสิทธิ์ ${PRIZE_NAME[prize.prizeType]} แล้ว`
              : `ยินดีด้วย! คุณได้รับ ${PRIZE_NAME[prize.prizeType]}`}
          </p>
          {prize.status === "confirmed" ? (
            <p className="mt-1.5 text-[14px] leading-relaxed text-emerald-900">
              ทีมงานจะติดต่อกลับเพื่อนัดรับรางวัล — ใช้เบอร์และอีเมลเดียวกับที่สั่งซื้อไว้
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[14px] leading-relaxed text-amber-900">
                กรุณากดยืนยันสิทธิ์ภายใน {when(prize.confirmDeadline)} — ถ้าไม่ยืนยันภายในกำหนด
                สิทธิ์จะถูกส่งต่อให้ลำดับสำรอง
              </p>
              <button
                type="button"
                disabled={claiming === prize.id}
                onClick={() => claim(prize)}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-8"
              >
                {claiming === prize.id && <Loader2 size={16} className="animate-spin" />}
                {claiming === prize.id ? "กำลังยืนยัน…" : "ยืนยันรับรางวัล"}
              </button>
              <p className="mt-2 text-[12px] text-amber-900/70">
                ถ้าไม่ต้องการรับรางวัลนี้ กรุณาแจ้งทีมงานผ่านช่องทางติดต่อของร้าน
              </p>
            </>
          )}
        </div>
      ))}

      {approved > 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[15px] font-bold text-emerald-900">
          คุณมีสิทธิ์ลุ้นรางวัลแล้ว {approved} สิทธิ์
        </p>
      )}

      {/* Sending a receipt and looking back at the ones already sent are two
          different visits. Stacking them made the page long enough that the
          summary — the part with the answer in it — scrolled off. */}
      {open && hasHistory && (
        <div className="flex gap-1 border-b border-black/10" role="tablist">
          {([
            ["send", "แนบรูปใบเสร็จ"],
            ["history", "การอัปโหลดแต่ละครั้ง"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px min-h-11 border-b-2 px-4 text-[14px] font-semibold transition-colors ${
                tab === key ? "border-black text-black" : "border-transparent text-black/45 hover:text-black/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-8">
        {open && (!hasHistory || tab === "send") && (
          <section>
            {/* Two columns once there is something to put in the second one.
                The right side used to be gated on having an eligible order,
                which was fine while that also closed the form — now the form
                is always open, and a half-empty grid with the upload squeezed
                into the left column is what that looked like. */}
            <div className={`grid gap-6 lg:items-start ${twoUp ? "lg:grid-cols-2" : ""}`}>
              {/* Left: the stack of receipts, not one at a time. */}
              <div>
                <h2 className="text-lg font-bold text-black">แนบรูปใบเสร็จ</h2>
                {/* No eligible order is a reason to explain, not a reason to
                    close the form: a receipt this site has no record of is
                    exactly the one that needs a person to look at it. */}
                {orders.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-black/10 p-5">
                    <p className="text-[14px] font-bold text-black">ยังไม่พบคำสั่งซื้อที่เข้าเงื่อนไข</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
                      ต้องเป็นคำสั่งซื้อผลิตภัณฑ์ DENTISTE&apos; ที่ชำระเงินสำเร็จบน Smoothlife.com ระหว่าง{" "}
                      {opensLabel} – {closesLabel}
                    </p>
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
                    <p className="mt-3 text-[13px] leading-relaxed text-black/55">
                      ซื้อจริงแต่คำสั่งซื้อไม่ขึ้นที่นี่? แนบรูปใบเสร็จด้านล่างแล้วติ๊ก “ส่งให้ทีมงานตรวจเอง” ได้เลย
                    </p>
                  </div>
                )}
                {(
                  <>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
                      แคปหน้าจออีเมลยืนยันคำสั่งซื้อที่ได้รับจาก Smoothlife.com ให้เห็น
                      <b>เลขคำสั่งซื้อ (ORDER #)</b> รายการสินค้า และยอดรวม · JPG, PNG หรือ WEBP ไม่เกิน 8MB
                      <br />
                      <br />
                      <b>ส่งได้ครั้งละ 1 ใบ</b> ส่งใบนี้เสร็จแล้วอัปโหลดใบต่อไปได้เลย
                    </p>

                    <label
                      className={`relative mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-black/20 bg-black/[0.02] hover:border-black/40 ${
                        singleItem?.preview ? "p-2" : "min-h-[120px] p-4"
                      }`}
                    >
                      {/* Taking the photo back off. Tapping the picture
                          replaces it, which is the common case and why this is
                          a corner and not a row of buttons — but "I picked the
                          wrong one and want to start again" has no other way
                          out. preventDefault because the whole frame is the
                          file picker. */}
                      {singleItem?.preview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeItem(singleItem.id);
                          }}
                          aria-label="ลบรูปใบเสร็จ"
                          title="ลบรูปใบเสร็จ"
                          className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black"
                        >
                          <X size={16} aria-hidden />
                        </button>
                      )}
                      {/* The receipt itself, at the size of the space it was
                          asked for in. A photo you cannot read is a photo you
                          cannot check before sending. */}
                      {singleItem?.preview ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the file they just picked */}
                          <img
                            src={singleItem.preview}
                            alt="รูปใบเสร็จที่เลือก"
                            className="max-h-[70vh] w-full rounded-lg object-contain"
                          />
                          <span className="py-1 text-[12px] font-semibold text-black/45">แตะที่รูปเพื่อเปลี่ยน</span>
                        </>
                      ) : (
                        <>
                          <Upload size={24} className="text-black/35" aria-hidden />
                          <span className="text-[14px] font-semibold text-black/60">
                            {items.length ? "เพิ่มรูปใบเสร็จ" : "เลือกรูปใบเสร็จ"}
                          </span>
                          <span className="text-[12px] text-black/40">
                            แตะเพื่อถ่ายรูปหรือเลือกจากคลัง
                          </span>
                        </>
                      )}
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          if (picked.length) addFiles(picked);
                          // Let the same file be chosen again after a removal.
                          if (fileInput.current) fileInput.current.value = "";
                        }}
                      />
                    </label>

                    {/* Ten receipts is ten rows and a page that will not sit
                        still. Past three the list scrolls inside itself, so the
                        summary and the send button stay where they are. */}
                    {mode === "multi" && items.length > 0 && (
                      <ul
                        className={`mt-4 flex flex-col gap-3 ${
                          mode === "multi" && items.length > 3 ? "max-h-[26rem] overflow-y-auto pe-1" : ""
                        }`}
                      >
                        {items.map((item) => {
                          const order = orders.find((o) => o.id === item.orderId) ?? null;
                          // Two photos on the same order is one claim, not two
                          // — say so here rather than after they press send.
                          const duplicate =
                            !!item.orderId && items.filter((row) => row.orderId === item.orderId).length > 1;
                          return (
                            <li key={item.id} className="flex gap-3 rounded-2xl border border-black/10 p-3">
                              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the file they just picked */}
                              <img
                                src={item.preview}
                                alt=""
                                className="size-20 shrink-0 rounded-lg border border-black/10 object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                {item.reading ? (
                                  <p className="flex items-center gap-1.5 text-[13px] text-black/50">
                                    <Loader2 size={14} className="animate-spin" /> กำลังอ่านรูป…
                                  </p>
                                ) : (
                                  <label className="block">
                                    <span className="text-[11px] font-semibold text-black/45">เลขคำสั่งซื้อ (ORDER #)</span>
                                    <input
                                      value={item.declared.orderNumber}
                                      placeholder="#0000"
                                      disabled={item.state === "sending" || item.state === "sent"}
                                      onChange={(e) => setDeclared(item.id, "orderNumber", e.target.value)}
                                      className="mt-1 min-h-10 w-full rounded-xl border border-black/15 px-2.5 text-[13px] text-black"
                                    />
                                  </label>
                                )}

                                {!item.reading &&
                                  (order ? (
                                    <p className="mt-1.5 text-[12px] text-emerald-800">
                                      ตรงกับคำสั่งซื้อในระบบ · ยอด DENTISTE&apos; {formatTHB(order.dentisteAmount)} ·{" "}
                                      {order.entries} สิทธิ์
                                    </p>
                                  ) : (
                                    <p className="mt-1.5 text-[12px] text-amber-700">ยังไม่พบคำสั่งซื้อเลขนี้ในบัญชีนี้</p>
                                  ))}

                                {/* What this receipt says, as read off it, with
                                    a way in to fix it. Folded away by default:
                                    with several receipts on screen the list has
                                    to stay scannable, and most of the time the
                                    reading is right and nobody needs to touch
                                    it. */}
                                {!item.reading && item.state !== "sent" && (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItems((old) =>
                                          old.map((row) => (row.id === item.id ? { ...row, editing: !row.editing } : row))
                                        )
                                      }
                                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-left text-[12px] text-black/60 hover:bg-black/[0.06]"
                                    >
                                      <span className="min-w-0 truncate">
                                        {item.declared.orderNumber || item.declared.total
                                          ? `ข้อมูลในรูป: ${item.declared.orderNumber || "—"}${
                                              item.declared.total ? ` · ฿${item.declared.total}` : ""
                                            }`
                                          : "ยังไม่มีข้อมูลจากรูป — กรอกเองได้"}
                                      </span>
                                      <span className="shrink-0 font-semibold text-black/45">
                                        {item.editing ? "ปิด" : "แก้ไข"}
                                      </span>
                                    </button>

                                    {item.editing && (
                                      <div className="mt-2 grid gap-2">
                                        {(
                                          [
                                            ["paidAt", "วันและเวลาที่ชำระเงิน", "datetime-local", ""],
                                            ["total", "ยอดทั้งบิล (บาท)", "text", "0.00"],
                                          ] as const
                                        ).map(([key, label, type, placeholder]) => (
                                          <label key={key} className="block">
                                            <span className="text-[11px] font-semibold text-black/50">{label}</span>
                                            <input
                                              type={type}
                                              value={item.declared[key]}
                                              placeholder={placeholder}
                                              onChange={(e) => setDeclared(item.id, key, e.target.value)}
                                              className="mt-1 min-h-10 w-full rounded-lg border border-black/15 px-2.5 text-[13px] text-black"
                                            />
                                          </label>
                                        ))}
                                        <p className="text-[11px] leading-relaxed text-black/40">
                                          ข้อมูลนี้ใช้ให้ทีมงานตรวจเทียบกับรูป — จำนวนสิทธิ์คำนวณจากคำสั่งซื้อในระบบเสมอ
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {item.note && <p className="mt-1.5 text-[12px] text-amber-700">{item.note}</p>}
                                {duplicate && (
                                  <p className="mt-1.5 text-[12px] text-amber-700">
                                    มีรูปอื่นเป็นคำสั่งซื้อเดียวกัน — ระบบจะเก็บรูปล่าสุดเพียงรูปเดียว
                                  </p>
                                )}
                                {item.error && <p className="mt-1.5 text-[12px] font-semibold text-rose-700">{item.error}</p>}
                                {item.state === "sent" && (
                                  <p className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                                    <Check size={13} /> ส่งแล้ว
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                aria-label="ลบรูปนี้"
                                disabled={item.state === "sending"}
                                onClick={() => removeItem(item.id)}
                                className="size-8 shrink-0 rounded-full text-black/35 hover:bg-black/5 hover:text-black disabled:opacity-40"
                              >
                                <X size={16} className="mx-auto" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-3 text-[12px] leading-relaxed text-black/45">
                      กรุณาเก็บใบเสร็จตัวจริงไว้เป็นหลักฐานด้วย
                    </p>
                  </>
                )}
              </div>

              {/* Right: where they stand, what this receipt is worth, and the
                  two things only they can tell us. */}
              {twoUp && (
                <div className="flex flex-col gap-4">
                  <dl className="grid grid-cols-3 gap-4 rounded-2xl border border-black/10 p-4">
                    <div>
                      <dt className="text-[12px] leading-tight text-black/50">สิทธิ์ที่ได้รับแล้ว</dt>
                      <dd className="mt-1 text-[24px] font-extrabold leading-none text-black tabular-nums">{approved}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] leading-tight text-black/50">สิทธิ์รอยืนยัน</dt>
                      <dd className="mt-1 text-[24px] font-extrabold leading-none text-black tabular-nums">
                        {pendingEntries}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] leading-tight text-black/50">ยอดซื้อ DENTISTE&apos; รวม</dt>
                      <dd className="mt-1 text-[24px] font-extrabold leading-none text-black tabular-nums">
                        {formatTHB(totalDentiste)}
                      </dd>
                    </div>
                  </dl>

                  {/* The account belongs to whoever set it up; the prize has to
                      reach whoever is holding the receipt. Asked once, before
                      the receipt's own fields, because it is answered once —
                      the fields below change with every photo, this does not. */}
                  <div className="rounded-2xl border border-black/10 p-4">
                    <p className="text-[13px] font-bold text-black">ผู้รับรางวัล</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-black/50">
                      ใช้ติดต่อกลับถ้าคุณได้รับรางวัล — กรอกให้ตรงกับบัตรประชาชน
                    </p>
                    <label className="mt-3 block">
                      <span className="text-[12px] font-semibold text-black/55">ชื่อ-นามสกุล</span>
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="ชื่อ นามสกุล"
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 px-3 text-[14px] text-black"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="text-[12px] font-semibold text-black/55">เบอร์โทร</span>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        inputMode="tel"
                        placeholder="08x-xxx-xxxx"
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-black/15 px-3 text-[14px] text-black tabular-nums"
                      />
                    </label>
                  </div>

                  {/* The receipt's own details, beside the rest of the form
                      rather than tucked under its thumbnail. With one receipt
                      the fields are the form, and the photo on the left is
                      what they are read off. */}
                  {singleItem && (
                    <div className="rounded-2xl border border-black/10 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-[13px] font-bold text-black">ข้อมูลจากใบเสร็จ</p>
                        {singleItem.reading && (
                          <span className="flex items-center gap-1.5 text-[12px] text-black/50">
                            <Loader2 size={13} className="animate-spin" /> กำลังอ่านรูป…
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-black/50">
                        {singleItem.note ?? "อ่านข้อมูลจากรูปให้แล้ว ตรวจดูอีกครั้งและแก้ไขได้ก่อนส่ง"}
                      </p>

                      {/* What the number resolved to. Not a question — a
                          receipt: this is the order we found, or we did not
                          find one and they can fix the number above. */}
                      {(() => {
                        const found = orders.find((o) => o.id === singleItem.orderId) ?? null;
                        if (singleItem.reading) return null;
                        return found ? (
                          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-900">
                            ตรงกับคำสั่งซื้อ <b>{found.orderNumber ?? found.invoiceNo}</b> ในระบบ · {when(found.paidAt)} ·
                            ยอด DENTISTE&apos; {formatTHB(found.dentisteAmount)}
                          </p>
                        ) : (
                          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                            ยังไม่พบคำสั่งซื้อเลขนี้ในบัญชีนี้ — ต้องเป็นคำสั่งซื้อที่ชำระเงินสำเร็จบน Smoothlife.com
                            ในช่วงกิจกรรม และสั่งด้วยบัญชีที่กำลังเข้าสู่ระบบอยู่
                            {/* The numbers that would work, because "not
                                found" is a dead end and this is the next
                                thing they would have to ask us for. */}
                            {orders.length > 0 && (
                              <>
                                <br />
                                คำสั่งซื้อที่เข้าเงื่อนไขของคุณ:{" "}
                                <b>{orders.map((o) => o.orderNumber ?? o.invoiceNo).join(", ")}</b>
                              </>
                            )}
                          </p>
                        );
                      })()}

                      {/* The way out when the system is the one that is wrong.
                          Some orders never reach this site — the card cleared
                          and the order was not written, or it was bought
                          through a channel this table does not see. The
                          customer still has the receipt, and it is a reviewer
                          who can tell. */}
                      {!singleItem.reading && !singleItem.orderId && (
                        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                          <input
                            type="checkbox"
                            checked={singleItem.manual}
                            onChange={(e) =>
                              setItems((old) =>
                                old.map((row) => (row.id === singleItem.id ? { ...row, manual: e.target.checked } : row))
                              )
                            }
                            className="mt-0.5 h-4 w-4 accent-black"
                          />
                          <span className="text-[12px] leading-relaxed text-black/70">
                            <b className="text-black">ซื้อจริงแต่ไม่พบคำสั่งซื้อในระบบ — ส่งให้ทีมงานตรวจเอง</b>
                            <br />
                            กรอกเลขคำสั่งซื้อ วันที่ชำระเงิน และยอดรวมตามใบเสร็จให้ครบ
                            ทีมงานจะตรวจกับหลักฐานการชำระเงินแล้วให้สิทธิ์ย้อนหลัง
                          </span>
                        </label>
                      )}

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["orderNumber", "เลขคำสั่งซื้อ (ORDER #)", "text", "#0000"],
                            ["paidAt", "วันและเวลาที่ชำระเงิน", "datetime-local", ""],
                            ["total", "ยอดทั้งบิล (บาท)", "text", "0.00"],
                          ] as const
                        ).map(([key, label, type, placeholder]) => (
                          <label key={key} className="block">
                            <span className="text-[12px] font-semibold text-black/55">{label}</span>
                            <div className="relative mt-1.5">
                              <input
                                type={type}
                                value={singleItem.declared[key]}
                                placeholder={placeholder}
                                onChange={(e) => setDeclared(singleItem.id, key, e.target.value)}
                                className={`min-h-11 w-full rounded-xl border border-black/15 px-3 text-[14px] text-black ${
                                  key === "orderNumber" ? "pe-10" : ""
                                }`}
                              />
                              {/* The number the model read is the one most
                                  worth retyping, and backspacing five
                                  characters on a phone to correct it is the
                                  slow way to disagree with it. */}
                              {key === "orderNumber" && singleItem.declared.orderNumber !== "" && (
                                <button
                                  type="button"
                                  onClick={() => setDeclared(singleItem.id, "orderNumber", "")}
                                  aria-label="ล้างเลขคำสั่งซื้อ"
                                  title="ล้างเลขคำสั่งซื้อ"
                                  className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-xl text-black/35 hover:text-black"
                                >
                                  <X size={16} aria-hidden />
                                </button>
                              )}
                            </div>
                          </label>
                        ))}
                        <div>
                          <span className="text-[12px] font-semibold text-black/55">สิทธิ์ที่จะได้รับ</span>
                          {/* Not a box: a field a customer can type into is a
                              field a customer can award themselves with. */}
                          <p className="mt-1.5 flex min-h-11 items-center rounded-xl bg-black/[0.04] px-3 text-[14px] font-bold text-black tabular-nums">
                            {singleItem.orderId
                              ? `${orders.find((o) => o.id === singleItem.orderId)?.entries ?? 0} สิทธิ์`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      {singleItem.error && (
                        <p className="mt-2 text-[12px] font-semibold text-rose-700">{singleItem.error}</p>
                      )}
                    </div>
                  )}

                  {(() => {
                    const ready = items.filter(
                      (row) => sendable(row) && row.state !== "sent" && (!row.manual || manualReady(row))
                    );
                    const missing = items.filter((row) => !sendable(row) && !row.reading).length;
                    const incomplete = items.filter((row) => row.manual && !manualReady(row)).length;
                    const contactOk = contactName.trim().length >= 2 && contactPhone.replace(/\D/g, "").length >= 9;
                    return (
                      <>
                        <button
                          type="button"
                          disabled={!ready.length || sending || !contactOk}
                          onClick={sendAll}
                          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white disabled:opacity-40"
                        >
                          {sending && <Loader2 size={16} className="animate-spin" />}
                          {sending
                            ? "กำลังส่ง…"
                            : ready.length > 1
                              ? `ส่งใบเสร็จ ${ready.length} ใบ`
                              : "ส่งใบเสร็จ"}
                        </button>
                        {missing > 0 && (
                          <p className="text-center text-[12px] text-amber-700">
                            ยังมี {missing} รูปที่ยังไม่พบคำสั่งซื้อ — ตรวจเลขคำสั่งซื้อของรูปนั้นอีกครั้ง
                          </p>
                        )}
                        {incomplete > 0 && (
                          <p className="text-center text-[12px] text-amber-700">
                            ใบเสร็จเคสพิเศษต้องกรอกเลขคำสั่งซื้อ วันที่ชำระเงิน และยอดรวมให้ครบก่อนส่ง
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {notice && (
              <p role="status" className="mt-3 rounded-xl border border-black/10 px-4 py-3 text-[14px] text-black/80">
                {notice}
              </p>
            )}
          </section>
        )}

        {hasHistory && (!open || tab === "history") && (
          <section className="@container">
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

            {/* One line per order, not one card per attempt.
                A customer who buys every week and re-sends a photo now and
                then had a page that grew by a card each time — twenty cards to
                scroll through to find the one that was rejected. The order is
                the thing they think in, so the order is the row, and the
                attempts behind it open when there is a reason to look. */}
            <h3 className="mt-6 text-[15px] font-bold text-black">ใบเสร็จที่ส่งไปแล้ว</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {entries.map((entry) => {
                const tries = rows.filter((r) => r.entry.id === entry.id);
                const latest = tries[0];
                const st = STATUS[entry.status];
                const isOpen = openEntry === entry.id;
                return (
                  <li key={entry.id} className="overflow-hidden rounded-2xl border border-black/10">
                    <button
                      type="button"
                      onClick={() => setOpenEntry(isOpen ? null : entry.id)}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-black/[0.02]"
                    >
                      <span className="text-[14px] font-bold text-black">{entry.orderNumber ?? "—"}</span>
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-bold ${st.tone}`}>
                        <st.Icon size={12} aria-hidden /> {st.label}
                      </span>
                      <span className="text-[13px] text-black/55 tabular-nums">
                        {formatTHB(entry.dentisteAmount)} · {entry.entries} สิทธิ์
                      </span>
                      <span className="ms-auto flex items-center gap-2 text-[12px] text-black/40">
                        {tries.length > 1 && <span>ส่ง {tries.length} ครั้ง</span>}
                        <span className="font-semibold text-black/45">{isOpen ? "ปิด" : "ดูรายละเอียด"}</span>
                      </span>
                    </button>

                    {/* The one thing worth saying without being asked. */}
                    {entry.status === "revoked" && (
                      <p className="flex items-start gap-1.5 border-t border-black/10 bg-slate-50 px-4 py-2.5 text-[13px] text-slate-700">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                        คำสั่งซื้อนี้ได้รับการคืนเงินแล้ว สิทธิ์ที่คำนวณจากบิลใบนี้จึงถูกยกเลิก — ใบอื่นไม่ได้รับผลกระทบ
                      </p>
                    )}

                    {entry.status === "rejected" && entry.rejectReason && (
                      <p className="flex items-start gap-1.5 border-t border-black/10 bg-rose-50/60 px-4 py-2.5 text-[13px] text-rose-800">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                        {entry.rejectReason} — ส่งรูปใหม่สำหรับคำสั่งซื้อนี้ได้เลย
                      </p>
                    )}

                    {isOpen && (
                      <div className="border-t border-black/10 px-4 py-3">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] @sm:grid-cols-4">
                          <div>
                            <dt className="text-black/50">ยอดซื้อ DENTISTE&apos;</dt>
                            <dd className="mt-0.5 font-bold text-black tabular-nums">{formatTHB(entry.dentisteAmount)}</dd>
                          </div>
                          {entry.keychainAmount > 0 && (
                            <div>
                              <dt className="text-black/50">Keychain</dt>
                              <dd className="mt-0.5 font-bold text-black tabular-nums">{formatTHB(entry.keychainAmount)}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-black/50">ยอดทั้งบิล</dt>
                            <dd className="mt-0.5 text-black tabular-nums">
                              {entry.orderTotal === null ? "—" : formatTHB(entry.orderTotal)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-black/50">ส่งเมื่อ</dt>
                            <dd className="mt-0.5 text-black">{when(entry.createdAt)}</dd>
                          </div>
                        </dl>

                        {entry.status !== "rejected" &&
                          entry.entries === 0 &&
                          entry.dentisteAmount < GENERAL_THRESHOLD && (
                            <p className="mt-3 text-[13px] text-black/60">
                              ยอดซื้อ DENTISTE&apos; ของคำสั่งซื้อนี้ยังไม่ถึง {formatTHB(GENERAL_THRESHOLD)} จึงยังไม่ได้รับสิทธิ์
                            </p>
                          )}

                        {tries.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3">
                            {tries.map((t) => {
                              const v = t.verdict
                                ? AI_SHORT[t.verdict]
                                : { label: "ไม่ได้ตรวจอัตโนมัติ", tone: "text-black/50" };
                              return (
                                <li key={t.key} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                                  <span className="tabular-nums text-black/55">{whenTime(t.at)}</span>
                                  <span className={`font-semibold ${v.tone}`}>{v.label}</span>
                                  {t.key === latest?.key ? (
                                    <span className="text-black/40">· รูปล่าสุด</span>
                                  ) : (
                                    <span className="text-black/40">· ถูกแทนที่</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
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
