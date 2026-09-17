"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Alert, Button, Card, Chip, Modal, ProgressBar, Separator, Spinner, Tabs, Toast, toast } from "@heroui/react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { formatTHB } from "@/lib/format";
import {
  available,
  confirmPayment,
  createSale,
  joinQueue,
  leaveQueue,
  metrics,
  mmss,
  mutate,
  openNow,
  tick,
  YOU_ID,
  type Entry,
  type LogKind,
  type SaleState,
} from "./engine";

export type DemoProduct = { name: string; brand: string; image: string; price: number; compareAtPrice?: number };

const SPEEDS = [1, 30, 120] as const;
const TICK_MS = 250;

export default function FlashSaleDemo({ product }: { product: DemoProduct }) {
  const [state, setState] = useState<SaleState>(() => createSale());
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(30);
  const [running, setRunning] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setState((s) => tick(s, (TICK_MS / 1000) * speed)), TICK_MS);
    return () => clearInterval(t);
  }, [running, speed]);

  // Your latest row (a requeue creates a new row, like the real table).
  const you = useMemo(() => [...state.entries].reverse().find((e) => e.isYou), [state.entries]);
  const expiredCount = state.entries.filter((e) => e.isYou && e.status === "expired").length;

  // §11.1 — the LINE push when your turn comes, shown as a toast here.
  const lastReserved = useRef<string | null>(null);
  useEffect(() => {
    if (you?.status === "reserved" && lastReserved.current !== you.id) {
      lastReserved.current = you.id;
      toast("LINE · Smoothlife: ถึงคิวคุณแล้ว", {
        description: "คุณมีเวลา 15 นาทีในการชำระเงิน แตะเพื่อไปหน้าชำระเงิน",
        variant: "success",
        timeout: 6000,
      });
    }
  }, [you]);

  const join = () =>
    setState((s) =>
      mutate(s, (m) => {
        const r = joinQueue(m, YOU_ID, "คุณ", true);
        setNotice("reason" in r ? r.reason : null);
      })
    );

  const reset = () => {
    setState(createSale());
    setLoggedIn(false);
    setNotice(null);
    setPayOpen(false);
    lastReserved.current = null;
  };

  return (
    <div className="container-page py-6 md:py-10">
      <Toast.Provider />

      <Alert status="warning" className="mb-4">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Demo · ข้อมูลจำลองทั้งหมด</Alert.Title>
          <Alert.Description>
            ไม่มีการตัดเงิน ไม่สร้างออเดอร์จริง ลูกค้าคนอื่นในคิวเป็นบอทจำลอง 70 คน · เวลาในเดโมเร่งให้ดูทันได้ (×{speed})
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <DemoControls
        state={state}
        speed={speed}
        setSpeed={setSpeed}
        running={running}
        setRunning={setRunning}
        reset={reset}
        toggleShopify={() => setState((s) => ({ ...s, shopifyDown: !s.shopifyDown }))}
        openNow={() => setState((s) => openNow(s))}
      />

      <Tabs className="mt-5">
        <Tabs.ListContainer>
          <Tabs.List aria-label="มุมมอง">
            <Tabs.Tab id="customer">
              มุมมองลูกค้า
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="admin">
              มุมมองแอดมิน
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="customer" className="pt-5">
          <CustomerView
            state={state}
            product={product}
            you={you}
            expiredCount={expiredCount}
            loggedIn={loggedIn}
            login={() => setLoggedIn(true)}
            join={join}
            leave={() => setState((s) => mutate(s, (m) => leaveQueue(m, YOU_ID)))}
            notice={notice}
            openPay={() => setPayOpen(true)}
          />
        </Tabs.Panel>

        <Tabs.Panel id="admin" className="pt-5">
          <AdminView state={state} />
        </Tabs.Panel>
      </Tabs>

      <PaymentModal
        isOpen={payOpen}
        setOpen={setPayOpen}
        entry={you}
        state={state}
        product={product}
        pay={() =>
          setState((s) =>
            mutate(s, (m) => {
              const r = confirmPayment(m, you!.id);
              if (!r.ok) setNotice(r.reason ?? null);
            })
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ controls */

function DemoControls({
  state,
  speed,
  setSpeed,
  running,
  setRunning,
  reset,
  toggleShopify,
  openNow,
}: {
  state: SaleState;
  speed: number;
  setSpeed: (s: (typeof SPEEDS)[number]) => void;
  running: boolean;
  setRunning: (r: boolean) => void;
  reset: () => void;
  toggleShopify: () => void;
  openNow: () => void;
}) {
  return (
    <Card variant="secondary" className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-brand-ink">ตัวควบคุมเดโม</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs tabular-nums text-slate-600 ring-1 ring-surface-line">
          เวลาในระบบ {mmss(state.now)}
        </span>
        <div className="flex overflow-hidden rounded-full ring-1 ring-surface-line" role="group" aria-label="ความเร็ว">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`min-h-9 px-3 text-xs font-semibold ${speed === s ? "bg-brand-800 text-white" : "bg-white text-slate-600 hover:bg-surface-mist"}`}
            >
              ×{s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state.sale.status === "scheduled" && (
          <Button size="sm" variant="secondary" onPress={openNow}>
            <Play size={14} aria-hidden /> เปิดขายทันที
          </Button>
        )}
        <Button size="sm" variant="secondary" onPress={() => setRunning(!running)}>
          {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {running ? "หยุดเวลา" : "เดินเวลาต่อ"}
        </Button>
        <Button size="sm" variant={state.shopifyDown ? "danger" : "secondary"} onPress={toggleShopify}>
          <ServerCrash size={14} aria-hidden /> {state.shopifyDown ? "Shopify ล่มอยู่ (กดเพื่อกู้)" : "จำลอง Shopify ล่ม"}
        </Button>
        <Button size="sm" variant="ghost" onPress={reset}>
          <RotateCcw size={14} aria-hidden /> เริ่มใหม่
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ customer */

function StockBar({ state, compact = false }: { state: SaleState; compact?: boolean }) {
  const { total, sold, reserved } = state.sale;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
        <div className="bg-brand-800 transition-[width] duration-500" style={{ width: pct(sold) }} />
        <div className="bg-amber-400 transition-[width] duration-500" style={{ width: pct(reserved) }} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-brand-800" /> ขายแล้ว {sold}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-amber-400" /> กำลังรอชำระ {reserved}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-surface-muted ring-1 ring-surface-line" /> ว่าง {available(state)}
          </span>
        </div>
      )}
    </div>
  );
}

function CustomerView({
  state,
  product,
  you,
  expiredCount,
  loggedIn,
  login,
  join,
  leave,
  notice,
  openPay,
}: {
  state: SaleState;
  product: DemoProduct;
  you?: Entry;
  expiredCount: number;
  loggedIn: boolean;
  login: () => void;
  join: () => void;
  leave: () => void;
  notice: string | null;
  openPay: () => void;
}) {
  const remaining = state.sale.total - state.sale.sold;
  const reserved = you?.status === "reserved";

  return (
    <div>
      {/* Shopee / GOAT pattern: the payment deadline pinned where it can't be missed. */}
      {reserved && (
        <div className="sticky top-[132px] z-30 -mx-4 mb-4 flex items-center justify-between gap-3 bg-sale px-4 py-2.5 text-white md:top-[150px] md:mx-0 md:rounded-xl2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Timer size={16} aria-hidden /> ชำระเงินภายใน
            <span className="text-base tabular-nums">{mmss((you!.expiresAt ?? 0) - state.now)}</span>
          </span>
          <button type="button" onClick={openPay} className="min-h-9 rounded-full bg-white px-4 text-sm font-bold text-sale">
            ชำระเงิน
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="relative aspect-[16/10] bg-white sm:aspect-square lg:aspect-[16/9] xl:aspect-square">
              <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-contain p-6" />
              <Chip color="danger" variant="primary" size="sm" className="absolute left-4 top-4">
                Flash Sale
              </Chip>
            </div>
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <div>
                <p className="text-sm text-slate-500">{product.brand}</p>
                <h2 className="mt-1 text-xl font-bold leading-snug text-brand-ink md:text-2xl">{product.name}</h2>
              </div>
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sale">{formatTHB(product.price)}</span>
                {product.compareAtPrice && <span className="text-sm text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>}
              </p>
              <div className="rounded-xl2 bg-surface-soft p-4">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="whitespace-nowrap font-semibold text-brand-ink">จำนวนจำกัด {state.sale.total} ชิ้น</span>
                  <span className="whitespace-nowrap text-slate-600">
                    เหลือ <strong className="text-lg text-sale">{remaining}</strong> ชิ้น
                  </span>
                </p>
                <div className="mt-3">
                  <StockBar state={state} />
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Users size={16} className="shrink-0 text-brand-800" aria-hidden /> 1 บัญชีซื้อได้ 1 ชิ้น
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-brand-800" aria-hidden /> ถึงคิวแล้วมีเวลาชำระเงิน 15 นาที
                </li>
                <li className="flex items-center gap-2">
                  <RotateCcw size={16} className="shrink-0 text-brand-800" aria-hidden /> ชำระไม่ทันกลับเข้าคิวได้ {state.sale.maxRequeue} ครั้ง
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="lg:sticky lg:top-40">
          <ActionPanel
            state={state}
            you={you}
            expiredCount={expiredCount}
            loggedIn={loggedIn}
            login={login}
            join={join}
            leave={leave}
            openPay={openPay}
          />
          {notice && (
            <p role="alert" className="mt-3 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelShell({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className="relative overflow-hidden p-5 md:p-6">
      {children}
      {highlight && <BorderBeam size={120} duration={5} colorFrom="#00A87B" colorTo="#00AEEF" borderWidth={2} />}
    </Card>
  );
}

function ActionPanel({
  state,
  you,
  expiredCount,
  loggedIn,
  login,
  join,
  leave,
  openPay,
}: {
  state: SaleState;
  you?: Entry;
  expiredCount: number;
  loggedIn: boolean;
  login: () => void;
  join: () => void;
  leave: () => void;
  openPay: () => void;
}) {
  const { sale } = state;
  const status = you?.status;

  if (status === "paid") {
    return (
      <PanelShell>
        <CheckCircle2 size={40} className="text-brand-800" aria-hidden />
        <h3 className="mt-3 text-xl font-bold text-brand-ink">ชำระเงินสำเร็จ</h3>
        <p className="mt-1 text-sm text-slate-600">ได้รับสินค้า Flash Sale 1 ชิ้นแล้ว</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">เลขอ้างอิง 2C2P</dt>
          <dd className="font-medium tabular-nums text-brand-ink">{you!.paymentRef}</dd>
          <dt className="text-slate-500">ออเดอร์</dt>
          <dd className="font-medium text-brand-ink">
            {you!.sync === "synced" ? (
              you!.orderNo
            ) : you!.sync === "failed" ? (
              <span className="text-amber-700">กำลังสร้างออเดอร์ (ระบบกำลังลองใหม่)</span>
            ) : (
              <span className="inline-flex items-center gap-2 text-slate-500">
                <Spinner size="sm" /> กำลังสร้างออเดอร์
              </span>
            )}
          </dd>
        </dl>
        {you!.sync === "failed" && (
          <p className="mt-4 rounded-xl2 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            เงินของคุณเข้าระบบแล้ว สิทธิ์ไม่หายไปไหน ระบบกำลังสร้างออเดอร์ใหม่อัตโนมัติ และแจ้งทีมงานให้ตรวจสอบแล้ว
          </p>
        )}
      </PanelShell>
    );
  }

  if (status === "reserved") {
    const left = (you!.expiresAt ?? 0) - state.now;
    return (
      <PanelShell highlight>
        <Chip color="success" variant="soft" size="sm">
          ถึงคิวคุณแล้ว
        </Chip>
        <p className="mt-4 text-sm text-slate-600">เหลือเวลาชำระเงิน</p>
        <p className="text-5xl font-extrabold tabular-nums text-brand-ink">{mmss(left)}</p>
        <ProgressBar
          aria-label="เวลาที่เหลือ"
          value={left}
          maxValue={sale.windowSeconds}
          color={left < 180 ? "danger" : "accent"}
          className="mt-4"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <p className="mt-2 text-xs text-slate-500">นับจากเวลาของเซิร์ฟเวอร์ ไม่ใช่นาฬิกาในเครื่อง</p>
        <Button fullWidth size="lg" className="mt-5" onPress={openPay}>
          <CreditCard size={18} aria-hidden /> ไปชำระเงินผ่าน 2C2P
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock size={12} aria-hidden /> ลิงก์ชำระเงินใช้ได้เฉพาะบัญชีนี้ ครั้งเดียว
        </p>
      </PanelShell>
    );
  }

  if (status === "waiting") {
    const ahead = state.entries.filter((e) => e.status === "waiting" && e.position < you!.position).length;
    return (
      <PanelShell>
        <p className="text-sm text-slate-600">ลำดับคิวของคุณ</p>
        <p className="text-6xl font-extrabold tabular-nums text-brand-ink">
          #<NumberTicker value={you!.position} startValue={Math.max(0, you!.position - 5)} />
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl2 bg-surface-soft p-3">
            <p className="text-xs text-slate-500">คิวก่อนหน้าคุณ</p>
            <p className="text-2xl font-bold tabular-nums text-brand-ink">{ahead}</p>
          </div>
          <div className="rounded-xl2 bg-surface-soft p-3">
            <p className="text-xs text-slate-500">กำลังรอชำระเงิน</p>
            <p className="text-2xl font-bold tabular-nums text-brand-ink">{sale.reserved}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          ไม่ต้องเปิดหน้านี้ค้างไว้ ถึงคิวเมื่อไหร่เราจะแจ้งทาง LINE ทันที หน้านี้อัปเดตเองแบบเรียลไทม์
        </p>
        <Separator className="my-4" />
        <Button variant="ghost" fullWidth onPress={leave}>
          ออกจากคิว
        </Button>
      </PanelShell>
    );
  }

  if (sale.status === "sold_out" || status === "sold_out") {
    return (
      <PanelShell>
        <h3 className="text-xl font-bold text-brand-ink">สินค้าหมดแล้ว</h3>
        <p className="mt-1 text-sm text-slate-600">ขายครบ {sale.total} ชิ้นแล้ว ขอบคุณที่ร่วมกิจกรรม ติดตาม Flash Sale รอบถัดไปทาง LINE</p>
      </PanelShell>
    );
  }

  if (status === "expired") {
    const left = sale.maxRequeue - (expiredCount - 1);
    const canRequeue = expiredCount <= sale.maxRequeue;
    return (
      <PanelShell>
        <AlertTriangle size={36} className="text-amber-500" aria-hidden />
        <h3 className="mt-3 text-xl font-bold text-brand-ink">หมดเวลาชำระเงิน</h3>
        <p className="mt-1 text-sm text-slate-600">สิทธิ์ของคุณถูกส่งต่อให้คิวถัดไปแล้ว</p>
        <Button fullWidth size="lg" className="mt-5" isDisabled={!canRequeue} onPress={join}>
          <RotateCcw size={18} aria-hidden /> กลับเข้าคิวใหม่
        </Button>
        <p className="mt-2 text-center text-xs text-slate-500">
          {canRequeue ? `กลับเข้าคิวได้อีก ${left} ครั้ง (ต่อท้ายคิว)` : `ใช้สิทธิ์กลับเข้าคิวครบ ${sale.maxRequeue} ครั้งแล้ว`}
        </p>
      </PanelShell>
    );
  }

  if (sale.status === "scheduled") {
    return (
      <PanelShell>
        <p className="text-sm text-slate-600">เปิดขายในอีก</p>
        <p className="text-5xl font-extrabold tabular-nums text-brand-ink">{mmss(sale.opensAt - state.now)}</p>
        <Button fullWidth size="lg" className="mt-5" isDisabled>
          เข้าคิว
        </Button>
        {!loggedIn && (
          <Button fullWidth variant="secondary" className="mt-2" onPress={login}>
            เข้าสู่ระบบไว้ก่อน
          </Button>
        )}
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <Chip color="danger" variant="soft" size="sm">
        เปิดขายแล้ว
      </Chip>
      <h3 className="mt-3 text-xl font-bold text-brand-ink">เข้าคิวเพื่อรับสิทธิ์ซื้อ</h3>
      <p className="mt-1 text-sm text-slate-600">
        มีคนรออยู่ {state.entries.filter((e) => e.status === "waiting").length} คน · ว่างตอนนี้ {available(state)} สิทธิ์
      </p>
      {loggedIn ? (
        <Button fullWidth size="lg" className="mt-5" onPress={join}>
          เข้าคิว
        </Button>
      ) : (
        <>
          <Button fullWidth size="lg" className="mt-5" onPress={login}>
            เข้าสู่ระบบเพื่อเข้าคิว
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">ต้องเข้าสู่ระบบ เพื่อจำกัด 1 บัญชี 1 สิทธิ์</p>
        </>
      )}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ payment */

function PaymentModal({
  isOpen,
  setOpen,
  entry,
  state,
  product,
  pay,
}: {
  isOpen: boolean;
  setOpen: (o: boolean) => void;
  entry?: Entry;
  state: SaleState;
  product: DemoProduct;
  pay: () => void;
}) {
  const [method, setMethod] = useState("card");
  const paid = entry?.status === "paid";
  const live = entry?.status === "reserved";
  return (
    <Modal isOpen={isOpen} onOpenChange={setOpen}>
      <Modal.Backdrop>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>ชำระเงิน · 2C2P (จำลอง)</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {live && (
                <p className="mb-3 flex items-center gap-2 rounded-xl2 bg-rose-50 px-3 py-2 text-sm font-semibold text-sale">
                  <Timer size={16} aria-hidden /> เหลือเวลา {mmss((entry!.expiresAt ?? 0) - state.now)}
                </p>
              )}
              <div className="flex items-center justify-between rounded-xl2 bg-surface-soft p-3 text-sm">
                <span className="line-clamp-1 pr-3 text-slate-700">{product.name}</span>
                <span className="shrink-0 font-bold text-brand-ink">{formatTHB(product.price)}</span>
              </div>
              <fieldset className="mt-4 flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold text-brand-ink">ช่องทางชำระเงิน</legend>
                {[
                  { id: "card", label: "บัตรเครดิต / เดบิต" },
                  { id: "promptpay", label: "PromptPay QR" },
                  { id: "mobile", label: "Mobile Banking" },
                ].map((m) => (
                  <label
                    key={m.id}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl2 px-3 ring-1 ${method === m.id ? "bg-brand-50 ring-brand-800" : "ring-surface-line"}`}
                  >
                    <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="accent-brand-800" />
                    <span className="text-sm text-brand-ink">{m.label}</span>
                  </label>
                ))}
              </fieldset>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-800" aria-hidden />
                ระบบจริงยืนยันการชำระเงินจาก webhook ของ 2C2P ที่ตรวจลายเซ็นแล้วเท่านั้น ไม่เชื่อหน้าที่ redirect กลับมา
              </p>
              {paid && <p className="mt-3 rounded-xl2 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">ชำระเงินสำเร็จแล้ว</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" slot="close">
                ปิด
              </Button>
              <Button isDisabled={!live} onPress={pay}>
                ชำระเงิน {formatTHB(product.price)}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/* ------------------------------------------------------------------ admin */

const LOG_TONE: Record<LogKind, string> = {
  join: "bg-slate-300",
  requeue: "bg-slate-400",
  reserve: "bg-amber-400",
  pay: "bg-brand-800",
  expire: "bg-rose-400",
  sync: "bg-sky-500",
  sync_failed: "bg-rose-600",
  sold_out: "bg-brand-ink",
  open: "bg-brand-600",
  reject: "bg-slate-400",
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums ${tone}`}>
        <NumberTicker value={value} startValue={0} />
      </p>
    </Card>
  );
}

function AdminView({ state }: { state: SaleState }) {
  const m = metrics(state);
  const reserved = state.entries.filter((e) => e.status === "reserved").sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
  const failed = state.entries.filter((e) => e.status === "paid" && e.sync === "failed");
  const { sale } = state;
  const statusLabel = { scheduled: "ยังไม่เปิด", open: "เปิดขาย", sold_out: "ขายหมด" }[sale.status];

  return (
    <div className="flex flex-col gap-5">
      {failed.length > 0 && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>มีลูกค้าจ่ายเงินแล้ว {failed.length} ราย แต่ยังสร้างออเดอร์ Shopify ไม่สำเร็จ</Alert.Title>
            <Alert.Description>
              ระบบลองใหม่อัตโนมัติทุก 30 วินาที และแจ้งเตือนทีมทาง LINE แล้ว ({failed.map((e) => e.paymentRef).join(", ")})
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="รอในคิว" value={m.waiting} tone="text-brand-ink" />
        <Stat label="กำลังรอชำระเงิน" value={sale.reserved} tone="text-amber-600" />
        <Stat label={`ขายแล้ว / ${sale.total}`} value={sale.sold} tone="text-brand-800" />
        <Stat label="สิทธิ์ว่าง" value={available(state)} tone="text-slate-600" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-brand-ink">{sale.name}</h3>
          <Chip size="sm" variant="soft" color={sale.status === "open" ? "success" : sale.status === "sold_out" ? "default" : "warning"}>
            {statusLabel}
          </Chip>
        </div>
        <StockBar state={state} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h3 className="font-bold text-brand-ink">กำลังรอชำระเงิน ({reserved.length})</h3>
          <p className="text-xs text-slate-500">เรียงจากคนที่ใกล้หมดเวลาที่สุด</p>
          {reserved.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">ยังไม่มีใครกำลังจอง</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-surface-line">
              {reserved.map((e) => {
                const left = (e.expiresAt ?? 0) - state.now;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-10 shrink-0 text-xs tabular-nums text-slate-500">#{e.position}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${e.isYou ? "font-bold text-brand-800" : "text-brand-ink"}`}>
                      {e.isYou ? "คุณ (บัญชีทดลอง)" : e.name}
                      {e.requeueCount > 0 && <span className="ml-1.5 text-xs text-slate-400">เข้าคิวรอบ {e.requeueCount + 1}</span>}
                    </span>
                    <div className="hidden w-28 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={`h-full ${left < 180 ? "bg-rose-500" : "bg-amber-400"}`}
                          style={{ width: `${(left / sale.windowSeconds) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className={`w-12 shrink-0 text-right text-sm tabular-nums ${left < 180 ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                      {mmss(left)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-brand-ink">เหตุการณ์ล่าสุด</h3>
          <ul className="mt-3 flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
            {state.log.slice(0, 40).map((l) => (
              <li key={l.id} className="flex gap-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LOG_TONE[l.kind]}`} aria-hidden />
                <span className="w-12 shrink-0 tabular-nums text-xs leading-5 text-slate-400">{mmss(l.at)}</span>
                <span className={l.isYou ? "font-semibold text-brand-800" : "text-slate-700"}>{l.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold text-brand-ink">สรุปผลการขาย</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {[
              ["ลูกค้าที่เข้าคิว", `${m.customers} คน`],
              ["อัตราซื้อจริง", `${Math.round(m.conversion * 100)}%`],
              ["เวลาเฉลี่ยได้สิทธิ์ → จ่าย", m.avgPaySeconds ? `${mmss(m.avgPaySeconds)} นาที` : "-"],
              ["หมดเวลาไม่จ่าย", `${m.expired} ครั้ง`],
              ["กลับเข้าคิวใหม่", `${m.requeues} ครั้ง`],
              ["ออเดอร์ค้างสร้างไม่สำเร็จ", `${m.syncFailed} ราย`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl2 bg-surface-soft p-3">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-brand-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-brand-ink">ตั้งค่าการขายรอบนี้</h3>
          <p className="text-xs text-slate-500">เก็บเป็นข้อมูล 1 แถวต่อรอบ สร้างรอบใหม่ได้โดยไม่ต้องแก้โค้ด</p>
          <dl className="mt-3 flex flex-col divide-y divide-surface-line text-sm">
            {[
              ["จำนวนสต็อก", `${sale.total} ชิ้น`],
              ["จำกัดต่อบัญชี", "1 ชิ้น"],
              ["เวลาชำระเงิน", `${sale.windowSeconds / 60} นาที`],
              ["กลับเข้าคิวได้สูงสุด", `${sale.maxRequeue} ครั้ง`],
              ["แจ้งเตือนถึงคิว", "LINE OA"],
              ["ยืนยันการชำระเงิน", "2C2P webhook + ตรวจลายเซ็น"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-brand-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
