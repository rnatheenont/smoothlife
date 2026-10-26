"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CreditCard,
  ExternalLink,
  Gift,
  Heart,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  Repeat,
  ScanFace,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Ticket,
  User,
  Zap,
} from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { Badge, Card, Modal } from "@/components/ui";
import {
  PageHeader,
  Panel,
  StatCard,
  adminCards,
  adminTable,
} from "@/components/admin/layout-kit";
import AdminField from "@/components/admin/AdminField";
import AddressFields, {
  emptyAddressForm,
  type AddressFormValue,
} from "@/components/account/AddressFields";
import SkinScanSummary, {
  type AdminSkinScan,
} from "@/components/admin/SkinScanSummary";
import { formatTHB } from "@/lib/format";

// One customer, everything about them, on five tabs.
//
// The order of the tabs is the order support asks in: who are you, what did
// you buy, what are you owed, what have you done, and — last, because it is
// about us rather than them — what have we changed on this account.
//
// Almost all of it is read-only. The parts that can be edited are the parts
// that only ever existed in a chat message: the name, the phone number, the
// two profile fields nobody fills in, and the address as the customer read it
// out. Everything else is a record of something that happened, and a support
// screen that can rewrite history is how the history stops being worth
// reading.

type Row = Record<string, string | number | boolean | null>;

type Detail = {
  user: {
    id: string;
    display_name: string | null;
    phone: string | null;
    gender: string | null;
    birthdate: string | null;
    avatar_url: string | null;
    referral_code: string | null;
    shopify_customer_id: string | null;
    created_at: string;
  };
  identities: {
    provider: string;
    provider_uid: string;
    verified_at: string | null;
    created_at: string;
  }[];
  addresses: AccountAddress[];
  storeLinks: { store: string; shopify_customer_id: string | null }[];
  points: { balance: number; ledger: Row[]; loyalty: Row | null } | null;
  payments: Row[] | null;
  receipts: Row[] | null;
  flashSale: Row[] | null;
  staff: { verifications: Row[]; entitlements: Row[]; orders: Row[] } | null;
  chat: { conversations: Row[]; escalations: Row[] } | null;
  reviews: { reviews: Row[]; questions: Row[] } | null;
  subscriptions: Row[];
  wishlist: Row[];
  checkins: { cycles: Row[]; days: Row[] };
  notifications: Row[];
  audit: Row[] | null;
  denied: string[];
};

type AccountAddress = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

type ShopifyOrders = {
  orders: ShopifyOrder[];
  visible: number;
  canReadAllOrders: boolean | null;
  /** The store's handle in admin.shopify.com, for linking an order number
   *  to the order. Null when it could not be worked out. */
  adminHandle: string | null;
};

type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  total: string;
  currency: string;
  fulfillmentStatus: string | null;
  trackingNumbers: string[];
  items: string[];
};

const PROVIDER_LABEL: Record<string, string> = {
  email: "อีเมล",
  line: "LINE",
  google: "Google",
  apple: "Apple",
  phone: "เบอร์โทร",
};

const STORE_NAME: Record<string, string> = {
  smoothlife: "Smooth Life",
  smoothe: "Smooth E",
  dentiste: "Dentiste",
};

const STORE_HANDLE: Record<string, string> = {
  smoothlife: "smoothlife-th",
  smoothe: "smooth-e",
  dentiste: "dentiste-th",
};

const GENDER_LABEL: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่นๆ",
};

/** Thai for the admin actions worth reading as a sentence — the same map the
 *  audit console keeps, trimmed to what lands on a customer. */
const AUDIT_LABEL: Record<string, string> = {
  "account.profile_edit": "แก้ข้อมูลลูกค้า",
  "account.address_edit": "แก้ที่อยู่ลูกค้า",
  "account.merge": "รวมบัญชีลูกค้า",
  "account.rename": "แก้ชื่อลูกค้า",
  "account.relink-shopify": "ผูกบัญชี Shopify ใหม่",
  "receipt.approve": "อนุมัติใบเสร็จ",
  "receipt.reject": "ตีกลับใบเสร็จ",
  "receipt.amounts": "แก้ยอดและคำนวณสิทธิ์ใหม่",
  "receipt.recalculate": "คำนวณสิทธิ์ใหม่",
};

const TABS = [
  ["profile", "ข้อมูลส่วนตัว"],
  ["orders", "ซื้อ & จ่ายเงิน"],
  ["points", "คะแนน & สิทธิ์"],
  ["activity", "กิจกรรม"],
  ["audit", "บันทึกแอดมิน"],
] as const;
type Tab = (typeof TABS)[number][0];

/** A permission name as the page says it, for the "ซ่อนไว้" note. */
const DENIED_LABEL: Record<string, string> = {
  points: "คะแนนสะสม",
  payments: "การชำระเงิน",
  receipts: "ใบเสร็จกิจกรรม",
  flashSale: "Flash Sale",
  staff: "ร้านพนักงาน",
  chat: "แชท",
  reviews: "รีวิว & คำถาม",
  audit: "บันทึกแอดมิน",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const shortId = (gid: string | null) =>
  gid ? gid.replace("gid://shopify/Customer/", "") : "";

const baht = (value: unknown) => formatTHB(Number(value) || 0);

/** A tone for a status word, so a row reads at a glance. Anything unknown
 *  stays neutral rather than guessing a colour for it. */
function statusTone(
  status: unknown,
): "success" | "warning" | "danger" | "neutral" {
  const s = String(status ?? "").toLowerCase();
  if (
    [
      "paid",
      "approved",
      "confirmed",
      "active",
      "success",
      "completed",
      "verified",
      "fulfilled",
    ].includes(s)
  )
    return "success";
  if (
    [
      "pending",
      "reserved",
      "waiting",
      "queued",
      "review",
      "open",
      "draft",
    ].includes(s)
  )
    return "warning";
  if (
    [
      "failed",
      "rejected",
      "expired",
      "cancelled",
      "canceled",
      "revoked",
      "refunded",
    ].includes(s)
  )
    return "danger";
  return "neutral";
}

/* ── small pieces, used by every tab ─────────────────────────────── */

/** Label-and-value pairs. A <dl>, because that is what this is. */
function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
          <dd className="mt-0.5 break-words text-[13px] font-medium text-brand-ink">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-xs text-slate-400">{children}</p>
  );
}

/** What a block looks like when this admin may not open it. Said out loud,
 *  because "no rows" and "not allowed to see the rows" lead to different
 *  things being told to the customer. */
function Denied({ what }: { what: string }) {
  return (
    <p className="flex items-center justify-center gap-1.5 px-3 py-6 text-center text-xs text-slate-400">
      <Lock size={12} aria-hidden /> ซ่อนไว้ — บัญชีแอดมินของคุณไม่มีสิทธิ์ดู
      {what}
    </p>
  );
}

type Col<T> = { head: string; cell: (row: T) => ReactNode; className?: string };

/**
 * The same rows as a table on a laptop and as cards on a phone.
 *
 * Ten tables on one screen is ten chances to write the responsive pair by
 * hand and get one of them wrong, so it is written once here. The card form
 * prints the first column on its own line and the rest as label-value pairs —
 * a table squeezed onto a phone is a column of single words.
 */
function DataList<T>({
  rows,
  cols,
  keyOf,
  empty,
}: {
  rows: T[];
  cols: Col<T>[];
  keyOf: (row: T, index: number) => string;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const [first, ...rest] = cols;
  return (
    <>
      <div className={clsx(adminCards.forTable, adminTable.scroll)}>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              {cols.map((c) => (
                <th key={c.head} className={c.className}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={keyOf(row, i)} className={adminTable.row}>
                {cols.map((c) => (
                  <td
                    key={c.head}
                    className={clsx(adminTable.cell, c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={adminCards.list}>
        {rows.map((row, i) => (
          <li key={keyOf(row, i)} className={adminCards.item}>
            <div className="text-[13px] font-semibold text-brand-ink">
              {first.cell(row)}
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
              {rest.map((c) => (
                <div key={c.head} className="flex items-center gap-1">
                  <dt className="text-slate-400">{c.head}</dt>
                  <dd className="text-slate-600">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── the screen ──────────────────────────────────────────────────── */

export default function CustomerDetail({ userId }: { userId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("profile");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/detail?userId=${userId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "โหลดข้อมูลลูกค้าไม่สำเร็จ");
        return;
      }
      setData(json);
      setError("");
    } catch {
      setError("โหลดข้อมูลลูกค้าไม่สำเร็จ กรุณาลองใหม่");
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    void load();
  }, [load]);

  // Shopify's side and the skin scans are each a call of their own, made
  // when the tab that shows them is opened rather than up front: one is an
  // external API and the other is a table almost nobody has a row in.
  const [orders, setOrders] = useState<ShopifyOrders | null>(null);
  // A ref rather than a "loading" flag: the only thing the guard has to
  // remember is that the request already went out, and remembering that in
  // state would re-render the page twice to say so. The tab shows a spinner
  // while `orders` is null, which is the same information.
  const ordersAsked = useRef(false);
  const shopifyId = data?.user.shopify_customer_id ?? null;
  useEffect(() => {
    if (tab !== "orders" || !shopifyId || ordersAsked.current) return;
    ordersAsked.current = true;
    const blank: ShopifyOrders = {
      orders: [],
      visible: 0,
      canReadAllOrders: null,
      adminHandle: null,
    };
    fetch(`/api/admin/customers/orders?id=${encodeURIComponent(shopifyId)}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.ok ? d : blank))
      .catch(() => setOrders(blank));
  }, [tab, shopifyId]);

  const [scans, setScans] = useState<AdminSkinScan[] | null>(null);
  useEffect(() => {
    if (tab !== "activity" || scans) return;
    fetch(`/api/admin/customers/skin-scans?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setScans(d.ok ? d.scans : []))
      .catch(() => setScans([]));
  }, [tab, scans, userId]);

  if (error && !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex items-start gap-2 rounded-xl2 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Spinner size="md" color="current" />
      </div>
    );
  }

  const u = data.user;
  const email =
    data.identities.find((i) => i.provider === "email")?.provider_uid ?? null;
  const loyalty = data.points?.loyalty ?? null;
  const denied = new Set(data.denied);

  return (
    <div className="space-y-5">
      <BackLink />

      <PageHeader
        icon={<User size={20} className="text-brand-emerald" />}
        title={u.display_name || "(ไม่มีชื่อ)"}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {email && <span>{email}</span>}
            {u.phone && <span>{u.phone}</span>}
            <span>สมัคร {fmtDate(u.created_at)}</span>
          </span>
        }
        actions={
          u.shopify_customer_id ? (
            <a
              href={`https://admin.shopify.com/store/${STORE_HANDLE.smoothlife}/customers/${shortId(u.shopify_customer_id)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink size={12} /> เปิดใน Shopify
            </a>
          ) : (
            <Badge tone="warning">ยังไม่ผูกกับ Shopify</Badge>
          )
        }
      />

      {saved && (
        <div className="flex items-start gap-2 rounded-xl2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Check size={14} className="mt-0.5 shrink-0" />
          {saved}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ยอดซื้อ 12 เดือน"
          value={denied.has("points") ? "—" : baht(loyalty?.rolling_12mo_spend)}
          hint={
            denied.has("points")
              ? "ต้องมีสิทธิ์ดูคะแนน"
              : `${Number(loyalty?.rolling_12mo_orders) || 0} ออเดอร์`
          }
        />
        <StatCard
          label="คะแนนคงเหลือ"
          value={
            denied.has("points")
              ? "—"
              : (data.points?.balance ?? 0).toLocaleString("th-TH")
          }
          unit={denied.has("points") ? undefined : "แต้ม"}
        />
        <StatCard
          label="ระดับสมาชิก"
          value={
            denied.has("points")
              ? "—"
              : (loyalty?.current_tier as string) || "—"
          }
          hint={
            loyalty?.last_reviewed_at
              ? `ทบทวน ${fmtDate(loyalty.last_reviewed_at as string)}`
              : undefined
          }
        />
        <StatCard
          label="ช่องทางล็อกอิน"
          value={data.identities.length}
          unit="ช่องทาง"
          hint={
            data.identities
              .map((i) => PROVIDER_LABEL[i.provider] || i.provider)
              .join(" · ") || undefined
          }
        />
      </div>

      {/* The tabs scroll rather than wrap: five wrapped pills push the first
          panel below the fold before a single line has been read. */}
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={clsx(
              "shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
              tab === key
                ? "bg-brand-ink text-white"
                : "border border-surface-line text-slate-600 hover:bg-surface-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <ProfileTab
          data={data}
          onSaved={(msg) => {
            setSaved(msg);
            void load();
          }}
        />
      )}
      {tab === "orders" && <OrdersTab data={data} orders={orders} />}
      {tab === "points" && <PointsTab data={data} />}
      {tab === "activity" && <ActivityTab data={data} scans={scans} />}
      {tab === "audit" && <AuditTab data={data} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/customers"
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-brand-ink"
    >
      <ArrowLeft size={13} /> กลับไปค้นหาลูกค้า
    </Link>
  );
}

/* ── tab 1: who they are, and the parts staff may correct ────────── */

function ProfileTab({
  data,
  onSaved,
}: {
  data: Detail;
  onSaved: (message: string) => void;
}) {
  const u = data.user;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.display_name || "");
  const [phone, setPhone] = useState(u.phone || "");
  const [gender, setGender] = useState(u.gender || "");
  const [birthdate, setBirthdate] = useState(u.birthdate || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Which address is open in the dialog: an existing row, or "new" for the
  // first one an account has ever had.
  const [address, setAddress] = useState<{
    id: string | null;
    value: AddressFormValue;
  } | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressErr, setAddressErr] = useState("");

  function openAddress(row: AccountAddress | null) {
    setAddressErr("");
    setAddress({
      id: row?.id ?? null,
      value: row
        ? {
            label: row.label || "บ้าน",
            recipient_name: row.recipient_name,
            phone: row.phone,
            address_line: row.address_line,
            subdistrict: row.subdistrict,
            district: row.district,
            province: row.province,
            postal_code: row.postal_code,
            country: row.country || "TH",
            is_default: row.is_default,
          }
        : {
            ...emptyAddressForm,
            recipient_name: u.display_name || "",
            phone: u.phone || "",
            is_default: true,
          },
    });
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("กรุณากรอกชื่อ");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/customers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          name: name.trim(),
          phone: phone.trim(),
          gender,
          birthdate,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setErr(json?.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setEditing(false);
      onSaved("บันทึกข้อมูลลูกค้าแล้ว");
    } catch {
      setErr("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  /** Correcting an existing address goes to ../addresses by id; the very
   *  first one an account has goes to ../profile, which is the route that
   *  creates it. */
  async function saveAddress() {
    if (!address) return;
    setAddressBusy(true);
    setAddressErr("");
    try {
      const res = address.id
        ? await fetch("/api/admin/customers/addresses", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: u.id,
              addressId: address.id,
              address: address.value,
            }),
          })
        : await fetch("/api/admin/customers/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            // The name goes along only when there is one: ../profile
            // rejects an empty name, and this account may be the kind that
            // has neither a name nor an address yet — which is exactly the
            // account somebody is here to fill in.
            body: JSON.stringify({
              userId: u.id,
              ...(u.display_name ? { name: u.display_name } : {}),
              address: address.value,
            }),
          });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setAddressErr(json?.error || "บันทึกที่อยู่ไม่สำเร็จ");
        return;
      }
      setAddress(null);
      onSaved("บันทึกที่อยู่แล้ว");
    } catch {
      setAddressErr("บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setAddressBusy(false);
    }
  }

  async function makeDefault(row: AccountAddress) {
    setAddressBusy(true);
    try {
      const res = await fetch("/api/admin/customers/addresses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          addressId: row.id,
          makeDefault: true,
        }),
      });
      const json = await res.json().catch(() => null);
      onSaved(
        json?.ok
          ? "ตั้งเป็นที่อยู่หลักแล้ว"
          : json?.error || "ตั้งที่อยู่หลักไม่สำเร็จ",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="ข้อมูลลูกค้า"
        icon={<User size={14} className="text-brand-emerald" />}
        padded
        toolbar={
          !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={11} /> แก้ไข
            </button>
          )
        }
      >
        {editing ? (
          <form onSubmit={saveProfile} className="space-y-3">
            <AdminField
              label="ชื่อ"
              value={name}
              onChange={setName}
              placeholder="เช่น สมหญิง ใจดี"
              isRequired
            />
            <AdminField
              label="เบอร์โทร"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={setPhone}
              placeholder="เช่น 0812345678"
              hint="เว้นว่างได้ — เบอร์ผิดแย่กว่าไม่มีเบอร์ เพราะเดี๋ยวมีคนโทรไปจริง"
            />
            <div>
              <label
                htmlFor="customer-gender"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                เพศ
              </label>
              <select
                id="customer-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-xl border border-surface-line bg-white px-3 py-2.5 pe-9 text-sm text-brand-ink"
              >
                <option value="">ไม่ระบุ</option>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
            <AdminField
              label="วันเกิด"
              type="date"
              value={birthdate}
              onChange={setBirthdate}
              hint="ลูกค้ากรอกเองได้ในหน้าบัญชี — กรอกให้เมื่อลูกค้าแจ้งมาทางแชท"
            />
            <p className="text-xs text-slate-500">
              ลูกค้าเห็นข้อมูลนี้ในหน้าบัญชีของตัวเอง ·
              การแก้ตรงนี้ไม่ส่งไปแก้ใบลูกค้าใน Shopify
            </p>
            {err && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {err}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" isPending={busy}>
                บันทึก
              </Button>
              <Button
                type="button"
                variant="secondary"
                onPress={() => setEditing(false)}
              >
                ยกเลิก
              </Button>
            </div>
          </form>
        ) : (
          <Facts
            items={[
              ["ชื่อ", u.display_name || "—"],
              ["เบอร์โทร", u.phone || "—"],
              [
                "เพศ",
                u.gender ? GENDER_LABEL[u.gender] || u.gender : "ไม่ระบุ",
              ],
              ["วันเกิด", u.birthdate ? fmtDate(u.birthdate) : "—"],
              ["สมัครเมื่อ", fmtWhen(u.created_at)],
              ["รหัสแนะนำเพื่อน", u.referral_code || "—"],
              [
                "รหัสบัญชี",
                <span key="id" className="font-mono text-[11px]">
                  {u.id}
                </span>,
              ],
            ]}
          />
        )}
      </Panel>

      <Panel
        title="ช่องทางล็อกอิน"
        icon={<ShieldCheck size={14} className="text-brand-emerald" />}
        padded
      >
        {data.identities.length === 0 ? (
          <Empty>บัญชีนี้ยังไม่มีช่องทางล็อกอิน</Empty>
        ) : (
          <ul className="space-y-2">
            {data.identities.map((i) => (
              <li
                key={i.provider + i.provider_uid}
                className="flex flex-wrap items-center gap-2"
              >
                <Badge tone="neutral">
                  {PROVIDER_LABEL[i.provider] || i.provider}
                </Badge>
                <span className="min-w-0 break-all text-[13px] text-brand-ink">
                  {i.provider_uid}
                </span>
                {i.verified_at ? (
                  <Badge tone="success">ยืนยันแล้ว</Badge>
                ) : (
                  <Badge tone="warning">ยังไม่ยืนยัน</Badge>
                )}
                <span className="text-[11px] text-slate-400">
                  เพิ่ม {fmtDate(i.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          ช่องทางล็อกอินแก้จากหน้านี้ไม่ได้ — ถ้าลูกค้ามีสองบัญชี
          ให้รวมบัญชีที่หน้าค้นหา
        </p>
      </Panel>

      <Panel
        title="ที่อยู่จัดส่ง"
        icon={<MapPin size={14} className="text-brand-emerald" />}
        padded
        toolbar={
          data.addresses.length === 0 && (
            <button
              type="button"
              onClick={() => openAddress(null)}
              className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={11} /> เพิ่มที่อยู่
            </button>
          )
        }
      >
        {data.addresses.length === 0 ? (
          <Empty>บัญชีนี้ยังไม่มีที่อยู่จัดส่ง</Empty>
        ) : (
          <ul className="space-y-3">
            {data.addresses.map((a) => (
              <li
                key={a.id}
                className="rounded-xl p-3 ring-1 ring-surface-line"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-brand-ink">
                    {a.recipient_name}
                  </span>
                  {a.is_default && <Badge tone="success">ที่อยู่หลัก</Badge>}
                  {a.label && <Badge tone="neutral">{a.label}</Badge>}
                  <button
                    type="button"
                    onClick={() => openAddress(a)}
                    className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-ink"
                  >
                    <Pencil size={11} /> แก้
                  </button>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  {[
                    a.address_line,
                    a.subdistrict,
                    a.district,
                    a.province,
                    a.postal_code,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{a.phone}</p>
                {!a.is_default && (
                  <button
                    type="button"
                    disabled={addressBusy}
                    onClick={() => void makeDefault(a)}
                    className="mt-2 text-[11px] font-semibold text-brand-800 hover:underline disabled:opacity-50"
                  >
                    ตั้งเป็นที่อยู่หลัก
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          เพิ่มที่อยู่ใหม่หรือลบที่อยู่ทำได้เฉพาะลูกค้าในหน้าบัญชีของตัวเอง —
          ที่นี่แก้ได้แต่ที่อยู่ที่มีอยู่แล้ว
        </p>
      </Panel>

      <Panel
        title="การผูกกับร้าน"
        icon={<Store size={14} className="text-brand-emerald" />}
        padded
      >
        <ul className="space-y-2 text-[13px]">
          <li className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{STORE_NAME.smoothlife}</Badge>
            {data.user.shopify_customer_id ? (
              <span className="font-mono text-[12px] text-brand-ink">
                #{shortId(data.user.shopify_customer_id)}
              </span>
            ) : (
              <span className="text-slate-400">ยังไม่ผูก</span>
            )}
          </li>
          {data.storeLinks.map((l) => (
            <li key={l.store} className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{STORE_NAME[l.store] || l.store}</Badge>
              <span className="font-mono text-[12px] text-brand-ink">
                #{shortId(l.shopify_customer_id)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">
          ผูกหรือปลดการผูกทำที่{" "}
          <Link
            href="/admin/customers"
            className="font-semibold text-brand-800 hover:underline"
          >
            หน้าค้นหาลูกค้า
          </Link>{" "}
          — ที่นั่นเทียบใบลูกค้าของทุกร้านให้ดูก่อนกด
        </p>
      </Panel>

      {address && (
        <Modal
          open
          onClose={() => setAddress(null)}
          size="md"
          title={address.id ? "แก้ที่อยู่จัดส่ง" : "เพิ่มที่อยู่จัดส่ง"}
          description={data.user.display_name || undefined}
        >
          <div className="space-y-3">
            <AddressFields
              value={address.value}
              onChange={(value) =>
                setAddress((prev) => (prev ? { ...prev, value } : prev))
              }
              showDefaultToggle={false}
            />
            {addressErr && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {addressErr}
              </p>
            )}
            <Button
              type="button"
              fullWidth
              isPending={addressBusy}
              onPress={() => void saveAddress()}
            >
              บันทึกที่อยู่
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── tab 2: what they bought and what they paid ──────────────────── */

function OrdersTab({
  data,
  orders,
}: {
  data: Detail;
  orders: ShopifyOrders | null;
}) {
  const denied = new Set(data.denied);
  return (
    <div className="space-y-4">
      <Panel
        title="คำสั่งซื้อใน Shopify"
        icon={<ShoppingBag size={14} className="text-brand-emerald" />}
      >
        {!data.user.shopify_customer_id ? (
          <Empty>
            บัญชีนี้ยังไม่ผูกกับใบลูกค้าใน Shopify จึงไม่มีประวัติให้ดู
          </Empty>
        ) : !orders ? (
          <p className="flex items-center justify-center gap-1.5 py-6 text-xs text-slate-500">
            <Spinner size="sm" color="current" className="size-3" />{" "}
            กำลังโหลดจาก Shopify…
          </p>
        ) : (
          <>
            {orders.canReadAllOrders === false && (
              <p className="mx-3 mt-3 rounded-l bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                แอปอ่านออเดอร์ได้แค่ 60 วันล่าสุด (ยังไม่ได้สิทธิ์
                read_all_orders) — ออเดอร์เก่ากว่านั้นมีอยู่จริงแต่ไม่ขึ้นที่นี่
              </p>
            )}
            <DataList
              rows={orders.orders}
              keyOf={(o) => o.name}
              empty="ไม่พบออเดอร์ในช่วงที่อ่านได้"
              cols={[
                {
                  head: "ออเดอร์",
                  className: "whitespace-nowrap",
                  // The number is what support is looking at; the order is
                  // what they need. Reading one and searching Shopify for the
                  // other by hand was the whole gap.
                  cell: (o) =>
                    orders.adminHandle ? (
                      <a
                        href={`https://admin.shopify.com/store/${orders.adminHandle}/orders/${o.id.split("/").pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`เปิด ${o.name} ใน Shopify`}
                        className="font-semibold underline decoration-slate-300 decoration-dotted underline-offset-2 hover:decoration-brand-800"
                      >
                        {o.name}
                      </a>
                    ) : (
                      <span className="font-semibold">{o.name}</span>
                    ),
                },
                {
                  head: "วันที่",
                  // "31 ส.ค. 69" was breaking across three lines and making
                  // every row three times as tall as it needed to be.
                  className: "whitespace-nowrap",
                  cell: (o) => fmtDate(o.createdAt),
                },
                {
                  head: "ยอด",
                  className: "text-right tabular-nums",
                  cell: (o) => baht(o.total),
                },
                {
                  head: "สถานะ",
                  cell: (o) => (
                    <Badge tone={statusTone(o.fulfillmentStatus)}>
                      {o.fulfillmentStatus || "—"}
                    </Badge>
                  ),
                },
                { head: "รายการ", cell: (o) => o.items.join(", ") || "—" },
                {
                  head: "เลขพัสดุ",
                  cell: (o) => o.trackingNumbers.join(", ") || "—",
                },
              ]}
            />
          </>
        )}
      </Panel>

      <Panel
        title="การชำระเงินบนเว็บ"
        icon={<CreditCard size={14} className="text-brand-emerald" />}
      >
        {denied.has("payments") ? (
          <Denied what={DENIED_LABEL.payments} />
        ) : (
          <DataList
            rows={data.payments ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่มีรายการชำระเงินบนเว็บ"
            cols={[
              {
                head: "เลขที่",
                cell: (r) => (
                  <span className="font-mono text-[12px]">
                    {String(r.invoice_no ?? "—")}
                  </span>
                ),
              },
              { head: "วันที่", cell: (r) => fmtWhen(r.created_at as string) },
              {
                head: "ยอด",
                className: "text-right tabular-nums",
                cell: (r) => baht(r.amount),
              },
              {
                head: "สถานะ",
                cell: (r) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone={statusTone(r.status)}>
                      {String(r.status ?? "—")}
                    </Badge>
                    {r.refunded_at && <Badge tone="danger">คืนเงินแล้ว</Badge>}
                  </span>
                ),
              },
              {
                head: "ออเดอร์",
                cell: (r) => String(r.shopify_order_id ?? "—"),
              },
              { head: "ธนาคารตอบ", cell: (r) => String(r.resp_desc ?? "—") },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="สมัครรับสินค้าประจำ"
        icon={<Repeat size={14} className="text-brand-emerald" />}
      >
        <DataList
          rows={data.subscriptions}
          keyOf={(r) => String(r.id)}
          empty="ยังไม่เคยสมัครรับสินค้าประจำ"
          cols={[
            {
              head: "สินค้า",
              cell: (r) => String(r.product_name ?? r.set_slug ?? "—"),
            },
            {
              head: "สถานะ",
              cell: (r) => (
                <Badge tone={statusTone(r.status)}>
                  {String(r.status ?? "—")}
                </Badge>
              ),
            },
            { head: "รอบ", cell: (r) => `${Number(r.plan_months) || 0} เดือน` },
            {
              head: "ยอดต่อรอบ",
              className: "text-right tabular-nums",
              cell: (r) => baht(r.amount_per_cycle),
            },
            {
              head: "ตัดรอบหน้า",
              cell: (r) => fmtDate(r.next_charge_date as string),
            },
            {
              head: "ส่งรอบหน้า",
              cell: (r) => fmtDate(r.next_shipment_date as string),
            },
          ]}
        />
      </Panel>

      <Panel
        title="Flash Sale"
        icon={<Zap size={14} className="text-brand-emerald" />}
      >
        {denied.has("flashSale") ? (
          <Denied what={DENIED_LABEL.flashSale} />
        ) : (
          <DataList
            rows={data.flashSale ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่เคยเข้าคิว Flash Sale"
            cols={[
              { head: "แคมเปญ", cell: (r) => String(r.campaignTitle ?? "—") },
              {
                head: "สถานะ",
                cell: (r) => (
                  <Badge tone={statusTone(r.status)}>
                    {String(r.status ?? "—")}
                  </Badge>
                ),
              },
              {
                head: "คิวที่",
                className: "tabular-nums",
                cell: (r) => String(r.position ?? "—"),
              },
              { head: "เข้าคิว", cell: (r) => fmtWhen(r.created_at as string) },
              { head: "จ่ายเมื่อ", cell: (r) => fmtWhen(r.paid_at as string) },
              {
                head: "ออเดอร์",
                cell: (r) => String(r.shopify_order_id ?? "—"),
              },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="ร้านพนักงาน"
        icon={<Ticket size={14} className="text-brand-emerald" />}
      >
        {denied.has("staff") ? (
          <Denied what={DENIED_LABEL.staff} />
        ) : (data.staff?.verifications.length ?? 0) === 0 &&
          (data.staff?.orders.length ?? 0) === 0 ? (
          <Empty>บัญชีนี้ไม่ได้ยืนยันเป็นพนักงาน</Empty>
        ) : (
          <>
            {(data.staff?.entitlements ?? []).map((e) => (
              <p
                key={String(e.round_id)}
                className="px-3 pt-3 text-[12px] text-slate-600"
              >
                วงเงินรอบนี้ {baht(e.cap_thb)} · ใช้ไป {baht(e.spent_thb)} ·
                จองไว้ {baht(e.reserved_thb)}
              </p>
            ))}
            <DataList
              rows={data.staff?.orders ?? []}
              keyOf={(r) => String(r.id)}
              empty="ยืนยันเป็นพนักงานแล้ว แต่ยังไม่เคยสั่งซื้อ"
              cols={[
                {
                  head: "วันที่",
                  cell: (r) => fmtWhen(r.created_at as string),
                },
                {
                  head: "สถานะ",
                  cell: (r) => (
                    <Badge tone={statusTone(r.status)}>
                      {String(r.status ?? "—")}
                    </Badge>
                  ),
                },
                {
                  head: "ยอด",
                  className: "text-right tabular-nums",
                  cell: (r) => baht(r.subtotal_thb),
                },
                {
                  head: "ออเดอร์",
                  cell: (r) => String(r.shopify_order_id ?? "—"),
                },
                {
                  head: "ต้องคืนเงิน",
                  cell: (r) =>
                    r.needs_refund ? <Badge tone="danger">ใช่</Badge> : "—",
                },
              ]}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

/* ── tab 3: what the shop owes them ──────────────────────────────── */

function PointsTab({ data }: { data: Detail }) {
  const denied = new Set(data.denied);
  const loyalty = data.points?.loyalty ?? null;
  return (
    <div className="space-y-4">
      <Panel
        title="คะแนนสะสม & ระดับสมาชิก"
        icon={<Star size={14} className="text-brand-emerald" />}
        padded
      >
        {denied.has("points") ? (
          <Denied what={DENIED_LABEL.points} />
        ) : (
          <Facts
            items={[
              [
                "คะแนนคงเหลือ",
                `${(data.points?.balance ?? 0).toLocaleString("th-TH")} แต้ม`,
              ],
              ["ระดับปัจจุบัน", (loyalty?.current_tier as string) || "—"],
              ["ยอดซื้อ 12 เดือน", baht(loyalty?.rolling_12mo_spend)],
              [
                "ออเดอร์ 12 เดือน",
                String(Number(loyalty?.rolling_12mo_orders) || 0),
              ],
              [
                "ผ่อนผันก่อนลดระดับถึง",
                fmtDate(loyalty?.tier_downgrade_grace_until as string),
              ],
              [
                "ทบทวนระดับล่าสุด",
                fmtWhen(loyalty?.last_reviewed_at as string),
              ],
            ]}
          />
        )}
      </Panel>

      <Panel
        title="ความเคลื่อนไหวของคะแนน"
        icon={<Star size={14} className="text-brand-emerald" />}
      >
        {denied.has("points") ? (
          <Denied what={DENIED_LABEL.points} />
        ) : (
          <DataList
            rows={data.points?.ledger ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่มีความเคลื่อนไหวของคะแนน"
            cols={[
              { head: "วันที่", cell: (r) => fmtWhen(r.created_at as string) },
              {
                head: "แต้ม",
                className: "text-right tabular-nums",
                cell: (r) => (
                  <span
                    className={
                      Number(r.delta) < 0 ? "text-rose-600" : "text-emerald-700"
                    }
                  >
                    {Number(r.delta) > 0 ? "+" : ""}
                    {Number(r.delta).toLocaleString("th-TH")}
                  </span>
                ),
              },
              { head: "เหตุผล", cell: (r) => String(r.reason ?? "—") },
              {
                head: "ออเดอร์",
                cell: (r) => String(r.shopify_order_id ?? "—"),
              },
              {
                head: "โค้ด",
                cell: (r) => String(r.shopify_discount_code ?? "—"),
              },
              { head: "หมดอายุ", cell: (r) => fmtDate(r.expires_at as string) },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="ใบเสร็จกิจกรรม"
        icon={<Gift size={14} className="text-brand-emerald" />}
      >
        {denied.has("receipts") ? (
          <Denied what={DENIED_LABEL.receipts} />
        ) : (
          <DataList
            rows={data.receipts ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่เคยส่งใบเสร็จเข้ากิจกรรม"
            cols={[
              { head: "กิจกรรม", cell: (r) => String(r.campaign_key ?? "—") },
              {
                head: "สถานะ",
                cell: (r) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone={statusTone(r.status)}>
                      {String(r.status ?? "—")}
                    </Badge>
                    {r.revoked_at && <Badge tone="danger">ยกเลิกสิทธิ์</Badge>}
                  </span>
                ),
              },
              {
                head: "สิทธิ์",
                className: "tabular-nums",
                cell: (r) =>
                  String(r.entries_override ?? r.computed_entries ?? 0),
              },
              {
                head: "ยอด DENTISTE'",
                className: "text-right tabular-nums",
                cell: (r) => baht(r.dentiste_net_amount),
              },
              {
                head: "เลขที่ใบเสร็จ",
                cell: (r) =>
                  String(r.manual_receipt_no ?? r.declared_order_number ?? "—"),
              },
              {
                head: "ส่งเมื่อ",
                cell: (r) => fmtWhen(r.created_at as string),
              },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="เช็คอินรายวัน"
        icon={<Check size={14} className="text-brand-emerald" />}
      >
        <DataList
          rows={data.checkins.cycles}
          keyOf={(r) => String(r.id)}
          empty="ยังไม่เคยเช็คอิน"
          cols={[
            { head: "เริ่มรอบ", cell: (r) => fmtDate(r.start_date as string) },
            {
              head: "สถานะ",
              cell: (r) => (
                <Badge tone={statusTone(r.status)}>
                  {String(r.status ?? "—")}
                </Badge>
              ),
            },
            {
              head: "เช็คอินแล้ว",
              className: "tabular-nums",
              cell: (r) => `${Number(r.completed_days) || 0} วัน`,
            },
            {
              head: "รางวัลวันที่ 3",
              cell: (r) => (r.day3_reward_claimed ? "รับแล้ว" : "—"),
            },
            {
              head: "รางวัลวันที่ 7",
              cell: (r) => (r.day7_reward_claimed ? "รับแล้ว" : "—"),
            },
          ]}
        />
        {data.checkins.days.length > 0 && (
          <p className="px-3 pb-3 text-[11px] text-slate-400">
            เช็คอินล่าสุด{" "}
            {fmtDate(data.checkins.days[0].checkin_date as string)} · รวม{" "}
            {data.checkins.days.length} ครั้งล่าสุด
          </p>
        )}
      </Panel>
    </div>
  );
}

/* ── tab 4: everything they have done ────────────────────────────── */

function ActivityTab({
  data,
  scans,
}: {
  data: Detail;
  scans: AdminSkinScan[] | null;
}) {
  const denied = new Set(data.denied);
  return (
    <div className="space-y-4">
      <Panel
        title="ผลสแกนผิว (Skin Coach)"
        icon={<ScanFace size={14} className="text-brand-emerald" />}
        padded
      >
        {scans === null ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Spinner size="sm" color="current" className="size-3" /> กำลังโหลด…
          </p>
        ) : (
          <SkinScanSummary scans={scans} />
        )}
      </Panel>

      <Panel
        title="รีวิวสินค้า"
        icon={<Star size={14} className="text-brand-emerald" />}
      >
        {denied.has("reviews") ? (
          <Denied what={DENIED_LABEL.reviews} />
        ) : (
          <DataList
            rows={data.reviews?.reviews ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่เคยรีวิวสินค้า"
            cols={[
              { head: "สินค้า", cell: (r) => String(r.product_slug ?? "—") },
              {
                head: "ดาว",
                className: "tabular-nums",
                cell: (r) => `${Number(r.rating) || 0}★`,
              },
              { head: "หัวข้อ", cell: (r) => String(r.title ?? "—") },
              {
                head: "สถานะ",
                cell: (r) => (
                  <Badge tone={statusTone(r.status)}>
                    {String(r.status ?? "—")}
                  </Badge>
                ),
              },
              {
                head: "แต้มที่ได้",
                className: "tabular-nums",
                cell: (r) => String(Number(r.points_awarded) || 0),
              },
              { head: "วันที่", cell: (r) => fmtDate(r.created_at as string) },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="คำถามเกี่ยวกับสินค้า"
        icon={<MessageSquare size={14} className="text-brand-emerald" />}
      >
        {denied.has("reviews") ? (
          <Denied what={DENIED_LABEL.reviews} />
        ) : (
          <DataList
            rows={data.reviews?.questions ?? []}
            keyOf={(r) => String(r.id)}
            empty="ยังไม่เคยถามคำถามสินค้า"
            cols={[
              { head: "สินค้า", cell: (r) => String(r.product_slug ?? "—") },
              { head: "คำถาม", cell: (r) => String(r.question ?? "—") },
              {
                head: "ตอบแล้ว",
                cell: (r) =>
                  r.answered_at
                    ? fmtDate(r.answered_at as string)
                    : "ยังไม่ตอบ",
              },
              { head: "วันที่", cell: (r) => fmtDate(r.created_at as string) },
            ]}
          />
        )}
      </Panel>

      <Panel
        title="แชทกับร้าน"
        icon={<MessageSquare size={14} className="text-brand-emerald" />}
      >
        {denied.has("chat") ? (
          <Denied what={DENIED_LABEL.chat} />
        ) : (
          <>
            <DataList
              rows={data.chat?.conversations ?? []}
              keyOf={(r) => String(r.id)}
              empty="ยังไม่มีบทสนทนาในกล่องข้อความ"
              cols={[
                { head: "ช่องทาง", cell: (r) => String(r.channel ?? "—") },
                { head: "เรื่อง", cell: (r) => String(r.subject ?? "—") },
                {
                  head: "สถานะ",
                  cell: (r) => (
                    <Badge tone={statusTone(r.status)}>
                      {String(r.status ?? "—")}
                    </Badge>
                  ),
                },
                { head: "ความเร่งด่วน", cell: (r) => String(r.urgency ?? "—") },
                {
                  head: "ข้อความล่าสุด",
                  cell: (r) => fmtWhen(r.last_message_at as string),
                },
              ]}
            />
            {(data.chat?.escalations.length ?? 0) > 0 && (
              <p className="px-3 pb-3 pt-1 text-[11px] text-slate-500">
                เคยขอให้คนตอบ {data.chat?.escalations.length} ครั้ง · ล่าสุด{" "}
                {fmtWhen(data.chat?.escalations[0].created_at as string)}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        title="รายการที่อยากได้"
        icon={<Heart size={14} className="text-brand-emerald" />}
        padded
      >
        {data.wishlist.length === 0 ? (
          <Empty>ยังไม่มีสินค้าในรายการที่อยากได้</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.wishlist.map((w) => (
              <Badge key={String(w.product_slug)} tone="neutral">
                {String(w.product_slug)}
              </Badge>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="การแจ้งเตือนล่าสุด"
        icon={<Bell size={14} className="text-brand-emerald" />}
      >
        <DataList
          rows={data.notifications}
          keyOf={(r) => String(r.id)}
          empty="ยังไม่เคยส่งการแจ้งเตือนให้บัญชีนี้"
          cols={[
            { head: "เรื่อง", cell: (r) => String(r.title ?? "—") },
            { head: "ประเภท", cell: (r) => String(r.type ?? "—") },
            {
              head: "อ่านแล้ว",
              cell: (r) =>
                r.read_at ? fmtWhen(r.read_at as string) : "ยังไม่อ่าน",
            },
            { head: "ส่งเมื่อ", cell: (r) => fmtWhen(r.created_at as string) },
          ]}
        />
      </Panel>
    </div>
  );
}

/* ── tab 5: what we have changed on this account ─────────────────── */

function AuditTab({ data }: { data: Detail }) {
  if (data.audit === null)
    return (
      <Panel title="บันทึกแอดมิน">
        <Denied what={DENIED_LABEL.audit} />
      </Panel>
    );
  return (
    <Panel
      title="บันทึกแอดมิน"
      icon={<ShieldCheck size={14} className="text-brand-emerald" />}
    >
      <p className="px-3 pt-3 text-[11px] text-slate-500">
        ทุกครั้งที่แอดมินแก้อะไรในบัญชีนี้ จะถูกบันทึกไว้ที่นี่ —
        ค่าก่อนแก้อยู่ในคอลัมน์รายละเอียด
      </p>
      <DataList
        rows={data.audit}
        keyOf={(r) => String(r.id)}
        empty="ยังไม่มีแอดมินคนไหนแก้บัญชีนี้"
        cols={[
          { head: "เมื่อ", cell: (r) => fmtWhen(r.created_at as string) },
          {
            head: "ทำอะไร",
            cell: (r) => AUDIT_LABEL[String(r.action)] || String(r.action),
          },
          { head: "ใคร", cell: (r) => String(r.actor ?? "—") },
          {
            head: "รายละเอียด",
            cell: (r) => (
              <span className="block max-w-md break-words font-mono text-[11px] text-slate-500">
                {r.detail ? JSON.stringify(r.detail) : "—"}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}
