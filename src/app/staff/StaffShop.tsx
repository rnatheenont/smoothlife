"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Mail,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Button } from "@heroui/react";
import { categories } from "@/data/categories";
import type { StaffShopVariant } from "@/lib/staff-sale";

// The employee shop, all of its states.
//
// Separate from the ordinary cart on purpose — not a flag on it. A staff
// cart is priced from the round, capped per person, limited per product and
// paid for through its own checkout, and every one of those is a rule the
// shop's own cart has no idea about. Sharing the cart would mean teaching it
// four rules it would get wrong once.

type RoundInfo = {
  id?: string;
  name: string;
  ends_at: string;
  cap_thb?: number;
  payment_window_min?: number;
};

type Standing = {
  staff_email: string;
  cap_thb: number;
  reserved_thb: number;
  spent_thb: number;
  left_thb: number;
};

type PendingOrder = {
  id: string;
  subtotal_thb: number;
  expires_at: string;
  lines: { variant_id: string; product_slug: string; qty: number; staff_price: number }[];
};

type State =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "closed"; nextRound: { name: string; starts_at: string } | null }
  | { state: "signin"; round: RoundInfo }
  | { state: "verify"; round: RoundInfo }
  | {
      state: "shop";
      round: RoundInfo;
      standing: Standing;
      items: StaffShopVariant[];
      pending: PendingOrder | null;
      shipTo: { summary: string; hasPhone: boolean } | null;
    };

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const CATEGORY_TH = new Map(categories.map((c) => [c.slug as string, c.nameTh]));

function remaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "หมดเวลาแล้ว";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `เหลือ ${mins} นาที`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `เหลือ ${hours} ชม. ${mins % 60} นาที`;
  return `เหลือ ${Math.floor(hours / 24)} วัน`;
}

export default function StaffShop() {
  const [data, setData] = useState<State>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [justPaid, setJustPaid] = useState(false);

  // Read straight off the URL rather than through useSearchParams: that hook
  // puts the whole page behind a Suspense boundary, for one boolean that
  // only matters on the first paint after 2C2P sends the browser back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("paid") === "1") {
      setJustPaid(true);
      // Taken out of the address so a reload does not claim a second
      // payment, and so the banner does not survive into the next visit.
      window.history.replaceState(null, "", "/staff");
    }
  }, []);

  // One interval for every countdown on the page. A timer per card is a
  // timer per card to clean up.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/round", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดหน้าร้านไม่สำเร็จ");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดหน้าร้านไม่สำเร็จ");
      setData({ state: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shop = data.state === "shop" ? data : null;

  const subtotal = useMemo(() => {
    if (!shop) return 0;
    return Object.entries(cart).reduce((sum, [variantId, qty]) => {
      const item = shop.items.find((i) => i.variant_id === variantId);
      return sum + (item ? item.staff_price * qty : 0);
    }, 0);
  }, [cart, shop]);

  const grouped = useMemo(() => {
    if (!shop) return [];
    const byCategory = new Map<string, StaffShopVariant[]>();
    for (const item of shop.items) {
      const key = item.category || "other";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    }
    return [...byCategory.entries()].map(([key, items]) => ({
      key,
      label: CATEGORY_TH.get(key) ?? "อื่นๆ",
      items: items.sort((a, b) => a.name.localeCompare(b.name, "th")),
    }));
  }, [shop]);

  function setQty(item: StaffShopVariant, qty: number) {
    // Clamped against both ceilings here as well as in the database, so the
    // plus button stops rather than the checkout refusing after the fact.
    const ceilings = [
      item.per_person_limit === null ? Infinity : item.per_person_limit - item.mine,
      item.left === null ? Infinity : item.left,
    ];
    const max = Math.max(0, Math.min(...ceilings));
    const next = Math.max(0, Math.min(qty, max));
    setCart((cur) => {
      const copy = { ...cur };
      if (next === 0) delete copy[item.variant_id];
      else copy[item.variant_id] = next;
      return copy;
    });
  }

  async function checkout() {
    if (!shop) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: Object.entries(cart).map(([variant_id, qty]) => ({ variant_id, qty })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "เริ่มการชำระเงินไม่สำเร็จ");
      // 2C2P's own page. Replaced rather than opened so the back button
      // comes back here instead of to a spent payment page.
      window.location.href = json.webPaymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่มการชำระเงินไม่สำเร็จ");
      setBusy(false);
      void load();
    }
  }

  async function cancelPending(id: string) {
    if (!confirm("ยกเลิกคำสั่งซื้อที่รอชำระเงิน? วงเงินและสินค้าจะถูกคืนให้")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ยกเลิกไม่สำเร็จ");
      setCart({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-ink md:text-3xl">
          <ShoppingBag className="h-6 w-6 text-brand-700" aria-hidden />
          ร้านพนักงาน
        </h1>
        {data.state === "shop" && (
          <p className="mt-1 text-[13px] text-slate-500">
            {data.round.name} · {remaining(data.round.ends_at)}
          </p>
        )}
      </header>

      {justPaid && (
        <div className="mb-5 rounded-xl2 bg-emerald-50 p-4 text-[13px] text-emerald-800">
          <p className="font-semibold">ได้รับการชำระเงินแล้ว กำลังยืนยันกับธนาคาร</p>
          <p className="mt-1">
            ใบเสร็จจะส่งไปที่อีเมลของคุณ และคำสั่งซื้อจะขึ้นในหน้าโปรไฟล์ภายในไม่กี่นาที
            ถ้ายังไม่ขึ้น ลองรีเฟรชอีกครั้ง
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl2 bg-rose-50 p-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {data.state === "loading" && <p className="text-[13px] text-slate-400">กำลังโหลด…</p>}

      {data.state === "unavailable" && (
        <div className="rounded-xl2 bg-surface-soft p-6">
          <p className="text-[14px] text-slate-600">
            ร้านพนักงานยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้งภายหลัง
          </p>
        </div>
      )}

      {data.state === "closed" && (
        <div className="rounded-xl2 bg-surface-soft p-6">
          <p className="text-[15px] font-semibold text-brand-ink">ยังไม่มีรอบการซื้อที่เปิดอยู่</p>
          <p className="mt-1 text-[13px] text-slate-600">
            {data.nextRound
              ? `รอบถัดไป "${data.nextRound.name}" เริ่ม ${new Date(data.nextRound.starts_at).toLocaleString("th-TH", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
              : "ฝ่ายบุคคลจะแจ้งเมื่อเปิดรอบถัดไป"}
          </p>
        </div>
      )}

      {data.state === "signin" && (
        <div className="rounded-xl2 bg-surface-soft p-6">
          <p className="text-[15px] font-semibold text-brand-ink">{data.round.name}</p>
          <p className="mt-1 text-[13px] text-slate-600">
            เข้าสู่ระบบด้วยบัญชี Smoothlife ของคุณก่อน แล้วยืนยันอีเมลบริษัทเพื่อดูราคาพนักงาน
          </p>
          <Link
            href="/account/login?returnTo=%2Fstaff"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-brand-800 px-6 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {data.state === "verify" && <VerifyPanel round={data.round} onVerified={load} />}

      {shop && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {shop.pending && (
              <div className="mb-5 rounded-xl2 bg-amber-50 p-4">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-amber-900">
                  <Clock className="h-4 w-4" aria-hidden />
                  มีคำสั่งซื้อรอชำระเงิน · {remaining(shop.pending.expires_at)}
                </p>
                <p className="mt-1 text-[13px] text-amber-800">
                  {shop.pending.lines.length} รายการ รวม {baht(shop.pending.subtotal_thb)} บาท —
                  ชำระให้เสร็จก่อนจึงจะสั่งรายการใหม่ได้
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => cancelPending(shop.pending!.id)}
                    isDisabled={busy}
                  >
                    ยกเลิกคำสั่งซื้อนี้
                  </Button>
                </div>
              </div>
            )}

            {shop.items.length === 0 && (
              <p className="rounded-xl2 bg-surface-soft p-6 text-[13px] text-slate-500">
                รอบนี้ยังไม่มีสินค้าให้เลือก
              </p>
            )}

            {/* Grouped by category, which is what the plan asks for and what
                a list of eighty products needs to be readable at all. */}
            {grouped.map((group) => (
              <section key={group.key} className="mb-7">
                <h2 className="mb-3 text-[15px] font-bold text-brand-ink">{group.label}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const qty = cart[item.variant_id] ?? 0;
                    const soldOut = item.left === 0;
                    const atLimit =
                      item.per_person_limit !== null && item.mine + qty >= item.per_person_limit;
                    const off =
                      item.regular_price > 0
                        ? Math.round((1 - item.staff_price / item.regular_price) * 100)
                        : 0;
                    return (
                      <article
                        key={item.variant_id}
                        className="flex gap-3 rounded-xl2 bg-surface-soft p-3"
                      >
                        {item.image && (
                          <Image
                            src={item.image}
                            alt=""
                            width={72}
                            height={72}
                            className="h-[72px] w-[72px] shrink-0 rounded-xl bg-white object-contain"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-brand-ink">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.brand}
                            {item.size ? ` · ${item.size}` : ""}
                          </p>
                          <p className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-[15px] font-bold text-brand-800">
                              ฿{baht(item.staff_price)}
                            </span>
                            {item.regular_price > item.staff_price && (
                              <>
                                <span className="text-[12px] text-slate-400 line-through">
                                  ฿{baht(item.regular_price)}
                                </span>
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  -{off}%
                                </span>
                              </>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {soldOut
                              ? "หมดแล้ว"
                              : [
                                  item.left !== null ? `เหลือ ${item.left} ชิ้น` : null,
                                  item.per_person_limit !== null
                                    ? `ซื้อได้ ${item.per_person_limit} ชิ้น/คน`
                                    : null,
                                  item.mine > 0 ? `คุณสั่งไปแล้ว ${item.mine}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </p>

                          {!soldOut && !shop.pending && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={() => setQty(item, qty - 1)}
                                disabled={qty === 0}
                                aria-label={`ลดจำนวน ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                              >
                                <Minus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <span className="min-w-[1.5rem] text-center text-[13px] font-semibold">
                                {qty}
                              </span>
                              <button
                                onClick={() => setQty(item, qty + 1)}
                                disabled={atLimit || (item.left !== null && qty >= item.left)}
                                aria-label={`เพิ่มจำนวน ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* The allowance, the cart and the button. Sticky on desktop only —
              on a phone it sits under the products, where the thumb is. */}
          <aside className="mt-6 space-y-3 lg:sticky lg:top-24 lg:mt-0">
            <div className="rounded-xl2 bg-surface-soft p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                วงเงินของคุณในรอบนี้
              </p>
              <p className="mt-1 text-xl font-bold text-brand-ink">
                ฿{baht(shop.standing.left_thb)}
                <span className="ml-1 text-[12px] font-normal text-slate-400">
                  จาก ฿{baht(shop.standing.cap_thb)}
                </span>
              </p>
              {/* A number plus a bar, because "เหลือ 500 จาก 2,000" and a
                  quarter-full bar answer two different glances. */}
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"
                role="img"
                aria-label={`ใช้ไปแล้ว ${baht(shop.standing.cap_thb - shop.standing.left_thb)} บาท จาก ${baht(shop.standing.cap_thb)} บาท`}
              >
                <div
                  className="h-full rounded-full bg-brand-700"
                  style={{
                    width: `${Math.min(100, Math.round(((shop.standing.cap_thb - shop.standing.left_thb) / shop.standing.cap_thb) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                <BadgeCheck className="h-3 w-3" aria-hidden />
                ยืนยันแล้วด้วย {shop.standing.staff_email}
              </p>
            </div>

            {!shop.pending && (
              <div className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
                <p className="text-[13px] font-bold text-brand-ink">ตะกร้าพนักงาน</p>
                {Object.keys(cart).length === 0 ? (
                  <p className="mt-2 text-[12px] text-slate-400">ยังไม่ได้เลือกสินค้า</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(cart).map(([variantId, qty]) => {
                      const item = shop.items.find((i) => i.variant_id === variantId);
                      if (!item) return null;
                      return (
                        <li key={variantId} className="flex justify-between gap-2 text-[12px]">
                          <span className="min-w-0 flex-1 truncate text-slate-600">
                            {item.name} × {qty}
                          </span>
                          <span className="font-mono text-slate-700">
                            {baht(item.staff_price * qty)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[13px] font-bold text-brand-ink">
                  <span>รวม</span>
                  <span className="font-mono">฿{baht(subtotal)}</span>
                </div>

                {subtotal > shop.standing.left_thb && (
                  <p className="mt-2 text-[12px] text-rose-600">
                    เกินวงเงินที่เหลือ ฿{baht(subtotal - shop.standing.left_thb)}
                  </p>
                )}

                {shop.shipTo ? (
                  <p className="mt-3 text-[11px] text-slate-400">ส่งไปที่ {shop.shipTo.summary}</p>
                ) : (
                  <p className="mt-3 text-[12px] text-amber-700">
                    ยังไม่มีที่อยู่จัดส่ง —{" "}
                    <Link href="/account/addresses" className="font-semibold underline">
                      เพิ่มที่อยู่ก่อนสั่งซื้อ
                    </Link>
                  </p>
                )}

                <Button
                  className="mt-3 w-full"
                  onPress={checkout}
                  isDisabled={
                    busy ||
                    Object.keys(cart).length === 0 ||
                    subtotal > shop.standing.left_thb ||
                    !shop.shipTo ||
                    !shop.shipTo.hasPhone
                  }
                >
                  ไปชำระเงิน
                </Button>
                <p className="mt-2 text-[11px] text-slate-400">
                  ชำระเงินแยกจากตะกร้าปกติ · มีเวลาชำระ {shop.round.payment_window_min ?? 30} นาที
                  หลังกดปุ่มนี้ ถ้าไม่ชำระ วงเงินจะคืนให้อัตโนมัติ
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
      <span className="hidden" aria-hidden>
        {tick}
      </span>
    </div>
  );
}

/**
 * Proving the company mailbox.
 *
 * Two steps in one card rather than two screens: the second step is six
 * digits, and a page change to collect six digits loses people.
 */
function VerifyPanel({ round, onVerified }: { round: RoundInfo; onVerified: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/verify${confirm ? "?confirm=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { email, code } : { email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สำเร็จ");
      if (confirm) onVerified();
      else {
        setSent(true);
        // Only ever present outside production, where no mail provider is
        // configured — see the route's own note.
        if (json.devCode) setDevCode(String(json.devCode));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[520px] rounded-xl2 bg-surface-soft p-5 md:p-6">
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-brand-ink">
        <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden />
        ยืนยันอีเมลบริษัท
      </p>
      <p className="mt-1 text-[13px] text-slate-600">
        {round.name}
        {round.cap_thb ? ` · วงเงิน ฿${baht(round.cap_thb)} ต่อคน` : ""}
      </p>
      <p className="mt-3 text-[13px] text-slate-600">
        ยืนยันใหม่ทุกรอบการซื้อ เพื่อให้แน่ใจว่ายังใช้อีเมลบริษัทอยู่ — อีเมลนี้ใช้ยืนยันสิทธิ์เท่านั้น
        ไม่ได้เปลี่ยนอีเมลของบัญชีคุณ
      </p>

      {error && (
        <div className="mt-3 rounded-xl2 bg-rose-50 p-3 text-[13px] text-rose-700">{error}</div>
      )}

      <label className="mt-4 block text-[12px] font-medium text-slate-500">
        อีเมลบริษัท
        <div className="mt-1 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="somchai@smooth-e.com"
            autoComplete="email"
            className="h-11 flex-1 rounded-xl2 border border-slate-200 bg-white px-3 text-[14px] text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          />
          <Button onPress={() => post(false)} isDisabled={busy || !email.includes("@")}>
            <Mail className="h-4 w-4" aria-hidden />
            {sent ? "ส่งอีกครั้ง" : "ส่งรหัส"}
          </Button>
        </div>
      </label>

      {sent && (
        <>
          <label className="mt-4 block text-[12px] font-medium text-slate-500">
            รหัส 6 หลักที่ส่งไปที่อีเมลนั้น
            <div className="mt-1 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-11 w-32 rounded-xl2 border border-slate-200 bg-white px-3 text-center font-mono text-[16px] tracking-[0.3em] text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              />
              <Button onPress={() => post(true)} isDisabled={busy || code.length !== 6}>
                ยืนยัน
              </Button>
            </div>
          </label>
          {devCode && (
            <p className="mt-2 text-[12px] text-amber-700">
              (เครื่องทดสอบ ยังไม่ได้ตั้งค่าอีเมล) รหัสคือ {devCode}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            รหัสมีอายุ 10 นาที · ถ้าไม่เจอในกล่องหลัก ลองดูในสแปม
          </p>
        </>
      )}
    </div>
  );
}
