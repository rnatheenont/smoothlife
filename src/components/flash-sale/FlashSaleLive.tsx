"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Alert, Button, Card, Chip, ProgressBar, Spinner } from "@heroui/react";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, RotateCcw, Timer, Users } from "lucide-react";
import { formatTHB } from "@/lib/format";
import type { FlashSaleStatus } from "@/lib/flash-sale";
import CheckoutAddressPicker from "@/components/CheckoutAddressPicker";
import PaymentModal from "@/components/PaymentModal";
import { emptyAddressForm, type AddressFormValue } from "@/components/account/AddressFields";

export type LiveProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  /** Regular price. */
  price: number;
  compareAtPrice?: number;
  /** Flash price for this campaign; null = sold at the regular price. */
  salePrice: number | null;
};

/** What the shopper pays, and the higher price to show struck through (if any). */
function priceOf(p: LiveProduct) {
  const pay = p.salePrice ?? p.price;
  const was = Math.max(p.salePrice !== null ? p.price : 0, p.compareAtPrice ?? 0);
  return { pay, was: was > pay ? was : null, percentOff: was > pay ? Math.round((1 - pay / was) * 100) : 0 };
}

type Status = FlashSaleStatus & { signedIn: boolean; refundPending?: boolean };

const POLL_MS = 3000;

const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

function untilLabel(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return mmss(t);
}

const thaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/**
 * The live sale page. Stock and the shopper's place in line come from the
 * database every few seconds; the countdowns in between run on the offset
 * from the server's clock, so a wrong clock on the phone changes nothing.
 */
export default function FlashSaleLive({ campaignId, title, products }: { campaignId: string; title: string; products: LiveProduct[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(products[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressFormValue>(emptyAddressForm);
  const [payment, setPayment] = useState<{ url: string; cartToken: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [, setTick] = useState(0);
  const received = useRef({ at: Date.now(), serverOffset: 0 });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/flash-sale/${campaignId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      received.current = { at: Date.now(), serverOffset: Date.parse(data.server_now) - Date.now() };
      setStatus(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load, then polling
    refresh();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  // Follow the shopper's own entry to its product.
  const mySlug = status?.me && ["waiting", "reserved", "paid"].includes(status.me.status) ? status.me.product_slug : null;
  const shownSlug = mySlug ?? selected;
  const product = products.find((p) => p.slug === shownSlug) ?? products[0];
  const stock = status?.products.find((p) => p.slug === product?.slug);
  const elapsed = (Date.now() - received.current.at) / 1000;
  const serverNow = Date.now() + received.current.serverOffset;

  const act = async (path: "join" | "leave") => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/flash-sale/${campaignId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(path === "join" ? { productSlug: product.slug } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) setNotice(data.error || "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // Opens 2C2P for the shopper's own reservation; the price and the slot are
  // decided on the server. Payment happens in a frame over this page, so the
  // countdown and the queue stay in view.
  const pay = async () => {
    const [firstName, ...rest] = address.recipient_name.trim().split(/\s+/);
    setPaying(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/flash-sale/${campaignId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress: {
            firstName: firstName || undefined,
            lastName: rest.length ? rest.join(" ") : undefined,
            address1: [address.address_line, address.subdistrict].filter(Boolean).join(" "),
            city: address.district,
            state: address.province,
            postalCode: address.postal_code,
            countryCode: address.country,
            phone: address.phone,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setNotice(data.error || "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setPayment({ url: data.webPaymentUrl, cartToken: data.cartToken });
    } finally {
      setPaying(false);
      refresh();
    }
  };
  const addressReady = Boolean(address.recipient_name && address.phone && address.address_line && address.district && address.postal_code);

  if (!product) {
    return <div className="container-page py-16 text-center text-slate-500">ไม่พบสินค้าในแคมเปญนี้</div>;
  }

  const me = status?.me ?? null;
  const reserved = me?.status === "reserved";
  const secondsLeft = reserved ? (me.seconds_left ?? 0) - elapsed : 0;
  const windowSeconds = (status?.campaign.window_minutes ?? 15) * 60;
  const remaining = stock ? stock.total - stock.sold : null;

  return (
    <div className="container-page py-6 md:py-10">
      {reserved && (
        <div className="sticky top-[132px] z-30 -mx-4 mb-4 flex items-center justify-between gap-3 bg-sale px-4 py-2.5 text-white md:top-[150px] md:mx-0 md:rounded-xl2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Timer size={16} aria-hidden /> ชำระเงินภายใน <span className="text-base tabular-nums">{mmss(secondsLeft)}</span>
          </span>
        </div>
      )}

      <div className="mb-5">
        <Chip color="danger" variant="primary" size="sm">
          Flash Sale
        </Chip>
        <h1 className="mt-2 text-2xl font-extrabold text-brand-ink md:text-3xl">{title}</h1>
        {status && (
          <p className="mt-1 text-sm text-slate-500" suppressHydrationWarning>
            {thaiDateTime(status.campaign.starts_at)} – {status.campaign.ends_at ? thaiDateTime(status.campaign.ends_at) : "จนกว่าสินค้าจะหมด"} · 1 บัญชีซื้อได้ 1 ชิ้น
          </p>
        )}
      </div>

      {status?.refundPending && (
        <Alert status="warning" className="mb-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>เราได้รับเงินของคุณหลังสิทธิ์จองหมดเวลา</Alert.Title>
            <Alert.Description>ทีมงานจะคืนเงินเต็มจำนวนไปยังช่องทางที่คุณชำระ ไม่ต้องทำอะไรเพิ่ม หากมีคำถามติดต่อเราทาง LINE</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {loadError && (
        <Alert status="danger" className="mb-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{loadError}</Alert.Title>
            <Alert.Description>ระบบจะลองโหลดใหม่อัตโนมัติ</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {products.length > 1 && (
        <div className="-mx-4 mb-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6">
          {products.map((p) => {
            const s = status?.products.find((x) => x.slug === p.slug);
            const isShown = p.slug === product.slug;
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => setSelected(p.slug)}
                disabled={Boolean(mySlug) && p.slug !== mySlug}
                aria-pressed={isShown}
                className={`relative flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl2 bg-white text-left ring-1 transition disabled:opacity-50 md:w-auto ${
                  isShown ? "ring-2 ring-brand-800" : "ring-surface-line hover:ring-brand-800/40"
                }`}
              >
                <span className="relative block aspect-square">
                  <Image src={p.image} alt="" fill sizes="160px" className="object-contain p-3" />
                  {s && s.sold >= s.total && (
                    <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-slate-600">หมดแล้ว</span>
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="line-clamp-2 text-xs font-medium text-brand-ink">{p.name}</span>
                  <span className="mt-auto flex items-baseline justify-between gap-1">
                    <span className="text-sm font-bold text-sale">{formatTHB(priceOf(p).pay)}</span>
                    {s && <span className="text-[11px] text-slate-500">เหลือ {s.total - s.sold}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <Card className="overflow-hidden p-0">
          <div className="grid sm:grid-cols-2">
            <div className="relative aspect-[16/10] bg-white sm:aspect-square">
              <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-contain p-6" priority />
            </div>
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <div>
                <p className="text-sm text-slate-500">{product.brand}</p>
                <h2 className="mt-1 text-xl font-bold leading-snug text-brand-ink">{product.name}</h2>
              </div>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sale">{formatTHB(priceOf(product).pay)}</span>
                {priceOf(product).was && <span className="text-sm text-slate-400 line-through">{formatTHB(priceOf(product).was!)}</span>}
                {priceOf(product).percentOff > 0 && (
                  <Chip color="danger" variant="soft" size="sm">
                    ลด {priceOf(product).percentOff}%
                  </Chip>
                )}
              </p>
              {stock && (
                <div className="rounded-xl2 bg-surface-soft p-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="whitespace-nowrap font-semibold text-brand-ink">จำนวนจำกัด {stock.total} ชิ้น</span>
                    <span className="whitespace-nowrap text-slate-600">
                      เหลือ <strong className="text-lg text-sale">{remaining}</strong> ชิ้น
                    </span>
                  </p>
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div className="bg-brand-800 transition-[width] duration-500" style={{ width: `${(stock.sold / stock.total) * 100}%` }} />
                    <div className="bg-amber-400 transition-[width] duration-500" style={{ width: `${(stock.reserved / stock.total) * 100}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    ขายแล้ว {stock.sold} · กำลังรอชำระ {stock.reserved} · รอคิว {stock.waiting} คน
                  </p>
                </div>
              )}
              <ul className="flex flex-col gap-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Users size={16} className="shrink-0 text-brand-800" aria-hidden /> 1 บัญชีซื้อได้ 1 ชิ้นต่อแคมเปญ
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-brand-800" aria-hidden /> ถึงคิวแล้วมีเวลาชำระเงิน {status?.campaign.window_minutes ?? 15} นาที
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="lg:sticky lg:top-40">
          <Card className="p-5 md:p-6">
            {!status ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Spinner size="sm" /> กำลังโหลด
              </div>
            ) : (
              <Panel
                status={status}
                productName={product.name}
                productSoldOut={Boolean(stock && stock.sold >= stock.total)}
                secondsLeft={secondsLeft}
                windowSeconds={windowSeconds}
                serverNow={serverNow}
                busy={busy}
                loginHref={`/account/login?returnTo=${encodeURIComponent(`/flash-sale/${campaignId}`)}`}
                join={() => act("join")}
                leave={() => act("leave")}
                checkout={
                  <div className="mt-5 flex flex-col gap-3">
                    <CheckoutAddressPicker value={address} onChange={setAddress} canSave={status.signedIn} />
                    <Button fullWidth size="lg" isDisabled={!addressReady || paying} isPending={paying} onPress={pay}>
                      <CreditCard size={18} aria-hidden /> ชำระเงิน {formatTHB(priceOf(product).pay)}
                    </Button>
                    {status.me?.payment_pending && (
                      <p className="text-center text-xs text-slate-500">
                        เปิดหน้าชำระเงินไปแล้ว ถ้าชำระเสร็จ ระบบจะยืนยันให้ภายในไม่กี่วินาที ถ้ายังไม่ได้ชำระ กดชำระเงินอีกครั้งได้
                      </p>
                    )}
                    <p className="text-center text-xs text-slate-500">บัตรเครดิต/เดบิต หรือ PromptPay QR ผ่าน 2C2P · ส่งฟรีทั่วไทย</p>
                  </div>
                }
              />
            )}
          </Card>
          {notice && (
            <p role="alert" className="mt-3 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {notice}
            </p>
          )}
        </div>
      </div>

      {payment && (
        <PaymentModal
          webPaymentUrl={payment.url}
          cartToken={payment.cartToken}
          onClose={() => {
            setPayment(null);
            refresh();
          }}
          onPaid={refresh}
        />
      )}
    </div>
  );
}

function Panel({
  status,
  productName,
  productSoldOut,
  secondsLeft,
  windowSeconds,
  serverNow,
  busy,
  loginHref,
  join,
  leave,
  checkout,
}: {
  checkout: React.ReactNode;
  status: Status;
  productName: string;
  productSoldOut: boolean;
  secondsLeft: number;
  windowSeconds: number;
  serverNow: number;
  busy: boolean;
  loginHref: string;
  join: () => void;
  leave: () => void;
}) {
  const { campaign, me, signedIn } = status;

  if (me?.status === "paid") {
    return (
      <div>
        <CheckCircle2 size={40} className="text-brand-800" aria-hidden />
        <h3 className="mt-3 text-xl font-bold text-brand-ink">ชำระเงินสำเร็จ</h3>
        <p className="mt-1 text-sm text-slate-600">เลขอ้างอิง {me.payment_reference}</p>
        <p className="mt-1 text-sm text-slate-600">{me.shopify_order_id ? `ออเดอร์ ${me.shopify_order_id}` : "กำลังสร้างออเดอร์ให้คุณ"}</p>
      </div>
    );
  }

  if (me?.status === "reserved") {
    return (
      <div>
        <Chip color="success" variant="soft" size="sm">
          ถึงคิวคุณแล้ว
        </Chip>
        <p className="mt-4 text-sm text-slate-600">เหลือเวลาชำระเงิน</p>
        <p className="text-5xl font-extrabold tabular-nums text-brand-ink">{mmss(secondsLeft)}</p>
        <ProgressBar aria-label="เวลาที่เหลือ" value={Math.max(0, secondsLeft)} maxValue={windowSeconds} color={secondsLeft < 180 ? "danger" : "accent"} className="mt-4">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        {checkout}
      </div>
    );
  }

  if (me?.status === "waiting") {
    return (
      <div>
        <p className="text-sm text-slate-600">ลำดับคิวของคุณ</p>
        <p className="text-6xl font-extrabold tabular-nums text-brand-ink">#{me.position}</p>
        <div className="mt-4 rounded-xl2 bg-surface-soft p-3">
          <p className="text-xs text-slate-500">คิวก่อนหน้าคุณ</p>
          <p className="text-2xl font-bold tabular-nums text-brand-ink">{me.ahead ?? 0}</p>
        </div>
        <p className="mt-4 text-sm text-slate-600">หน้านี้อัปเดตเองทุกไม่กี่วินาที ถึงคิวเมื่อไหร่จะเปลี่ยนเป็นหน้าชำระเงินทันที</p>
        <Button variant="ghost" fullWidth className="mt-3" isDisabled={busy} onPress={leave}>
          ออกจากคิว
        </Button>
      </div>
    );
  }

  if (campaign.phase === "scheduled") {
    return (
      <div>
        <p className="text-sm text-slate-600">เปิดขาย {thaiDateTime(campaign.starts_at)}</p>
        <p className="text-4xl font-extrabold tabular-nums text-brand-ink" suppressHydrationWarning>
          {untilLabel(Date.parse(campaign.starts_at) - serverNow)}
        </p>
        <Button fullWidth size="lg" className="mt-5" isDisabled>
          เข้าคิว
        </Button>
        {!signedIn && (
          <Link href={loginHref} className="mt-3 block text-center text-sm font-semibold text-brand-800 underline">
            เข้าสู่ระบบไว้ก่อน
          </Link>
        )}
      </div>
    );
  }

  if (campaign.phase === "ended" || productSoldOut) {
    return (
      <div>
        <h3 className="text-xl font-bold text-brand-ink">{productSoldOut ? "สินค้าหมดแล้ว" : "ปิดการขายแล้ว"}</h3>
        <p className="mt-1 text-sm text-slate-600">ขอบคุณที่ร่วมกิจกรรม ติดตาม Flash Sale รอบถัดไปทาง LINE</p>
      </div>
    );
  }

  const expired = me?.status === "expired";
  const requeuesLeft = me ? campaign.max_requeue - (me.expired_count - 1) : campaign.max_requeue;
  return (
    <div>
      {expired ? (
        <>
          <AlertTriangle size={32} className="text-amber-500" aria-hidden />
          <h3 className="mt-2 text-xl font-bold text-brand-ink">หมดเวลาชำระเงิน</h3>
          <p className="mt-1 text-sm text-slate-600">สิทธิ์ถูกส่งต่อให้คิวถัดไปแล้ว กลับเข้าคิวได้อีก {Math.max(0, requeuesLeft)} ครั้ง</p>
        </>
      ) : (
        <>
          <Chip color="danger" variant="soft" size="sm">
            เปิดขายแล้ว
          </Chip>
          <h3 className="mt-3 text-xl font-bold text-brand-ink">เข้าคิวเพื่อรับสิทธิ์ซื้อ</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{productName}</p>
        </>
      )}
      {signedIn ? (
        <Button fullWidth size="lg" className="mt-5" isDisabled={busy || (expired && requeuesLeft <= 0)} isPending={busy} onPress={join}>
          {expired ? (
            <>
              <RotateCcw size={18} aria-hidden /> กลับเข้าคิวใหม่
            </>
          ) : (
            "เข้าคิว"
          )}
        </Button>
      ) : (
        <>
          <Link
            href={loginHref}
            className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-brand-800 text-base font-semibold text-white hover:bg-brand-1000"
          >
            เข้าสู่ระบบเพื่อเข้าคิว
          </Link>
          <p className="mt-2 text-center text-xs text-slate-500">ต้องเข้าสู่ระบบ เพื่อจำกัด 1 บัญชี 1 สิทธิ์</p>
        </>
      )}
    </div>
  );
}
