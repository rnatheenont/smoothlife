"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  Crown,
  ExternalLink,
  Maximize2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { formatTHB } from "@/lib/format";
import { Modal } from "@/components/ui";
import { adminCards, adminTable } from "@/components/admin/layout-kit";
import {
  aiLabelOf,
  ENTRY_STATUS,
  LINE_KIND,
  PAYMENT_STATUS,
  when,
  type QueueItem,
} from "./queue-vocab";
import { Button, Spinner } from "@heroui/react";

// The queue as a list you can read down, with everything else a click away.
//
// It was a column of cards, each one a receipt photo the height of the screen
// with its facts beside it. Fine for the three receipts we tested with and
// useless at fifty: the answer to "which of these needs me" was somewhere in
// four thousand pixels of scrolling, and every row cost the same space whether
// it was obviously fine or obviously wrong.
//
// So the list carries only what decides whether to look closer — who, which
// order, whether the money is still there, what it is worth, and what the
// first read made of the photo — and the photo itself, the line items, the
// customer's own account of the receipt and the buttons live in a panel that
// opens over it.

const AI_DOT: Record<"ok" | "unclear" | "mismatch", string> = {
  ok: "bg-emerald-500",
  unclear: "bg-amber-500",
  mismatch: "bg-rose-500",
};

/** Green only for a photo matched against the shop's record — see aiLabelOf. */
function aiDotOf(check: NonNullable<QueueItem["aiCheck"]>): string {
  return check.verdict === "ok" && check.comparedAgainst !== "shop"
    ? "bg-amber-500"
    : AI_DOT[check.verdict];
}

/** What the model was given to compare the photo with, said plainly. */
const AI_BASIS: Record<"shop" | "customer" | "none", string | null> = {
  shop: null, // the ordinary case; saying it would just be noise
  customer: "เทียบกับตัวเลขที่ลูกค้ากรอกเองเท่านั้น ไม่ใช่กับข้อมูลในร้าน",
  none: "ยังไม่มีคำสั่งซื้อให้เทียบตอนตรวจ อ่านจากรูปอย่างเดียว",
};

/**
 * The payment status of whatever order this claim is about.
 *
 * For a claim with no order of ours behind it, that is the order the customer
 * named, looked up in the shop by its number. It said "อ่านไม่ได้" before,
 * which was true of our own records and useless to the person reviewing: the
 * number is on the claim, and whether that order was paid is a fact either
 * way, whoever bought it.
 */
/**
 * The order this claim is about, and whether its money is still there.
 *
 * One answer for the chip and the approve button, because they disagreed:
 * the chip learned to fall back to the order looked up by number and the
 * button did not, so a claim could read "ชำระแล้ว" above a bar saying it
 * could not be approved until it was paid.
 *
 * A claim with no order anywhere — ours or the shop's — is the one case the
 * button stays open for. That is what a เคสพิเศษ is: a receipt for a purchase
 * this site never recorded, judged by a reviewer against the photo, with the
 * entries typed in by hand.
 */
function paymentOf(item: QueueItem) {
  const fromShop = item.claimedOrder?.found
    ? item.claimedOrder.financialStatus
    : null;
  const status = item.paymentStatus ?? fromShop;
  const hasOrder = Boolean(
    item.paymentStatus || item.claimedOrder?.found || !item.manual,
  );
  return { status, hasOrder, canApprove: hasOrder ? status === "PAID" : true };
}

function PaymentChip({ item }: { item: QueueItem }) {
  const { status } = paymentOf(item);
  if (!status) {
    return (
      <span className="text-[11px] text-slate-400">
        {item.claimedOrder && !item.claimedOrder.found
          ? "ไม่พบคำสั่งซื้อนี้"
          : "อ่านไม่ได้"}
      </span>
    );
  }
  const [label, tone] = PAYMENT_STATUS[status] ?? [
    "—",
    "border-slate-200 bg-slate-50 text-slate-600",
  ];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {label}
    </span>
  );
}

/** The order number, and a way into the order itself. */
function OrderNumber({ item }: { item: QueueItem }) {
  const shown = item.manual
    ? (item.declared.orderNumber ?? item.claimedOrder?.number ?? null)
    : item.orderNumber;
  const href = item.claimedOrder?.found ? item.claimedOrder.adminUrl : null;
  if (!shown) return <>—</>;
  // Only a link when there is an order to open. A number Shopify has never
  // heard of is still worth showing — it is what the customer wrote — but
  // dressing it as a link would promise a page that is not there.
  if (!href) return <>{shown}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-brand-800 underline"
    >
      {shown}
      <ExternalLink size={12} />
    </a>
  );
}

/**
 * The thing a reviewer must not miss: this order is not this customer's.
 *
 * A receipt campaign is claimed by typing a number, and a number that is paid
 * and real can still be a stranger's purchase — the same receipt photographed
 * in a shop, or a number guessed next to one's own. Approving it hands over
 * entries somebody else earned, and nothing else on this screen would have
 * said so.
 */
/**
 * That customer's orders in the shop, for the reviewer to compare against.
 *
 * Shown only where the number on the claim found nothing — the case the
 * screen used to close with "ตรวจจากรูปใบเสร็จเป็นหลัก", which asked a person
 * to decide on a photo alone while the shop could have been asked about the
 * phone number and email sitting two lines above.
 *
 * It marks the rows whose total or date agrees with what the customer wrote,
 * because that is the comparison the reviewer is here to make and scanning a
 * column of baht for it by eye is how the wrong row gets picked. A mark is
 * not a match: the same ฿735 twice in a month is ordinary, and which order
 * the photo actually shows is still theirs to say.
 */
/**
 * Correcting the number the customer typed.
 *
 * Only shown when it found nothing, because that is the only time it is in
 * doubt — a claim the shop recognised needs no second opinion. Saving runs
 * the recalculation, so the amount and the entries follow from it rather
 * than waiting on a second button nobody would know to press.
 */
function OrderNumberFix({
  item,
  busy,
  onSave,
}: {
  item: QueueItem;
  busy: boolean;
  onSave: (orderNumber: string) => void;
}) {
  const typed = item.declared.orderNumber ?? item.claimedOrder?.number ?? "";
  const [value, setValue] = useState(typed);
  if (!item.claimedOrder || item.claimedOrder.found) return null;

  const changed = value.trim() !== "" && value.trim() !== typed.trim();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-l border border-surface-line bg-white px-3 py-2 text-[12px]">
      <span className="text-slate-500">แก้เลขคำสั่งซื้อ</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={typed || "เช่น 4418"}
        className="min-w-0 flex-1 rounded-lg border border-surface-line px-2 py-1 font-mono text-[12px] text-brand-ink focus:border-brand-800 focus:outline-none"
      />
      <button
        type="button"
        disabled={!changed || busy}
        onClick={() => onSave(value.trim())}
        className="shrink-0 rounded-full bg-brand-800 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-40"
      >
        บันทึกแล้วคำนวณใหม่
      </button>
      <span className="w-full text-[11px] text-slate-500">
        ลูกค้ากรอก <span className="font-mono">{typed || "—"}</span> ·
        คำที่ลูกค้าเขียนยังเก็บไว้ การแก้นี้บันทึกใน audit log
      </span>
    </div>
  );
}

function ContactOrders({ item }: { item: QueueItem }) {
  if (!item.contactOrders) return null;

  const who = [item.contactPhone, item.contactEmail].filter(Boolean).join(" · ");
  const { ok, orders } = item.contactOrders;

  // The lookup never answered. Saying "ไม่พบคำสั่งซื้อ" here would be the
  // screen inventing a fact out of its own failure.
  if (!ok) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px] text-slate-600">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>ค้นคำสั่งซื้อจากเบอร์และอีเมลไม่สำเร็จ — ยังไม่รู้ว่าลูกค้ามีคำสั่งซื้อหรือไม่ ลองรีเฟรชอีกครั้ง</span>
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="mt-3 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px] text-slate-600">
        ค้นด้วยเบอร์และอีเมลของลูกค้าแล้ว{who ? <> ({who})</> : null} — ไม่พบคำสั่งซื้อใดในร้าน
      </p>
    );
  }

  const sameTotal = (t: number) =>
    item.declared.total !== null && Math.abs(t - item.declared.total) <= 0.5;
  const sameDay = (iso: string | null) =>
    Boolean(iso && item.declared.paidAt && iso.slice(0, 10) === item.declared.paidAt.slice(0, 10));

  /**
   * How much of the number the customer typed is in this order's own number.
   *
   * They copy whatever the slip shows them, and the slip is not always the
   * shop's order name: the one that started this showed a 2C2P invoice,
   * 2610002021242, against orders the shop calls #4418. Comparing the two as
   * strings answers "no" to a question nobody asked. The longest run of
   * digits the two share answers the one that matters — is the shop's number
   * buried in what they wrote — and a short run is no evidence at all, so
   * three digits is the floor.
   */
  const claimDigits = (item.declared.orderNumber ?? "").replace(/\D/g, "");
  const sharedRun = (name: string) => {
    const a = claimDigits;
    const b = name.replace(/\D/g, "");
    if (!a || !b) return 0;
    let best = 0;
    for (let i = 0; i < b.length; i++) {
      for (let j = i + best + 1; j <= b.length; j++) {
        if (a.includes(b.slice(i, j))) best = j - i;
        else break;
      }
    }
    return best;
  };
  // A run only counts when it is the shop's *whole* number sitting inside
  // what they typed, or long enough that coincidence is out. Shopify names
  // orders here with four digits (#4418) and the claim was thirteen long, so
  // "three digits in common" picks a stranger's order roughly whenever it is
  // asked: #2242 shares 2-2-4 with 2610002021242 and means nothing by it.
  const scored = orders.map((o) => {
    const run = sharedRun(o.name);
    const len = o.name.replace(/\D/g, "").length;
    return { o, run, strong: run >= 3 && (run === len || run >= 6) };
  });
  const best = scored.filter((s) => s.strong).sort((x, y) => y.run - x.run)[0];
  const nearestName = best?.o.name ?? null;
  // Closest first, so the one worth opening is the one at the top.
  const ranked = [...scored].sort((x, y) => y.run - x.run).map((s) => s.o);

  return (
    <div className="mt-3 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px]">
      <p className="font-semibold text-slate-500">
        คำสั่งซื้อในร้านที่ผูกกับเบอร์หรืออีเมลนี้{who ? <> ({who})</> : null}
      </p>
      <ul className="mt-1.5 space-y-1">
        {ranked.map((o) => {
          const nearest = o.name === nearestName;
          const hit = sameTotal(o.total) || sameDay(o.paidAt) || nearest;
          return (
            <li
              key={o.name}
              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1.5 py-1 ${
                hit ? "bg-emerald-50 text-emerald-900" : "text-brand-ink"
              }`}
            >
              <a
                href={o.adminUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                {o.name}
                <ExternalLink size={11} />
              </a>
              <span className="tabular-nums">{formatTHB(o.total)}</span>
              {o.paidAt && <span className="text-slate-500">{when(o.paidAt)}</span>}
              {o.financialStatus && (
                <span className="text-[11px] text-slate-500">
                  {PAYMENT_STATUS[o.financialStatus]?.[0] ?? o.financialStatus}
                </span>
              )}
              {o.refunded > 0 && <span className="text-rose-700">คืนแล้ว {formatTHB(o.refunded)}</span>}
              {sameTotal(o.total) && <span className="font-bold">ยอดตรงกับที่ลูกค้าแจ้ง</span>}
              {sameDay(o.paidAt) && <span className="font-bold">วันตรงกับที่ลูกค้าแจ้ง</span>}
              {nearest && <span className="font-bold">เลขใกล้เคียงที่ลูกค้ากรอก</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-slate-500">
        รายการนี้เป็นตัวเลือกให้เทียบ ไม่ใช่คำตอบ — ระบบไม่ได้บอกว่าใบเสร็จตรงกับอันไหน
      </p>
    </div>
  );
}

function ClaimWarning({ item }: { item: QueueItem }) {
  if (!item.claimedOrder) return null;

  if (!item.claimedOrder.found) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          ไม่พบคำสั่งซื้อ <b>{item.claimedOrder.number}</b> ในร้าน —
          ตรวจจากรูปใบเสร็จเป็นหลัก
        </span>
      </p>
    );
  }

  if (item.claimedOrder.belongsToCustomer === false) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        {/* What was compared, not a verdict on the person. The reviewer is
            the one who decides, and "the account and phone do not match" is
            the fact; "this customer is lying" is a conclusion that a shared
            phone or a guest checkout can make wrong. */}
        <span>
          คำสั่งซื้อ <b>{item.claimedOrder.number}</b> อยู่ในชื่อคนอื่น
          {item.claimedOrder.ownerLabel ? (
            <>
              {" "}
              — <b>{item.claimedOrder.ownerLabel}</b>
            </>
          ) : null}{" "}
          (เทียบจากบัญชีและเบอร์โทร)
        </span>
      </p>
    );
  }

  if (item.claimedOrder.belongsToCustomer === null) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px] text-slate-600">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          ยืนยันไม่ได้ว่าคำสั่งซื้อ <b>{item.claimedOrder.number}</b>{" "}
          เป็นของลูกค้ารายนี้หรือไม่ (ไม่มีข้อมูลให้เทียบ)
        </span>
      </p>
    );
  }

  return null;
}

/**
 * The receipt photo, and the same photo big enough to read.
 *
 * It used to be a link to the raw file in a new tab, which is the one thing a
 * reviewer cannot do cheaply: the panel they were comparing it against is on
 * the tab they just left, so checking a total against the order meant going
 * back and forth. The dialog keeps both on the same screen and Escape brings
 * the panel back.
 *
 * Modal from @/components/ui rather than HeroUI's — admin loads no HeroUI at
 * all today, and its modal CSS would go into the global stylesheet for every
 * page of the shop. This one already handles Escape, the scroll lock, the
 * focus trap and returning focus to the thumbnail.
 */
function ReceiptPhoto({
  url,
  customer,
}: {
  url: string;
  customer: string | null;
}) {
  const [open, setOpen] = useState(false);
  const alt = `ใบเสร็จของ ${customer ?? "ลูกค้า"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="block w-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40"
      >
        <Image
          src={url}
          alt={alt}
          width={600}
          height={800}
          unoptimized
          className="h-auto w-full rounded-lg border border-surface-line object-contain"
        />
        <span className="mt-1.5 flex items-center justify-center gap-1 text-[12px] text-slate-500">
          <Maximize2 size={12} aria-hidden /> แตะเพื่อดูรูปใหญ่
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={alt} size="lg">
        {/* Capped to the viewport rather than the panel: a receipt is tall, and
            the point of opening it is to read the total at the bottom. */}
        <Image
          src={url}
          alt={alt}
          width={1200}
          height={1600}
          unoptimized
          className="mx-auto h-auto max-h-[78dvh] w-auto max-w-full rounded-lg object-contain"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800 underline"
        >
          <ExternalLink size={12} aria-hidden /> เปิดไฟล์ต้นฉบับในแท็บใหม่
        </a>
      </Modal>
    </>
  );
}

/** Everything about one receipt, in a panel over the list. */
function DetailPanel({
  item,
  busy,
  onClose,
  onDecide,
  onRecalculate,
  onSetOrderNumber,
  onReopen,
  onDelete,
}: {
  item: QueueItem | null;
  busy: string | null;
  onClose: () => void;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
  onSetOrderNumber: (item: QueueItem, orderNumber: string) => void;
  onReopen: (item: QueueItem) => void;
  onDelete: (item: QueueItem) => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Asked once, in the panel, with the receipt still on screen beside it. A
  // browser confirm() names nothing and is dismissed by reflex.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [item?.id]);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [item, onClose]);

  if (!host) return null;
  const open = Boolean(item);

  return createPortal(
    <div
      className={`fixed inset-0 z-100 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        role="presentation"
      />
      <div
        className={`absolute inset-y-0 end-0 flex w-full max-w-3xl flex-col bg-white shadow-cardHover transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {item && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-surface-line px-5 py-4">
              <div>
                <p className="text-[15px] font-bold text-brand-ink">
                  {item.customer ?? "—"}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {item.manual
                    ? `${item.declared.orderNumber ?? "—"} · เคสพิเศษ`
                    : (item.orderNumber ?? "—")}{" "}
                  · ส่งเมื่อ {when(item.sentAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="ปิด"
                onClick={onClose}
                className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
                {item.photoUrl ? (
                  <ReceiptPhoto url={item.photoUrl} customer={item.customer} />
                ) : (
                  <p className="grid place-items-center rounded-lg bg-surface-soft p-6 text-[12px] text-slate-400">
                    เปิดรูปไม่ได้
                  </p>
                )}

                <div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                    <dt className="text-slate-500">เลขคำสั่งซื้อ</dt>
                    <dd className="text-[15px] font-bold text-brand-ink">
                      <OrderNumber item={item} />
                    </dd>
                    <dt className="text-slate-500">สถานะการชำระเงิน</dt>
                    <dd>
                      <PaymentChip item={item} />
                      {(item.refunded > 0 ||
                        (item.claimedOrder?.found
                          ? item.claimedOrder.refunded
                          : 0) > 0) && (
                        <span className="ms-2 text-[12px] font-semibold text-rose-700">
                          คืนแล้ว{" "}
                          {formatTHB(
                            item.refunded ||
                              (item.claimedOrder?.found
                                ? item.claimedOrder.refunded
                                : 0),
                          )}
                        </span>
                      )}
                    </dd>
                    <dt className="text-slate-500">เลขใบแจ้งหนี้ 2C2P</dt>
                    <dd className="font-mono text-[12px] text-slate-500">
                      {item.invoiceNo ?? "—"}
                    </dd>
                    <dt className="text-slate-500">ชำระเมื่อ</dt>
                    {/* Same fallback the total below already makes: our own
                        2C2P row first, then the order in the shop. A receipt
                        sent for an order we took no payment for has no paidAt
                        of ours at all, which is every claim this campaign has
                        had — the field was a dash on all of them while Shopify
                        had the answer the whole time. The customer's own
                        version stays where it is, under "ลูกค้ากรอกมาว่า":
                        on #4360 they typed a date a day later than the order
                        was actually processed, which is the kind of thing this
                        line exists to let a reviewer see. */}
                    <dd className="text-brand-ink">
                      {item.paidAt ? (
                        when(item.paidAt)
                      ) : item.claimedOrder?.found &&
                        item.claimedOrder.paidAt ? (
                        <>
                          {when(item.claimedOrder.paidAt)}{" "}
                          <span className="text-[11px] text-slate-400">
                            (จากคำสั่งซื้อในร้าน)
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt className="text-slate-500">ยอดทั้งบิล</dt>
                    <dd className="text-brand-ink">
                      {item.orderTotal !== null ? (
                        formatTHB(item.orderTotal)
                      ) : item.claimedOrder?.found ? (
                        <>
                          {formatTHB(item.claimedOrder.total)}{" "}
                          <span className="text-[11px] text-slate-400">
                            (จากคำสั่งซื้อในร้าน)
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                    {/* One number, because two of them read as a fault. A
                        keychain set is counted as keychain and deliberately
                        kept out of the Dentiste step so it is not paid for
                        twice — which put "ยอด DENTISTE' ฿0" next to "ยอดทั้งบิล
                        ฿990" on every receipt that was nothing but the set,
                        and the first question it drew was whether the system
                        was broken. The split still exists where it decides
                        anything: each line below carries its own tag, and the
                        breakdown shows here when a bill really has both. */}
                    <dt className="text-slate-500">ยอดสินค้าที่ร่วมรายการ</dt>
                    <dd className="font-bold text-brand-ink">
                      {formatTHB(
                        item.dentisteAmount +
                          item.keychainAmount +
                          (item.vipAmount ?? 0),
                      )}
                      {item.dentisteAmount > 0 && item.keychainAmount > 0 && (
                        <span className="ms-2 text-[11px] font-normal text-slate-500">
                          DENTISTE&apos; {formatTHB(item.dentisteAmount)} ·
                          Keychain {formatTHB(item.keychainAmount)}
                        </span>
                      )}
                      {(item.vipAmount ?? 0) > 0 && (
                        <span className="mt-0.5 block text-[11.5px] font-semibold text-amber-800">
                          นับสิทธิ์{" "}
                          {formatTHB(item.dentisteAmount + item.keychainAmount)}{" "}
                          · เซ็ต VIP {formatTHB(item.vipAmount ?? 0)} ไม่นับ
                        </span>
                      )}
                    </dd>
                    <dt className="text-slate-500">ผู้รับรางวัล</dt>
                    <dd className="text-brand-ink">
                      {item.contactName ?? "—"}
                      {item.contactPhone && (
                        <a
                          href={`tel:${item.contactPhone}`}
                          className="ms-2 font-mono text-[12px] text-brand-800 underline"
                        >
                          {item.contactPhone}
                        </a>
                      )}
                      {item.contactEmail && (
                        <a
                          href={`mailto:${item.contactEmail}`}
                          className="mt-0.5 block break-all text-[12px] text-brand-800 underline"
                        >
                          {item.contactEmail}
                        </a>
                      )}
                    </dd>
                  </dl>

                  {/* Said before the number, because the number is the thing
                      that looks wrong: a ฿55,000 bill approving for nothing.
                      The set buys its own privileges, so it earns no entries
                      — that is the rule, not a miscalculation. */}
                  {item.vip && (
                    <p className="mt-3 flex items-start gap-2 rounded-l border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                      <Crown size={14} className="mt-0.5 shrink-0" />
                      <span>
                        ลูกค้ามีสิทธิ <b>VIP EXCLUSIVE PRIVILEGES</b> — ซื้อเซ็ต
                        Early Bird VIP 25 Set Only
                        <span className="mt-0.5 block text-amber-800">
                          เซ็ตนี้ไม่นับเป็นสิทธิ์ลุ้นรางวัล อนุมัติได้ตามปกติ
                        </span>
                      </span>
                    </p>
                  )}

                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
                    <span>
                      ระบบคำนวณได้{" "}
                      <span className="font-bold text-brand-ink">
                        {item.entries} สิทธิ์
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => onRecalculate(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-surface-line px-3 py-1 text-[12px] font-semibold text-brand-800 hover:bg-surface-soft disabled:opacity-50"
                    >
                      <RefreshCw size={12} /> คำนวณสิทธิ์ใหม่
                    </button>
                  </p>

                  {item.lines.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-l border border-surface-line">
                      <p className="bg-surface-soft px-3 py-1.5 text-[12px] font-semibold text-slate-500">
                        รายการในบิล ({item.lines.length} รายการ)
                      </p>
                      <ul className="divide-y divide-surface-line">
                        {item.lines.map((line, i) => (
                          <li
                            key={`${line.name}-${i}`}
                            className="flex items-baseline gap-2 px-3 py-2 text-[12px]"
                          >
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${LINE_KIND[line.kind][1]}`}
                            >
                              {LINE_KIND[line.kind][0]}
                            </span>
                            <span className="min-w-0 flex-1 text-brand-ink">
                              {line.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              ×{line.quantity}
                            </span>
                            <span className="shrink-0 tabular-nums font-semibold text-brand-ink">
                              {formatTHB(line.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <ClaimWarning item={item} />
                  <OrderNumberFix
                    item={item}
                    busy={busy === item.id}
                    onSave={(n) => onSetOrderNumber(item, n)}
                  />
                  <ContactOrders item={item} />

                  {(item.declared.orderNumber ||
                    item.declared.total !== null) && (
                    <div className="mt-4 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px]">
                      <p className="font-semibold text-slate-500">
                        ลูกค้ากรอกมาว่า
                      </p>
                      <p className="mt-1 text-brand-ink">
                        เลขคำสั่งซื้อ{" "}
                        <b
                          className={
                            item.declared.orderNumber &&
                            item.orderNumber &&
                            item.declared.orderNumber.replace(/\D/g, "") !==
                              item.orderNumber.replace(/\D/g, "")
                              ? "text-rose-700"
                              : "text-brand-ink"
                          }
                        >
                          {item.declared.orderNumber ?? "—"}
                        </b>
                        {item.declared.total !== null && (
                          <>
                            {" · "}ยอดทั้งบิล{" "}
                            <b
                              className={
                                item.orderTotal !== null &&
                                Math.abs(
                                  item.declared.total - item.orderTotal,
                                ) > 0.5
                                  ? "text-rose-700"
                                  : "text-brand-ink"
                              }
                            >
                              {formatTHB(item.declared.total)}
                            </b>
                          </>
                        )}
                        {item.declared.paidAt && (
                          <>
                            {" · "}
                            {when(item.declared.paidAt)}
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {item.aiCheck && (
                    <div
                      className={`mt-4 rounded-l border px-3 py-2 text-[12px] ${aiLabelOf(item.aiCheck)[1]}`}
                    >
                      <p className="font-bold">
                        AI ตรวจเบื้องต้น · {aiLabelOf(item.aiCheck)[0]}
                      </p>
                      {AI_BASIS[item.aiCheck.comparedAgainst ?? "customer"] && (
                        <p className="mt-0.5 font-semibold opacity-90">
                          {AI_BASIS[item.aiCheck.comparedAgainst ?? "customer"]}
                        </p>
                      )}
                      {item.aiCheck.message && (
                        <p className="mt-0.5">{item.aiCheck.message}</p>
                      )}
                      {item.aiCheck.findings.length > 0 && (
                        <ul className="mt-1 list-inside list-disc opacity-80">
                          {item.aiCheck.findings.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-surface-line px-5 py-4">
              {item.status !== "pending_review" ? (
                <>
                  <p className="mb-3 text-[12px] text-slate-500">
                    ตรวจแล้วเมื่อ {when(item.reviewedAt)}
                    {(item.rejectReason || item.revokeReason) && (
                      <> · {item.rejectReason ?? item.revokeReason}</>
                    )}
                  </p>
                  <Button
                    variant="outline"
                    isDisabled={busy === item.id}
                    onPress={() => onReopen(item)}
                    className="w-full"
                  >
                    <RefreshCw size={15} /> ดึงกลับมาตรวจใหม่
                  </Button>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    ใบเสร็จจะกลับไปอยู่ในคิวตรวจ และผลเดิมถูกบันทึกไว้ใน audit
                    log — ถ้าประกาศผลไปแล้ว รายชื่อที่จับได้จะไม่เปลี่ยนตาม
                    ต้องตัดสินใจแยก
                  </p>
                </>
              ) : (
                <>
                  {!paymentOf(item).canApprove && (
                    <p className="mb-3 flex items-start gap-1.5 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>
                        อนุมัติไม่ได้ — คำสั่งซื้อนี้
                        {paymentOf(item).status ? (
                          <>
                            {" "}
                            อยู่ในสถานะ{" "}
                            <b>
                              {PAYMENT_STATUS[paymentOf(item).status!]?.[0] ??
                                paymentOf(item).status}
                            </b>
                          </>
                        ) : (
                          <> อ่านสถานะจาก Shopify ไม่ได้</>
                        )}{" "}
                        ไม่ใช่ <b>ชำระแล้ว (PAID)</b> — ตีกลับยังทำได้ตามปกติ
                      </span>
                    </p>
                  )}
                  {paymentOf(item).canApprove && !paymentOf(item).hasOrder && (
                    <p className="mb-3 flex items-start gap-1.5 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px] text-slate-600">
                      <AlertTriangle
                        size={13}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      ไม่พบคำสั่งซื้อนี้ในร้าน —
                      อนุมัติได้ด้วยดุลพินิจของผู้ตรวจ และต้องระบุจำนวนสิทธิ์เอง
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      isDisabled={
                        busy === item.id || !paymentOf(item).canApprove
                      }
                      onPress={() => onDecide(item, "approve")}
                      className="flex-1"
                    >
                      <Check size={15} /> อนุมัติ
                    </Button>
                    <Button
                      variant="danger-soft"
                      isDisabled={busy === item.id}
                      onPress={() => onDecide(item, "reject")}
                    >
                      <X size={15} /> ตีกลับ
                    </Button>
                  </div>
                </>
              )}

              {/* Permanent, and the only thing on this panel that is. Kept
                  below a rule and behind a second press, because the row it
                  destroys takes the customer's receipt photo with it. */}
              <div className="mt-4 border-t border-surface-line pt-3">
                {confirming ? (
                  <div className="rounded-l border border-rose-200 bg-rose-50 p-3">
                    <p className="text-[12px] leading-relaxed text-rose-900">
                      ลบใบเสร็จของ <b>{item.customer || "ลูกค้ารายนี้"}</b> ถาวร
                      — รวมรูปใบเสร็จที่อัปโหลดไว้ กู้คืนไม่ได้
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        isDisabled={busy === item.id}
                        onPress={() => onDelete(item)}
                        className="flex-1"
                      >
                        <Trash2 size={14} /> ลบถาวร
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setConfirming(false)}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => setConfirming(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> ลบใบเสร็จนี้
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    host,
  );
}

export default function QueueTable({
  queue,
  busy,
  decided = false,
  onDecide,
  onRecalculate,
  onSetOrderNumber,
  onReopen,
  onDelete,
}: {
  queue: QueueItem[];
  busy: string | null;
  /** The list of receipts already decided — it gets a status column. */
  decided?: boolean;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
  onSetOrderNumber: (item: QueueItem, orderNumber: string) => void;
  onReopen: (item: QueueItem) => void;
  onDelete: (item: QueueItem) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Looked up in the list rather than copied out of it: approving reloads the
  // queue, and a panel still showing the row as it was is a panel lying. A row
  // that has left the queue is simply not open any more — no state to reset.
  const open = queue.find((row) => row.id === openId) ?? null;

  return (
    <>
      {/* A phone gets a card per receipt. Tapping it opens the same panel the
          row does — every decision lives in there, so the card only has to
          carry what the reviewer picks a row by: whose it is, how much, how
          many entries, and whether anything is flagged. */}
      <ul className={adminCards.list}>
        {queue.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(item.id)}
              className={`${adminCards.item} w-full text-left transition-colors hover:bg-brand-50/40`}
            >
              <span className="flex items-start gap-2.5">
                {item.photoUrl ? (
                  <Image
                    src={item.photoUrl}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="size-11 shrink-0 rounded border border-surface-line object-cover"
                  />
                ) : (
                  <span className="size-11 shrink-0 rounded border border-surface-line bg-surface-soft" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="block truncate text-[13px] font-semibold text-brand-ink">
                      {item.customer ?? "—"}
                    </span>
                    {busy === item.id && (
                      <Spinner
                        size="sm"
                        color="current"
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {(item.manual
                      ? item.declared.orderNumber
                      : item.orderNumber) ?? "—"}
                    {item.invoiceNo ? ` · ${item.invoiceNo}` : ""}
                  </span>

                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <PaymentChip item={item} />
                    {item.vip && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        <Crown size={11} aria-hidden /> VIP
                      </span>
                    )}
                    {decided && (
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                          ENTRY_STATUS[item.status][1]
                        }`}
                      >
                        {ENTRY_STATUS[item.status][0]}
                      </span>
                    )}
                    {item.aiCheck && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <span
                          className={`size-2 shrink-0 rounded-full ${aiDotOf(item.aiCheck)}`}
                        />
                        {aiLabelOf(item.aiCheck)[0]}
                      </span>
                    )}
                  </span>

                  <span className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[12px] text-slate-500">
                    <span className="text-[15px] font-bold tabular-nums text-brand-ink">
                      {formatTHB(
                        item.dentisteAmount +
                          item.keychainAmount +
                          (item.vipAmount ?? 0),
                      )}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-brand-ink">
                      {item.entries} สิทธิ์
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400">
                      {when(item.sentAt)}
                    </span>
                  </span>

                  {(item.vipAmount ?? 0) > 0 && (
                    <span className="mt-0.5 block text-[11px] font-semibold text-amber-800">
                      นับสิทธิ์{" "}
                      {formatTHB(item.dentisteAmount + item.keychainAmount)} ·
                      เซ็ต VIP ไม่นับ
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className={`${adminCards.forTable} ${adminTable.scroll}`}>
        {/* The customer's name takes the slack; everything else is a number,
            a chip or a date and gets exactly what it needs. Without this the
            browser hands a 27" monitor's spare width to whichever column has
            the longest word in it. */}
        <table className={`${adminTable.table} table-fixed`}>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[5%]" />
            <col className="w-[13%]" />
            {decided && <col className="w-[11%]" />}
            <col className="w-[9%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className={adminTable.thead}>
            <tr>
              <th>ลูกค้า</th>
              <th>คำสั่งซื้อ</th>
              <th>การชำระเงิน</th>
              <th>สถานะพิเศษ</th>
              <th className="text-right whitespace-nowrap">ยอดสินค้า</th>
              <th className="text-right">สิทธิ์</th>
              <th>AI ตรวจ</th>
              {decided && <th>ผลตรวจ</th>}
              <th className="whitespace-nowrap">ส่งเมื่อ</th>
              <th className="w-[124px]" />
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => {
              const dentisteLines = item.lines.filter(
                (l) => l.kind !== "other",
              );
              const billTotal =
                item.dentisteAmount +
                item.keychainAmount +
                (item.vipAmount ?? 0);
              // The customer's figure, and only when nothing of ours stands
              // behind it: the shop has no order under that number, or there
              // is no order at all (a receipt sent by hand). A row the shop
              // *does* know keeps showing ฿0 if that is what it was worth.
              const declaredOnly =
                item.orderTotal === null ||
                item.claimedOrder?.found === false ||
                item.manual === true
                  ? item.declared.total
                  : null;
              return (
                <tr
                  key={item.id}
                  className={`${adminTable.row} cursor-pointer`}
                  onClick={() => setOpenId(item.id)}
                >
                  <td className={adminTable.cell}>
                    <span className="flex items-center gap-2.5">
                      {item.photoUrl ? (
                        <Image
                          src={item.photoUrl}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="size-9 shrink-0 rounded border border-surface-line object-cover"
                        />
                      ) : (
                        <span className="size-9 shrink-0 rounded border border-surface-line bg-surface-soft" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-brand-ink">
                          {item.customer ?? "—"}
                        </span>
                        {item.contactName &&
                          item.contactName !== item.customer && (
                            <span className="block truncate text-[11px] text-slate-400">
                              {item.contactName}
                            </span>
                          )}
                      </span>
                    </span>
                  </td>
                  <td className={adminTable.cell}>
                    <span className="font-semibold text-brand-ink">
                      {item.manual
                        ? (item.declared.orderNumber ?? "—")
                        : (item.orderNumber ?? "—")}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {item.invoiceNo ?? ""}
                    </span>
                  </td>
                  <td className={adminTable.cell}>
                    <PaymentChip item={item} />
                  </td>
                  {/* Readable down the list, not only after opening a row. A
                      VIP bill approves for nothing on purpose, and the
                      reviewer scanning the สิทธิ์ column for a zero that looks
                      wrong should find the reason on the same line. */}
                  <td className={adminTable.cell}>
                    {item.vip ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        <Crown size={11} aria-hidden /> VIP
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`${adminTable.cell} text-right`}>
                    {/* The money on the bill is the black number, including
                        the VIP set. It was the counted figure before, so a VIP
                        row read ฿0 beside a ฿55,000 purchase and looked like
                        the money had been missed. What counts moves to the
                        line under it, and only appears when the two differ. */}
                    {billTotal === 0 && declaredOnly !== null ? (
                      // Every figure above is read off the shop's copy of the
                      // order, so a receipt whose number the shop has never
                      // seen totalled ฿0 — which reads as "this purchase was
                      // worth nothing" rather than "we have no record of it".
                      // The customer's own figure is all there is, and it is
                      // written in the colour the row's other unverified
                      // claims use, never as the black confirmed number.
                      <>
                        <span className="font-semibold tabular-nums text-amber-800">
                          {formatTHB(declaredOnly)}
                        </span>
                        <span className="block whitespace-nowrap text-[11px] font-semibold text-amber-800">
                          ลูกค้าแจ้ง · ยังไม่ยืนยัน
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold tabular-nums text-brand-ink">
                        {formatTHB(billTotal)}
                      </span>
                    )}
                    {(item.vipAmount ?? 0) > 0 && (
                      <span className="block whitespace-nowrap text-[11px] font-semibold text-amber-800">
                        นับสิทธิ์{" "}
                        {formatTHB(item.dentisteAmount + item.keychainAmount)} ·
                        เซ็ต VIP ไม่นับ
                      </span>
                    )}
                    {dentisteLines.length > 0 && (
                      <span className="block text-[11px] text-slate-400">
                        {dentisteLines.length} รายการ ·{" "}
                        {dentisteLines.reduce((n, l) => n + l.quantity, 0)} ชิ้น
                      </span>
                    )}
                  </td>
                  <td className={`${adminTable.cell} text-right`}>
                    <span className="font-bold tabular-nums text-brand-ink">
                      {item.entries}
                    </span>
                  </td>
                  <td className={adminTable.cell}>
                    {item.aiCheck ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-slate-600">
                        <span
                          className={`size-2 shrink-0 rounded-full ${aiDotOf(item.aiCheck)}`}
                        />
                        {aiLabelOf(item.aiCheck)[0]}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        ไม่ได้ตรวจ
                      </span>
                    )}
                  </td>
                  {decided && (
                    <td className={adminTable.cell}>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                          ENTRY_STATUS[item.status][1]
                        }`}
                      >
                        {ENTRY_STATUS[item.status][0]}
                      </span>
                    </td>
                  )}
                  <td className={adminTable.muted}>{when(item.sentAt)}</td>
                  {/* The table is table-fixed, so this column takes the width
                      its header is given and nothing the content says can
                      widen it — nowrap alone left an 89px pill in a 44px
                      cell. The header below carries the width; this keeps the
                      pill on one line inside it. */}
                  <td
                    className={`${adminTable.cell} whitespace-nowrap text-right`}
                  >
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      {busy === item.id && (
                        <Spinner
                          size="sm"
                          color="current"
                          className="text-slate-400"
                        />
                      )}
                      <span className="whitespace-nowrap rounded-full border border-surface-line px-3 py-1 text-[12px] font-semibold text-brand-800">
                        ดูรายละเอียด
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailPanel
        item={open}
        busy={busy}
        onClose={() => setOpenId(null)}
        onDecide={onDecide}
        onRecalculate={onRecalculate}
        onSetOrderNumber={onSetOrderNumber}
        onReopen={onReopen}
        onDelete={onDelete}
      />
    </>
  );
}
