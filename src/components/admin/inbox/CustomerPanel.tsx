"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Flag,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Package,
  Eye,
  Link2,
} from "lucide-react";
import SkinScanSummary, {
  type AdminSkinScan,
} from "@/components/admin/SkinScanSummary";
import { Button, Spinner } from "@heroui/react";

// The third column of the inbox.
//
// It used to be one flat scroll: name, tier, points, subscriptions, skin
// scans, in that order and all at once. On a customer with a couple of
// subscriptions and four scans, the thing staff were most likely to want —
// "what has this person actually bought" — was not in it at all, and what was
// there needed scrolling past to reach the rest.
//
// Three tabs now, and the header above them never moves, so switching tabs
// never costs sight of who you are talking to.

export type Customer = {
  name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  spend12mo: number | null;
  points: number | null;
  shopifyCustomerId?: string | null;
  subscriptions: {
    id: string;
    product_name: string;
    status: string;
    plan_months: number;
    next_charge_date: string | null;
  }[];
  skinScans?: AdminSkinScan[];
};

export type ProductCard = {
  name: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  inStock?: boolean;
};

export type Insight = {
  topic: string | null;
  need: string | null;
  mood: string | null;
  confidence: string | null;
  suggestUrgent: boolean;
  reason: string | null;
  staffVerdict: string | null;
  analyzedAt: string;
};

type OrderItem = {
  title: string;
  quantity: number;
  slug: string | null;
  imageUrl: string | null;
};
type Order = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  total: string;
  currency: string;
  items: OrderItem[];
  adminUrl?: string;
};

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

const MOOD: Record<
  string,
  { label: string; emoji: string; className: string }
> = {
  happy: {
    label: "พอใจ",
    emoji: "🙂",
    className: "bg-emerald-50 text-emerald-700",
  },
  neutral: {
    label: "ปกติ",
    emoji: "😐",
    className: "bg-slate-100 text-slate-600",
  },
  confused: {
    label: "สับสน",
    emoji: "😕",
    className: "bg-amber-50 text-amber-700",
  },
  annoyed: {
    label: "หงุดหงิด",
    emoji: "😒",
    className: "bg-orange-50 text-orange-700",
  },
  angry: {
    label: "ไม่พอใจ",
    emoji: "😠",
    className: "bg-rose-50 text-rose-700",
  },
};

const CONFIDENCE: Record<string, string> = {
  low: "ต่ำ",
  medium: "กลาง",
  high: "สูง",
};

/** Shopify's own words for where an order stands, in the words staff use. */
const ORDER_STATUS: Record<string, string> = {
  PAID: "ชำระแล้ว",
  PENDING: "รอชำระ",
  REFUNDED: "คืนเงินแล้ว",
  PARTIALLY_REFUNDED: "คืนเงินบางส่วน",
  VOIDED: "ยกเลิกการชำระ",
  AUTHORIZED: "กันวงเงินไว้",
};
const FULFILMENT: Record<string, string> = {
  FULFILLED: "จัดส่งแล้ว",
  UNFULFILLED: "ยังไม่จัดส่ง",
  PARTIALLY_FULFILLED: "จัดส่งบางส่วน",
  IN_PROGRESS: "กำลังจัดส่ง",
};

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

type Tab = "profile" | "orders" | "products";

export default function CustomerPanel({
  conversationId,
  customer,
  insight,
  products,
  discussedSlugs,
  viewedSlugs,
  urgency,
  onInsight,
  onFlagUrgent,
  onInsertProduct,
}: {
  conversationId: string;
  customer: Customer | null;
  insight: Insight | null;
  products: Record<string, ProductCard>;
  discussedSlugs: string[];
  viewedSlugs: string[];
  urgency: "normal" | "urgent";
  onInsight: (insight: Insight) => void;
  onFlagUrgent: () => Promise<void>;
  onInsertProduct: (slug: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<string | null>(
    insight?.staffVerdict ?? null,
  );
  const [flagging, setFlagging] = useState(false);

  // Orders are a Shopify round trip, so they are fetched when the tab is
  // opened and not before — most threads are answered without anybody asking
  // what the customer bought.
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersReason, setOrdersReason] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // A different conversation is a different everything.
  useEffect(() => {
    setTab("profile");
    setOrders(null);
    setOrdersReason(null);
    setError("");
  }, [conversationId]);

  useEffect(() => {
    setVerdict(insight?.staffVerdict ?? null);
  }, [insight]);

  useEffect(() => {
    if (tab !== "orders" || orders !== null || loadingOrders) return;
    setLoadingOrders(true);
    fetch(`/api/admin/inbox/${conversationId}/orders`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.ok ? (d.orders ?? []) : []);
        setOrdersReason(
          d.ok ? (d.reason ?? null) : (d.error ?? "อ่านคำสั่งซื้อไม่สำเร็จ"),
        );
      })
      .catch(() => {
        setOrders([]);
        setOrdersReason("อ่านคำสั่งซื้อไม่สำเร็จ");
      })
      .finally(() => setLoadingOrders(false));
  }, [tab, orders, loadingOrders, conversationId]);

  async function analyze() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${conversationId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "วิเคราะห์ไม่สำเร็จ");
        return;
      }
      onInsight(data.insight);
      setVerdict(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function sendVerdict(value: "agree" | "disagree") {
    setVerdict(value);
    await fetch(`/api/admin/inbox/${conversationId}/analyze`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: value }),
    }).catch(() => {});
  }

  async function flag() {
    setFlagging(true);
    try {
      await onFlagUrgent();
      // Raising the flag is the moment somebody should hear about it, not the
      // next five-minute tick. Same endpoint the schedule calls, so there is
      // one alerter and one record of what was sent — it is the signed-in
      // admin asking it to look now rather than the database asking later.
      await fetch("/api/cron/inbox-alert").catch(() => {});
    } finally {
      setFlagging(false);
    }
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "profile", label: "โปรไฟล์" },
    { id: "orders", label: "คำสั่งซื้อ", count: orders?.length },
    {
      id: "products",
      label: "สินค้า",
      count: discussedSlugs.length + viewedSlugs.length,
    },
  ];

  return (
    <div className="flex min-h-0 flex-col gap-3 text-xs">
      {/* Always visible, whichever tab is open: switching to the order list
          should not cost sight of whose order list it is. */}
      <div>
        <p className="font-semibold text-brand-ink">
          {customer?.name || "ไม่ระบุชื่อ"}
        </p>
        {customer?.email && <p className="text-slate-500">{customer.email}</p>}
        {customer?.phone && <p className="text-slate-500">{customer.phone}</p>}
        {!customer && <p className="text-slate-400">ยังไม่ได้ผูกบัญชี</p>}
      </div>

      <div
        role="tablist"
        className="flex shrink-0 gap-1 rounded-lg bg-surface-muted p-1 text-[11px] font-semibold"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex-1 rounded-md px-2 py-1.5 transition-colors",
              tab === t.id
                ? "bg-white text-brand-ink shadow-card"
                : "text-slate-500 hover:text-brand-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-1 text-[10px] font-normal text-slate-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="flex flex-col gap-3">
          {/* The reading, or the offer to take one. Never automatic: each press
              costs money, and a judgement about how a customer sounds is not
              something to make a thousand times a day unasked. */}
          <div className="rounded-lg border border-slate-100 bg-surface-soft p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 font-semibold text-brand-ink">
                <Sparkles
                  size={13}
                  className="text-brand-emerald"
                  aria-hidden="true"
                />{" "}
                สรุปจากบอท
              </p>
              {insight && (
                <span className="text-[10px] text-slate-400">
                  {thaiDate(insight.analyzedAt)}
                </span>
              )}
            </div>

            {!insight ? (
              <div className="mt-2">
                <p className="mb-2 text-slate-500">
                  ยังไม่เคยวิเคราะห์บทสนทนานี้
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={analyze}
                  isPending={analyzing}
                >
                  {analyzing ? (
                    <Spinner size="sm" color="current" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  วิเคราะห์เลย
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-slate-600">
                  <span className="text-slate-400">กำลังคุยเรื่อง: </span>
                  {insight.topic || "—"}
                </p>
                {insight.need && (
                  <p className="text-slate-600">
                    <span className="text-slate-400">ต้องการ: </span>
                    {insight.need}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                      MOOD[insight.mood ?? "neutral"]?.className ??
                        MOOD.neutral.className,
                    )}
                  >
                    {MOOD[insight.mood ?? "neutral"]?.emoji}{" "}
                    {MOOD[insight.mood ?? "neutral"]?.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ความมั่นใจ {CONFIDENCE[insight.confidence ?? "low"] ?? "—"}
                  </span>
                </p>
                {insight.reason && (
                  <p className="text-[11px] text-slate-400">{insight.reason}</p>
                )}

                {insight.suggestUrgent && urgency !== "urgent" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={flag}
                    isPending={flagging}
                    className="mt-1 self-start"
                  >
                    {flagging ? (
                      <Spinner size="sm" color="current" />
                    ) : (
                      <Flag size={13} />
                    )}
                    ขึ้นธงด่วน
                  </Button>
                )}
                {urgency === "urgent" && (
                  <p className="mt-1 inline-flex items-center gap-1 self-start rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">
                    <Flag size={11} /> ขึ้นธงด่วนแล้ว
                  </p>
                )}

                {/* Whether the reading was right, from the person who can tell.
                    Kept so "how often is it wrong" is answerable later. */}
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
                  <span className="text-[10px] text-slate-400">
                    สรุปตรงไหม?
                  </span>
                  <button
                    onClick={() => sendVerdict("agree")}
                    aria-pressed={verdict === "agree"}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                      verdict === "agree"
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-400 hover:text-brand-ink",
                    )}
                  >
                    <ThumbsUp size={11} /> ตรง
                  </button>
                  <button
                    onClick={() => sendVerdict("disagree")}
                    aria-pressed={verdict === "disagree"}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                      verdict === "disagree"
                        ? "bg-rose-50 text-rose-700"
                        : "text-slate-400 hover:text-brand-ink",
                    )}
                  >
                    <ThumbsDown size={11} /> ไม่ตรง
                  </button>
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="ml-auto text-[10px] text-slate-400 underline hover:text-brand-ink"
                  >
                    {analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์ใหม่"}
                  </button>
                </div>
              </div>
            )}
            {error && <p className="mt-1.5 text-rose-600">{error}</p>}
          </div>

          {customer ? (
            <>
              <div className="rounded-lg bg-surface-soft p-2.5">
                <p className="text-slate-500">
                  ระดับ{" "}
                  <span className="font-semibold text-brand-ink">
                    {customer.tier || "—"}
                  </span>
                </p>
                <p className="text-slate-500">
                  แต้มคงเหลือ{" "}
                  <span className="font-semibold text-brand-ink">
                    {customer.points ?? "—"}
                  </span>
                </p>
                {customer.spend12mo !== null && (
                  <p className="text-slate-500">
                    ยอดซื้อ 12 เดือน {baht(customer.spend12mo)}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 font-semibold text-slate-500">
                  สมาชิกรายเดือน
                </p>
                {customer.subscriptions.length === 0 ? (
                  <p className="text-slate-400">—</p>
                ) : (
                  customer.subscriptions.map((s) => (
                    <p key={s.id} className="text-slate-500">
                      {s.product_name} · {s.status}
                      {s.next_charge_date &&
                        ` · ตัดถัดไป ${new Date(s.next_charge_date).toLocaleDateString("th-TH")}`}
                    </p>
                  ))
                )}
              </div>
              <div>
                <p className="mb-1 font-semibold text-slate-500">ผลสแกนผิว</p>
                <SkinScanSummary scans={customer.skinScans ?? []} compact />
              </div>
            </>
          ) : (
            <p className="text-slate-400">
              ยังไม่รู้ว่าเป็นลูกค้าคนไหน (ยังไม่ได้ผูกบัญชี)
            </p>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {loadingOrders ? (
            <p className="inline-flex items-center gap-1.5 text-slate-400">
              <Spinner size="sm" color="current" /> กำลังอ่านคำสั่งซื้อ…
            </p>
          ) : orders && orders.length > 0 ? (
            <>
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-slate-100 bg-white p-2.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    {o.adminUrl ? (
                      <a
                        href={o.adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-brand-800 hover:underline"
                      >
                        {o.name}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-mono text-[12px] font-semibold text-brand-ink">
                        {o.name}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {thaiDate(o.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                    {o.cancelledAt ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        ยกเลิกแล้ว
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          {ORDER_STATUS[o.financialStatus ?? ""] ??
                            o.financialStatus ??
                            "—"}
                        </span>
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                          {FULFILMENT[o.fulfillmentStatus ?? ""] ??
                            o.fulfillmentStatus ??
                            "—"}
                        </span>
                      </>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {o.items.slice(0, 3).map((it, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.imageUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 shrink-0 rounded-md bg-surface-soft object-cover"
                          />
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-soft">
                            <Package
                              size={13}
                              className="text-slate-300"
                              aria-hidden="true"
                            />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {it.title}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          ×{it.quantity}
                        </span>
                      </div>
                    ))}
                    {o.items.length > 3 && (
                      <p className="text-[10px] text-slate-400">
                        และอีก {o.items.length - 3} รายการ
                      </p>
                    )}
                  </div>
                  <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-right font-semibold text-brand-ink">
                    {baht(Number(o.total))}
                  </p>
                </div>
              ))}
              <a
                href="/admin/customers"
                className="inline-flex items-center gap-1 self-start text-[11px] text-brand-800 underline"
              >
                ดูประวัติทั้งหมด <ExternalLink size={11} />
              </a>
            </>
          ) : (
            <p className="text-slate-400">
              {ordersReason === "no_account"
                ? "ยังไม่ได้ผูกบัญชี จึงยังดูคำสั่งซื้อไม่ได้"
                : ordersReason === "shopify_not_configured"
                  ? "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Shopify"
                  : ordersReason === "no_shopify_customer"
                    ? "ไม่พบลูกค้ารายนี้ใน Shopify (ค้นจากอีเมลและเบอร์แล้ว)"
                    : (ordersReason ?? "ยังไม่พบคำสั่งซื้อ")}
            </p>
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="flex flex-col gap-3">
          <ProductGroup
            title="กำลังคุยถึง"
            icon={<Package size={12} aria-hidden="true" />}
            slugs={discussedSlugs}
            products={products}
            onInsert={onInsertProduct}
            empty="ยังไม่มีสินค้าที่พูดถึงในแชทนี้"
          />
          {viewedSlugs.length > 0 && (
            <ProductGroup
              title="เปิดดูในเว็บตอนที่แชท"
              icon={<Eye size={12} aria-hidden="true" />}
              slugs={viewedSlugs}
              products={products}
              onInsert={onInsertProduct}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ProductGroup({
  title,
  icon,
  slugs,
  products,
  onInsert,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  slugs: string[];
  products: Record<string, ProductCard>;
  onInsert: (slug: string) => void;
  empty?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1.5 font-semibold text-slate-500">
        {icon} {title}
      </p>
      {slugs.length === 0 ? (
        <p className="text-slate-400">{empty ?? "—"}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {slugs.map((slug) => {
            const card = products[slug];
            if (!card) return null;
            return (
              <div
                key={slug}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg bg-surface-soft object-cover"
                />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/product/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 block text-[11px] font-semibold leading-snug text-brand-ink hover:text-brand-800"
                  >
                    {card.name}
                  </a>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-brand-800">
                      {baht(card.price)}
                    </span>
                    {card.inStock === false && (
                      <span className="rounded-full bg-rose-50 px-1.5 text-[10px] text-rose-600">
                        หมด
                      </span>
                    )}
                  </p>
                </div>
                {/* Saves staff typing [[slug]] from memory, which is how the
                    wrong product ends up in a reply. */}
                <button
                  onClick={() => onInsert(slug)}
                  title="แทรกการ์ดสินค้านี้ในคำตอบ"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-surface-soft hover:text-brand-800"
                >
                  <Link2 size={14} aria-hidden="true" />
                  <span className="sr-only">แทรกสินค้านี้ในคำตอบ</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
