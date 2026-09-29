"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Crown, ExternalLink, Loader2, Maximize2, RefreshCw, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { formatTHB } from "@/lib/format";
import { Modal } from "@/components/ui";
import { adminTable } from "@/components/admin/layout-kit";
import { AI_LABEL, ENTRY_STATUS, LINE_KIND, PAYMENT_STATUS, when, type QueueItem } from "./queue-vocab";

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
  const fromShop = item.claimedOrder?.found ? item.claimedOrder.financialStatus : null;
  const status = item.paymentStatus ?? fromShop;
  const hasOrder = Boolean(item.paymentStatus || item.claimedOrder?.found || !item.manual);
  return { status, hasOrder, canApprove: hasOrder ? status === "PAID" : true };
}

function PaymentChip({ item }: { item: QueueItem }) {
  const { status } = paymentOf(item);
  if (!status) {
    return (
      <span className="text-[11px] text-slate-400">
        {item.claimedOrder && !item.claimedOrder.found ? "ไม่พบคำสั่งซื้อนี้" : "อ่านไม่ได้"}
      </span>
    );
  }
  const [label, tone] = PAYMENT_STATUS[status] ?? ["—", "border-slate-200 bg-slate-50 text-slate-600"];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

/** The order number, and a way into the order itself. */
function OrderNumber({ item }: { item: QueueItem }) {
  const shown = item.manual ? (item.declared.orderNumber ?? item.claimedOrder?.number ?? null) : item.orderNumber;
  const href = item.claimedOrder?.found ? item.claimedOrder.adminUrl : null;
  if (!shown) return <>—</>;
  // Only a link when there is an order to open. A number Shopify has never
  // heard of is still worth showing — it is what the customer wrote — but
  // dressing it as a link would promise a page that is not there.
  if (!href) return <>{shown}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-800 underline">
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
function ClaimWarning({ item }: { item: QueueItem }) {
  if (!item.claimedOrder) return null;

  if (!item.claimedOrder.found) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          ไม่พบคำสั่งซื้อ <b>{item.claimedOrder.number}</b> ในร้าน — ตรวจจากรูปใบเสร็จเป็นหลัก
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
          {item.claimedOrder.ownerLabel ? <> — <b>{item.claimedOrder.ownerLabel}</b></> : null} (เทียบจากบัญชีและเบอร์โทร)
        </span>
      </p>
    );
  }

  if (item.claimedOrder.belongsToCustomer === null) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px] text-slate-600">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          ยืนยันไม่ได้ว่าคำสั่งซื้อ <b>{item.claimedOrder.number}</b> เป็นของลูกค้ารายนี้หรือไม่ (ไม่มีข้อมูลให้เทียบ)
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
function ReceiptPhoto({ url, customer }: { url: string; customer: string | null }) {
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
  onReopen,
  onDelete,
}: {
  item: QueueItem | null;
  busy: string | null;
  onClose: () => void;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
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
    <div className={`fixed inset-0 z-100 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
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
                <p className="text-[15px] font-bold text-brand-ink">{item.customer ?? "—"}</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {item.manual ? `${item.declared.orderNumber ?? "—"} · เคสพิเศษ` : (item.orderNumber ?? "—")} · ส่งเมื่อ{" "}
                  {when(item.sentAt)}
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
                      {(item.refunded > 0 || (item.claimedOrder?.found ? item.claimedOrder.refunded : 0) > 0) && (
                        <span className="ms-2 text-[12px] font-semibold text-rose-700">
                          คืนแล้ว{" "}
                          {formatTHB(item.refunded || (item.claimedOrder?.found ? item.claimedOrder.refunded : 0))}
                        </span>
                      )}
                    </dd>
                    <dt className="text-slate-500">เลขใบแจ้งหนี้ 2C2P</dt>
                    <dd className="font-mono text-[12px] text-slate-500">{item.invoiceNo ?? "—"}</dd>
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
                      ) : item.claimedOrder?.found && item.claimedOrder.paidAt ? (
                        <>
                          {when(item.claimedOrder.paidAt)}{" "}
                          <span className="text-[11px] text-slate-400">(จากคำสั่งซื้อในร้าน)</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt className="text-slate-500">ยอดทั้งบิล</dt>
                    <dd className="text-brand-ink">
                      {item.orderTotal !== null
                        ? formatTHB(item.orderTotal)
                        : item.claimedOrder?.found
                          ? <>{formatTHB(item.claimedOrder.total)} <span className="text-[11px] text-slate-400">(จากคำสั่งซื้อในร้าน)</span></>
                          : "—"}
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
                    <dt className="text-slate-500">ยอดที่นับสิทธิ์</dt>
                    <dd className="font-bold text-brand-ink">
                      {formatTHB(item.dentisteAmount + item.keychainAmount)}
                      {item.dentisteAmount > 0 && item.keychainAmount > 0 && (
                        <span className="ms-2 text-[11px] font-normal text-slate-500">
                          DENTISTE&apos; {formatTHB(item.dentisteAmount)} · Keychain{" "}
                          {formatTHB(item.keychainAmount)}
                        </span>
                      )}
                    </dd>
                    <dt className="text-slate-500">ผู้รับรางวัล</dt>
                    <dd className="text-brand-ink">
                      {item.contactName ?? "—"}
                      {item.contactPhone && (
                        <a href={`tel:${item.contactPhone}`} className="ms-2 font-mono text-[12px] text-brand-800 underline">
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
                        ลูกค้ามีสิทธิ <b>VIP EXCLUSIVE PRIVILEGES</b> — ซื้อเซ็ต Early Bird VIP 25 Set Only
                        <span className="mt-0.5 block text-amber-800">
                          เซ็ตนี้ไม่นับเป็นสิทธิ์ลุ้นรางวัล อนุมัติได้ตามปกติ
                        </span>
                      </span>
                    </p>
                  )}

                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
                    <span>
                      ระบบคำนวณได้ <span className="font-bold text-brand-ink">{item.entries} สิทธิ์</span>
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
                          <li key={`${line.name}-${i}`} className="flex items-baseline gap-2 px-3 py-2 text-[12px]">
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${LINE_KIND[line.kind][1]}`}>
                              {LINE_KIND[line.kind][0]}
                            </span>
                            <span className="min-w-0 flex-1 text-brand-ink">{line.name}</span>
                            <span className="shrink-0 tabular-nums text-slate-500">×{line.quantity}</span>
                            <span className="shrink-0 tabular-nums font-semibold text-brand-ink">{formatTHB(line.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <ClaimWarning item={item} />

                  {(item.declared.orderNumber || item.declared.total !== null) && (
                    <div className="mt-4 rounded-l border border-surface-line bg-surface-soft px-3 py-2 text-[12px]">
                      <p className="font-semibold text-slate-500">ลูกค้ากรอกมาว่า</p>
                      <p className="mt-1 text-brand-ink">
                        เลขคำสั่งซื้อ{" "}
                        <b
                          className={
                            item.declared.orderNumber && item.orderNumber &&
                            item.declared.orderNumber.replace(/\D/g, "") !== item.orderNumber.replace(/\D/g, "")
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
                                item.orderTotal !== null && Math.abs(item.declared.total - item.orderTotal) > 0.5
                                  ? "text-rose-700"
                                  : "text-brand-ink"
                              }
                            >
                              {formatTHB(item.declared.total)}
                            </b>
                          </>
                        )}
                        {item.declared.paidAt && <>{" · "}{when(item.declared.paidAt)}</>}
                      </p>
                    </div>
                  )}

                  {item.aiCheck && (
                    <div className={`mt-4 rounded-l border px-3 py-2 text-[12px] ${AI_LABEL[item.aiCheck.verdict][1]}`}>
                      <p className="font-bold">AI ตรวจเบื้องต้น · {AI_LABEL[item.aiCheck.verdict][0]}</p>
                      {item.aiCheck.message && <p className="mt-0.5">{item.aiCheck.message}</p>}
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
                    {(item.rejectReason || item.revokeReason) && <> · {item.rejectReason ?? item.revokeReason}</>}
                  </p>
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => onReopen(item)}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-surface-line px-4 text-[14px] font-semibold text-brand-800 hover:bg-surface-soft disabled:opacity-50"
                  >
                    <RefreshCw size={15} /> ดึงกลับมาตรวจใหม่
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    ใบเสร็จจะกลับไปอยู่ในคิวตรวจ และผลเดิมถูกบันทึกไว้ใน audit log —
                    ถ้าประกาศผลไปแล้ว รายชื่อที่จับได้จะไม่เปลี่ยนตาม ต้องตัดสินใจแยก
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
                        {" "}อยู่ในสถานะ <b>{PAYMENT_STATUS[paymentOf(item).status!]?.[0] ?? paymentOf(item).status}</b>
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
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-slate-400" />
                  ไม่พบคำสั่งซื้อนี้ในร้าน — อนุมัติได้ด้วยดุลพินิจของผู้ตรวจ และต้องระบุจำนวนสิทธิ์เอง
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === item.id || !paymentOf(item).canApprove}
                  onClick={() => onDecide(item, "approve")}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-800 px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  <Check size={15} /> อนุมัติ
                </button>
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => onDecide(item, "reject")}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-5 text-[14px] font-semibold text-rose-700 disabled:opacity-50"
                >
                  <X size={15} /> ตีกลับ
                </button>
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
                      ลบใบเสร็จของ <b>{item.customer || "ลูกค้ารายนี้"}</b> ถาวร — รวมรูปใบเสร็จที่อัปโหลดไว้
                      กู้คืนไม่ได้
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => onDelete(item)}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                      >
                        <Trash2 size={14} /> ลบถาวร
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-surface-line px-4 text-[13px] font-semibold text-slate-600"
                      >
                        ยกเลิก
                      </button>
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
    host
  );
}

export default function QueueTable({
  queue,
  busy,
  decided = false,
  onDecide,
  onRecalculate,
  onReopen,
  onDelete,
}: {
  queue: QueueItem[];
  busy: string | null;
  /** The list of receipts already decided — it gets a status column. */
  decided?: boolean;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
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
      <div className={adminTable.scroll}>
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
              <th className="text-right">ยอดที่นับสิทธิ์</th>
              <th className="text-right">สิทธิ์</th>
              <th>AI ตรวจ</th>
              {decided && <th>ผลตรวจ</th>}
              <th>ส่งเมื่อ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => {
              const dentisteLines = item.lines.filter((l) => l.kind !== "other");
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
                        <span className="block truncate font-semibold text-brand-ink">{item.customer ?? "—"}</span>
                        {item.contactName && item.contactName !== item.customer && (
                          <span className="block truncate text-[11px] text-slate-400">{item.contactName}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className={adminTable.cell}>
                    <span className="font-semibold text-brand-ink">
                      {item.manual ? (item.declared.orderNumber ?? "—") : (item.orderNumber ?? "—")}
                    </span>
                    {item.manual && (
                      <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        เคสพิเศษ
                      </span>
                    )}
                    <span className="block font-mono text-[11px] text-slate-400">{item.invoiceNo ?? ""}</span>
                  </td>
                  <td className={adminTable.cell}>
                    <PaymentChip item={item} />
                  </td>
                  <td className={`${adminTable.cell} text-right`}>
                    <span className="font-semibold tabular-nums text-brand-ink">
                      {formatTHB(item.dentisteAmount + item.keychainAmount)}
                    </span>
                    {dentisteLines.length > 0 && (
                      <span className="block text-[11px] text-slate-400">
                        {dentisteLines.length} รายการ · {dentisteLines.reduce((n, l) => n + l.quantity, 0)} ชิ้น
                      </span>
                    )}
                  </td>
                  <td className={`${adminTable.cell} text-right`}>
                    <span className="font-bold tabular-nums text-brand-ink">{item.entries}</span>
                  </td>
                  <td className={adminTable.cell}>
                    {item.aiCheck ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-slate-600">
                        <span className={`size-2 shrink-0 rounded-full ${AI_DOT[item.aiCheck.verdict]}`} />
                        {AI_LABEL[item.aiCheck.verdict][0]}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">ไม่ได้ตรวจ</span>
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
                  <td className={`${adminTable.cell} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      {busy === item.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                      <span className="rounded-full border border-surface-line px-3 py-1 text-[12px] font-semibold text-brand-800">
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
        onReopen={onReopen}
        onDelete={onDelete}
      />
    </>
  );
}
