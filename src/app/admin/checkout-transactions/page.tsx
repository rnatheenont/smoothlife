"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Undo2,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { formatTHB } from "@/lib/format";
import { Badge } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, Panel, adminTable } from "@/components/admin/layout-kit";
import { Button } from "@heroui/react";
import {
  refundRouteFor,
  REFUND_ROUTE_LABEL,
  type RefundRoute,
} from "@/lib/refund-route";

type Transaction = {
  id: string;
  invoice_no: string;
  amount: number;
  currency_code: string;
  status: "success" | "refunded";
  shopify_order_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tran_ref: string | null;
  refunded_at: string | null;
  refund_note: string | null;
  created_at: string;
  confirmed_at: string | null;
};

const PORTAL_URL = "https://merchant.2c2p.com/";

/** The 2C2P transaction reference, which is what the portal searches by. Shown
 *  rather than described because the alternative is an admin reading it off a
 *  different screen and typing it wrong into a refund form. */
function TranRefCopy({ tranRef }: { tranRef: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(tranRef).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => {},
        );
      }}
      className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
    >
      {tranRef}
      {copied ? (
        <Check size={11} className="text-emerald-600" />
      ) : (
        <Copy size={11} className="text-slate-400" />
      )}
      <span className="sr-only">คัดลอก tran ref</span>
    </button>
  );
}

function RefundControls({
  tx,
  onDone,
}: {
  tx: Transaction;
  onDone: () => void;
}) {
  const route = refundRouteFor(tx.tran_ref);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [portalDone, setPortalDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // One endpoint for both routes, because on the Shopify route the record and
  // the refund are the same event and splitting them is how they drift apart.
  // It is sent the route this panel believes it is on, so a stale page gets a
  // refusal instead of the wrong action.
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        "/api/admin/checkout-transactions/mark-refunded",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: tx.id,
            route,
            note,
            portalRefunded: route === "portal" ? portalDone : undefined,
          }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setOpen(false);
      onDone();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
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
    <div className="flex w-72 flex-col gap-2 rounded-lg border border-slate-100 bg-surface-soft p-3 text-left text-xs">
      {route === "portal" ? (
        <>
          <div className="rounded-md bg-amber-50 p-2.5 text-amber-900">
            <p className="font-semibold">
              Shopify คืนเงินออเดอร์นี้ให้ลูกค้าไม่ได้
            </p>
            <p className="mt-1 leading-relaxed">
              เงินเข้ามาทางหน้าชำระเงินของเว็บ (2C2P) — ใน Shopify เป็นแค่
              รายการที่เราบันทึกเอง กดคืนเงินใน Shopify ออเดอร์จะขึ้นว่า
              คืนแล้วแต่ลูกค้าไม่ได้เงิน
            </p>
            <p className="mt-2 leading-relaxed">
              ให้คืนใน 2C2P portal ด้วย tran ref{" "}
              {tx.tran_ref ? (
                <TranRefCopy tranRef={tx.tran_ref} />
              ) : (
                <span className="font-mono">
                  (ไม่มี — ค้นด้วย invoice {tx.invoice_no})
                </span>
              )}{" "}
              ยอด {formatTHB(tx.amount)}
            </p>
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-semibold underline"
            >
              เปิด 2C2P portal <ExternalLink size={11} />
            </a>
          </div>
          <label className="flex items-start gap-2 leading-relaxed text-slate-600">
            <input
              type="checkbox"
              checked={portalDone}
              onChange={(e) => setPortalDone(e.target.checked)}
              className="mt-0.5"
            />
            คืนเงินใน 2C2P portal เรียบร้อยแล้ว
          </label>
        </>
      ) : (
        <div className="rounded-md bg-rose-50 p-2.5 text-rose-900">
          <p className="font-semibold">คืนเงินจริงให้ลูกค้าทันที</p>
          <p className="mt-1 leading-relaxed">
            ออเดอร์นี้จ่ายผ่านหน้าชำระเงินของ Shopify เอง กดแล้ว Shopify
            จะคืนเงิน {formatTHB(tx.amount)} เต็มจำนวนให้ลูกค้าเลย
            (คืนบางส่วนต้องทำในหน้า Shopify)
          </p>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ถ้ามี)"
        className="w-full rounded-sm border border-slate-200 px-2 py-1"
      />
      {error && <p className="text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <Button variant="danger" size="sm"
          onPress={submit}
          isDisabled={busy || (route === "portal" && !portalDone)}
          
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {route === "portal"
            ? "บันทึกว่าคืนเงินแล้ว"
            : `คืนเงิน ${formatTHB(tx.amount)} ผ่าน Shopify`}
        </Button>
        <button onClick={() => setOpen(false)} className="text-slate-400">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

/** At a glance, before anyone opens the refund panel: which system can actually
 *  return this customer's money. */
function RouteBadge({ route }: { route: RefundRoute }) {
  return (
    <Badge tone={route === "portal" ? "warning" : "info"}>
      {REFUND_ROUTE_LABEL[route]}
    </Badge>
  );
}

/** The column holds two shapes — a GID from the checkout webhooks, a bare
 *  number from the Shopify one — so the table was printing two different
 *  kinds of thing under one heading. The number is the half a person can
 *  paste into Shopify's admin search, so that is what is shown. */
function orderNumber(id: string) {
  return id.startsWith("gid://") ? (id.split("/").pop() ?? id) : id;
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
    icon: (
      <RefreshCw
        size={15}
        className={loading ? "animate-spin" : ""}
        aria-hidden
      />
    ),
    onClick: load,
    disabled: loading,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<CreditCard size={20} className="text-brand-emerald" />}
        title="การชำระเงิน & คืนเงิน"
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
                    <td className={adminTable.mono}>
                      {tx.invoice_no}
                      {refundRouteFor(tx.tran_ref) === "portal" && tx.tran_ref && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] font-normal text-slate-400">
                          2C2P <TranRefCopy tranRef={tx.tran_ref} />
                        </span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      {tx.contact_email || "-"}
                      <br />
                      <span className="text-[12px] text-slate-400">
                        {tx.contact_phone}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {formatTHB(tx.amount)}
                    </td>
                    <td className={adminTable.cell}>
                      {tx.shopify_order_id ? (
                        <span className="font-mono text-[12px] text-slate-700">
                          {orderNumber(tx.shopify_order_id)}
                        </span>
                      ) : (
                        <span className="text-[12px] font-medium text-amber-600">
                          ยังไม่มีออเดอร์ (ตรวจด้วยตนเอง)
                        </span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      {tx.status === "refunded" ? (
                        <Badge tone="neutral">คืนเงินแล้ว</Badge>
                      ) : (
                        <Badge tone="brand">สำเร็จ</Badge>
                      )}
                      <span className="mt-1 block">
                        <RouteBadge route={refundRouteFor(tx.tran_ref)} />
                      </span>
                      {tx.refund_note && (
                        <p className="mt-1 max-w-[18rem] text-[11px] leading-relaxed text-slate-400">
                          {tx.refund_note}
                        </p>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {tx.status === "success" ? (
                          <RefundControls tx={tx} onDone={load} />
                        ) : null}
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
                    <p className="font-mono text-[12px] font-semibold text-brand-ink">
                      {tx.invoice_no}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {tx.contact_email || "-"}
                      {tx.contact_phone ? ` · ${tx.contact_phone}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-brand-ink">
                      {formatTHB(tx.amount)}
                    </p>
                    <span className="mt-1 flex flex-col items-end gap-1">
                      {tx.status === "refunded" ? (
                        <Badge tone="neutral">คืนเงินแล้ว</Badge>
                      ) : (
                        <Badge tone="brand">สำเร็จ</Badge>
                      )}
                      <RouteBadge route={refundRouteFor(tx.tran_ref)} />
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {tx.shopify_order_id ? (
                    <span className="font-mono">
                      Shopify: {orderNumber(tx.shopify_order_id)}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-600">
                      ยังไม่มีออเดอร์ (ตรวจด้วยตนเอง)
                    </span>
                  )}
                </p>
                {refundRouteFor(tx.tran_ref) === "portal" && tx.tran_ref && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    2C2P ref: <TranRefCopy tranRef={tx.tran_ref} />
                  </p>
                )}
                {tx.refund_note && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {tx.refund_note}
                  </p>
                )}
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
