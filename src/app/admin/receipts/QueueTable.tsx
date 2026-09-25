"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Loader2, RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { formatTHB } from "@/lib/format";
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

function PaymentChip({ item }: { item: QueueItem }) {
  if (!item.paymentStatus) return <span className="text-[11px] text-slate-400">อ่านไม่ได้</span>;
  const [label, tone] = PAYMENT_STATUS[item.paymentStatus] ?? ["—", "border-slate-200 bg-slate-50 text-slate-600"];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {label}
    </span>
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
}: {
  item: QueueItem | null;
  busy: string | null;
  onClose: () => void;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
  onReopen: (item: QueueItem) => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
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
                  {item.orderNumber ?? "—"} · ส่งเมื่อ {when(item.sentAt)}
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
                  <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Image
                      src={item.photoUrl}
                      alt={`ใบเสร็จของ ${item.customer ?? "ลูกค้า"}`}
                      width={600}
                      height={800}
                      unoptimized
                      className="h-auto w-full rounded-lg border border-surface-line object-contain"
                    />
                    <span className="mt-1.5 block text-center text-[12px] text-slate-400">แตะเพื่อเปิดรูปเต็ม</span>
                  </a>
                ) : (
                  <p className="grid place-items-center rounded-lg bg-surface-soft p-6 text-[12px] text-slate-400">
                    เปิดรูปไม่ได้
                  </p>
                )}

                <div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                    <dt className="text-slate-500">เลขคำสั่งซื้อ</dt>
                    <dd className="text-[15px] font-bold text-brand-ink">{item.orderNumber ?? "—"}</dd>
                    <dt className="text-slate-500">สถานะการชำระเงิน</dt>
                    <dd>
                      <PaymentChip item={item} />
                      {item.refunded > 0 && (
                        <span className="ms-2 text-[12px] font-semibold text-rose-700">
                          คืนแล้ว {formatTHB(item.refunded)}
                        </span>
                      )}
                    </dd>
                    <dt className="text-slate-500">เลขใบแจ้งหนี้ 2C2P</dt>
                    <dd className="font-mono text-[12px] text-slate-500">{item.invoiceNo ?? "—"}</dd>
                    <dt className="text-slate-500">ชำระเมื่อ</dt>
                    <dd className="text-brand-ink">{when(item.paidAt)}</dd>
                    <dt className="text-slate-500">ยอดทั้งบิล</dt>
                    <dd className="text-brand-ink">{item.orderTotal === null ? "—" : formatTHB(item.orderTotal)}</dd>
                    <dt className="text-slate-500">ยอด DENTISTE&apos;</dt>
                    <dd className="font-bold text-brand-ink">{formatTHB(item.dentisteAmount)}</dd>
                    {item.keychainAmount > 0 && (
                      <>
                        <dt className="text-slate-500">Keychain</dt>
                        <dd className="text-brand-ink">{formatTHB(item.keychainAmount)}</dd>
                      </>
                    )}
                    <dt className="text-slate-500">ผู้รับรางวัล</dt>
                    <dd className="text-brand-ink">
                      {item.contactName ?? "—"}
                      {item.contactPhone && (
                        <a href={`tel:${item.contactPhone}`} className="ms-2 font-mono text-[12px] text-brand-800 underline">
                          {item.contactPhone}
                        </a>
                      )}
                    </dd>
                  </dl>

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
              {item.paymentStatus !== "PAID" && (
                <p className="mb-3 flex items-start gap-1.5 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  อนุมัติไม่ได้จนกว่าคำสั่งซื้อจะเป็น <b>ชำระแล้ว (PAID)</b> ใน Shopify — ตีกลับยังทำได้ตามปกติ
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === item.id || item.paymentStatus !== "PAID"}
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
}: {
  queue: QueueItem[];
  busy: string | null;
  /** The list of receipts already decided — it gets a status column. */
  decided?: boolean;
  onDecide: (item: QueueItem, action: "approve" | "reject") => void;
  onRecalculate: (item: QueueItem) => void;
  onReopen: (item: QueueItem) => void;
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
              <th className="text-right">ยอด DENTISTE&apos;</th>
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
                    <span className="font-semibold text-brand-ink">{item.orderNumber ?? "—"}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{item.invoiceNo ?? ""}</span>
                  </td>
                  <td className={adminTable.cell}>
                    <PaymentChip item={item} />
                  </td>
                  <td className={`${adminTable.cell} text-right`}>
                    <span className="font-semibold tabular-nums text-brand-ink">{formatTHB(item.dentisteAmount)}</span>
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
      />
    </>
  );
}
