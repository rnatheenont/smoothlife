"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { available, metrics, mmss, type Entry, type LogKind, type SaleState } from "./engine";
import {
  campaignLog,
  createCampaign,
  joinCampaign,
  leaveCampaign,
  payCampaign,
  yourActive,
  type CampaignConfig,
  type CampaignState,
  type DemoProduct,
} from "./campaign";
import {
  addCampaign,
  countdown,
  createScheduler,
  endNow,
  loadCampaigns,
  nowMs,
  removeCampaign,
  startNow,
  thaiDateTime,
  tickScheduler,
  updateCampaign,
  type CampaignInput,
  type SchedulerState,
} from "./scheduler";
import type { FlashSaleCampaignDTO } from "@/lib/flash-sale-campaigns";
import CampaignSetup, { type CatalogueItem, type ProductGroup } from "./CampaignSetup";
import CampaignList from "./CampaignList";
import LiveMonitor from "./LiveMonitor";

export type { DemoProduct };

const SPEEDS = [1, 30, 120] as const;
const TICK_MS = 250;
const API = "/api/admin/flash-sale/campaigns";

/** A stored campaign → what the demo runs, with product details from the catalogue. */
function toInput(c: FlashSaleCampaignDTO, bySlug: Map<string, CatalogueItem>): CampaignInput | null {
  const products = c.productSlugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is CatalogueItem => Boolean(p))
    .map(({ slug, name, brand, image, price, compareAtPrice }) => {
      const sale = c.salePrices?.[slug];
      return sale === null || sale === undefined
        ? { slug, name, brand, image, price, compareAtPrice }
        : { slug, name, brand, image, price: sale, compareAtPrice: Math.max(price, compareAtPrice ?? 0) };
    });
  if (products.length === 0) return null;
  return {
    id: c.id,
    startsAt: c.startsAt,
    endsAt: c.endsAt ?? undefined,
    endedManuallyAt: c.endedManuallyAt ?? undefined,
    config: {
      mode: c.mode,
      kind: c.kind,
      presentation: {
        heroImage: c.presentation.heroImage ?? undefined,
        heroHeadline: c.presentation.heroHeadline ?? undefined,
        heroNote: c.presentation.heroNote ?? undefined,
        accent: c.presentation.accent ?? undefined,
        faq: c.presentation.faq,
      },
      title: c.title,
      products,
      stockPerProduct: c.stockPerProduct,
      windowMinutes: c.windowMinutes,
      maxRequeue: c.maxRequeue,
      group: c.groupKind && c.groupKey ? { kind: c.groupKind, key: c.groupKey } : undefined,
    },
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({ ok: false, error: "เชื่อมต่อไม่สำเร็จ" }));
  if (!res.ok || !data.ok) throw new Error(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return data as T;
}

export default function FlashSaleDemo({
  embedded = false,
  baseMs,
  initialConfig,
  catalogue,
  groups,
}: {
  /** Inside the admin layout, which already provides the page gutter. */
  embedded?: boolean;
  /** Server render time, so the first client render shows the same clock. */
  baseMs: number;
  initialConfig: CampaignConfig;
  catalogue: CatalogueItem[];
  groups: ProductGroup[];
}) {
  const [scheduler, setScheduler] = useState<SchedulerState>(() => createScheduler(baseMs));
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  // The campaign list lives in the database (flash_sale_campaigns); the sale
  // simulation on top of it stays in the browser.
  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const data = await api<{ campaigns: FlashSaleCampaignDTO[] }>(API, { cache: "no-store" });
      const inputs = data.campaigns.map((c) => toInput(c, bySlug)).filter((x): x is CampaignInput => x !== null);
      setScheduler(loadCampaigns(createScheduler(Date.now()), inputs));
      setLoadState("ready");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "โหลดรายการแคมเปญไม่สำเร็จ");
      setLoadState("error");
    }
  }, [bySlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of the stored campaign list
    load();
  }, [load]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(30);
  const [running, setRunning] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setScheduler((s) => tickScheduler(s, (TICK_MS / 1000) * speed)), TICK_MS);
    return () => clearInterval(t);
  }, [running, speed]);

  const now = nowMs(scheduler);
  // The campaign on screen: the one picked in the list, else whatever is on
  // sale now, else the next one due.
  const item =
    scheduler.items.find((i) => i.id === selectedId) ??
    scheduler.items.find((i) => i.status === "running") ??
    scheduler.items.find((i) => i.status === "scheduled") ??
    scheduler.items[scheduler.items.length - 1];
  const preview = useMemo(() => createCampaign(item?.config ?? initialConfig), [item, initialConfig]);
  const campaign = item?.campaign ?? preview;
  const upcoming = item && item.status === "scheduled" ? { at: thaiDateTime(item.startsAt), left: countdown(item.startsAt - now) } : undefined;

  // Each list action is saved first; the demo follows once the database agrees.
  const runAction = async (fn: () => Promise<void>) => {
    setAdminError(null);
    try {
      await fn();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  };
  const createStored = (config: CampaignConfig, startsAt: number, endsAt?: number) =>
    runAction(async () => {
      setSaving(true);
      try {
        const { campaign: saved } = await api<{ campaign: FlashSaleCampaignDTO }>(API, {
          method: "POST",
          body: JSON.stringify({
            title: config.title,
            mode: config.mode,
            kind: config.kind ?? "regular",
            heroImage: config.presentation?.heroImage ?? null,
            heroHeadline: config.presentation?.heroHeadline ?? null,
            heroNote: config.presentation?.heroNote ?? null,
            accent: config.presentation?.accent ?? null,
            faq: config.presentation?.faq ?? [],
            groupKind: config.group?.kind,
            groupKey: config.group?.key,
            productSlugs: config.products.map((p) => p.slug),
            pricing: config.pricing ?? { mode: "regular" },
            stockPerProduct: config.stockPerProduct,
            windowMinutes: config.windowMinutes,
            maxRequeue: config.maxRequeue,
            startsAt,
            endsAt: endsAt ?? null,
          }),
        });
        const input = toInput(saved, bySlug);
        if (input) {
          setScheduler((s) => addCampaign(s, input));
          setSelectedId(saved.id);
          setSelected(0);
        }
      } finally {
        setSaving(false);
      }
    });
  const startStored = (id: string) =>
    runAction(async () => {
      await api(`${API}/${id}`, { method: "PATCH", body: JSON.stringify({ action: "start_now" }) });
      setScheduler((s) => startNow(s, id));
    });
  const endStored = (id: string) =>
    runAction(async () => {
      await api(`${API}/${id}`, { method: "PATCH", body: JSON.stringify({ action: "end_now" }) });
      setScheduler((s) => endNow(s, id));
    });
  const removeStored = (id: string) =>
    runAction(async () => {
      if (!window.confirm("ลบแคมเปญนี้ออกจากรายการ?")) return;
      await api(`${API}/${id}`, { method: "DELETE" });
      setScheduler((s) => removeCampaign(s, id));
      if (selectedId === id) setSelectedId(null);
    });

  const saleIndex = Math.min(selected, campaign.sales.length - 1);
  const state = campaign.sales[saleIndex];
  const product = state.product;
  const active = yourActive(campaign);
  const blockedBy = active && active.saleIndex !== saleIndex ? campaign.sales[active.saleIndex].product.name : null;

  // Your latest row for this product (a requeue creates a new row, like the real table).
  const you = useMemo(() => [...state.entries].reverse().find((e) => e.isYou), [state.entries]);
  const expiredCount = state.entries.filter((e) => e.isYou && e.status === "expired").length;

  // §11.1 — the LINE push when your turn comes, shown as a toast here.
  const lastReserved = useRef<string | null>(null);
  const activeEntry = active?.entry;
  const activeSale = active ? campaign.sales[active.saleIndex] : null;
  useEffect(() => {
    if (activeEntry?.status === "reserved" && activeSale && lastReserved.current !== activeEntry.id) {
      lastReserved.current = activeEntry.id;
      toast(`LINE · Smoothlife: ถึงคิวคุณแล้ว`, {
        description: `${activeSale.product.name} — คุณมีเวลา ${Math.round(activeSale.sale.windowSeconds / 60)} นาทีในการชำระเงิน`,
        variant: "success",
        timeout: 6000,
      });
    }
  }, [activeEntry, activeSale]);

  const onCampaign = (fn: (c: CampaignState) => CampaignState) => item && setScheduler((s) => updateCampaign(s, item.id, fn));

  const join = () => {
    if (!item?.campaign) return;
    const { next, result } = joinCampaign(item.campaign, saleIndex);
    setScheduler((s) => updateCampaign(s, item.id, () => next));
    setNotice("reason" in result ? result.reason : null);
  };

  const pick = (id: string) => {
    setSelectedId(id);
    setSelected(0);
    setNotice(null);
    setPayOpen(false);
  };

  const reset = () => {
    load();
    setSelectedId(null);
    setSelected(0);
    setLoggedIn(false);
    setNotice(null);
    setPayOpen(false);
    lastReserved.current = null;
  };

  return (
    <div className={embedded ? "" : "container-page py-6 md:py-10"}>
      <Toast.Provider />
      {embedded && (
        <div className="mb-4">
          <h1 className="text-xl font-bold text-brand-ink">Flash Sale (เดโม)</h1>
          <p className="mt-1 text-sm text-slate-500">
            ตั้งแคมเปญล่วงหน้าเป็นรายการ (บันทึกในฐานข้อมูล) ระบบเปิดและปิดการขายเองตามวันเวลาที่ตั้งไว้ ดูมุมมองลูกค้าได้ในแท็บถัดไป
          </p>
        </div>
      )}

      <Alert status="warning" className="mb-4">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Demo · ข้อมูลจำลองทั้งหมด</Alert.Title>
          <Alert.Description>
            รายการแคมเปญบันทึกจริง แต่การขายในเดโมเป็นการจำลอง: ไม่ตัดเงิน ไม่สร้างออเดอร์ ลูกค้าในคิวเป็นบอท · นาฬิกาเดโมเริ่มจากเวลาปัจจุบันและเดินเร็วขึ้น ×{speed}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <DemoControls
        nowMs={now}
        shopifyDown={scheduler.shopifyDown}
        speed={speed}
        setSpeed={setSpeed}
        running={running}
        setRunning={setRunning}
        reset={reset}
        toggleShopify={() => setScheduler((s) => ({ ...s, shopifyDown: !s.shopifyDown }))}
      />

      <Tabs className="mt-5" defaultSelectedKey={embedded ? "admin" : "customer"}>
        {/* Full-width, equal halves: on a phone the two labels otherwise
            overflow the pill and HeroUI adds a scroll arrow. */}
        <Tabs.ListContainer className="w-full">
          <Tabs.List aria-label="มุมมอง" className="w-full">
            <Tabs.Tab id="admin" className="flex-1 justify-center whitespace-nowrap">
              มุมมองแอดมิน
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="customer" className="flex-1 justify-center whitespace-nowrap">
              มุมมองลูกค้า
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="customer" className="pt-5">
          <CampaignSwitcher scheduler={scheduler} currentId={item?.id} pick={pick} now={now} />
          {!item ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              {loadState === "loading" ? "กำลังโหลดรายการแคมเปญ…" : "ยังไม่มีแคมเปญ สร้างแคมเปญได้ในแท็บมุมมองแอดมิน"}
            </Card>
          ) : (
          <CustomerView
            campaign={campaign}
            saleIndex={saleIndex}
            select={(i) => {
              setSelected(i);
              setNotice(null);
            }}
            upcoming={upcoming}
            blockedBy={blockedBy}
            state={state}
            product={product}
            you={you}
            expiredCount={expiredCount}
            loggedIn={loggedIn}
            login={() => setLoggedIn(true)}
            join={join}
            leave={() => onCampaign((c) => leaveCampaign(c, saleIndex))}
            notice={notice}
            openPay={() => setPayOpen(true)}
          />
          )}
        </Tabs.Panel>

        <Tabs.Panel id="admin" className="pt-5">
          <div className="flex flex-col gap-5">
            {adminError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{adminError}</Alert.Title>
                  {loadState === "error" && (
                    <Alert.Description>
                      <button type="button" onClick={load} className="font-semibold underline">
                        ลองโหลดอีกครั้ง
                      </button>
                    </Alert.Description>
                  )}
                </Alert.Content>
              </Alert>
            )}
            <CampaignList
              items={scheduler.items}
              now={now}
              loading={loadState === "loading"}
              currentId={item?.id}
              pick={pick}
              startNow={startStored}
              endNow={endStored}
              remove={removeStored}
            />
            <CampaignSetup
              config={campaign.config}
              catalogue={catalogue}
              groups={groups}
              now={now}
              saving={saving}
              onCreate={createStored}
            />
            {item && /^[0-9a-f-]{36}$/i.test(item.id) && (
              <LiveMonitor
                key={item.id}
                campaignId={item.id}
                productNames={Object.fromEntries(item.config.products.map((p) => [p.slug, p.name]))}
              />
            )}
            {item?.campaign ? (
              <>
                <h3 className="-mb-2 mt-2 text-sm font-semibold text-slate-500">จำลองด้วยบอท (ไม่ใช่ข้อมูลจริง)</h3>
                <AdminView campaign={item.campaign} />
              </>
            ) : (
              <Card className="p-6 text-center text-sm text-slate-500">
                {!item
                  ? loadState === "loading"
                    ? "กำลังโหลด…"
                    : "ยังไม่มีแคมเปญ"
                  : item.status === "ended"
                    ? `แคมเปญ "${item.config.title}" ถูกยกเลิกก่อนเริ่มขาย`
                    : `แคมเปญ "${item.config.title}" จะเปิดขายอัตโนมัติ ${thaiDateTime(item.startsAt)} (อีก ${countdown(item.startsAt - now)}) — ตัวเลขการขายจะแสดงที่นี่เมื่อเริ่มแล้ว`}
              </Card>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      <PaymentModal
        isOpen={payOpen && Boolean(item)}
        setOpen={setPayOpen}
        entry={you}
        state={state}
        product={product}
        pay={() => {
          if (!item?.campaign || !you) return;
          const { next, reason } = payCampaign(item.campaign, saleIndex, you.id);
          setScheduler((s) => updateCampaign(s, item.id, () => next));
          if (reason) setNotice(reason);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ controls */

function DemoControls({
  nowMs: clock,
  shopifyDown,
  speed,
  setSpeed,
  running,
  setRunning,
  reset,
  toggleShopify,
}: {
  nowMs: number;
  shopifyDown: boolean;
  speed: number;
  setSpeed: (s: (typeof SPEEDS)[number]) => void;
  running: boolean;
  setRunning: (r: boolean) => void;
  reset: () => void;
  toggleShopify: () => void;
}) {
  const time = new Date(clock).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
  const date = new Date(clock).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return (
    <Card variant="secondary" className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-brand-ink">ตัวควบคุมเดโม</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs tabular-nums text-slate-600 ring-1 ring-surface-line" suppressHydrationWarning>
          นาฬิกาเดโม {date} {time}
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
        <Button size="sm" variant="secondary" onPress={() => setRunning(!running)}>
          {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {running ? "หยุดเวลา" : "เดินเวลาต่อ"}
        </Button>
        <Button size="sm" variant={shopifyDown ? "danger" : "secondary"} onPress={toggleShopify}>
          <ServerCrash size={14} aria-hidden /> {shopifyDown ? "Shopify ล่มอยู่ (กดเพื่อกู้)" : "จำลอง Shopify ล่ม"}
        </Button>
        <Button size="sm" variant="ghost" onPress={reset}>
          <RotateCcw size={14} aria-hidden /> โหลดใหม่ / เริ่มจำลองใหม่
        </Button>
      </div>
    </Card>
  );
}

/** Customer side: which campaign to look at (what a shopper would see on the day). */
function CampaignSwitcher({ scheduler, currentId, pick, now }: { scheduler: SchedulerState; currentId?: string; pick: (id: string) => void; now: number }) {
  if (scheduler.items.length < 2) return null;
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="เลือกแคมเปญ">
      {scheduler.items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => pick(i.id)}
          aria-pressed={i.id === currentId}
          className={`flex min-h-10 max-w-[260px] shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold ring-1 ${
            i.id === currentId ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-slate-600 ring-surface-line hover:bg-surface-mist"
          }`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${i.status === "running" ? "bg-rose-500" : i.status === "scheduled" ? "bg-amber-400" : "bg-slate-300"}`}
            aria-hidden
          />
          <span className="truncate">{i.config.title}</span>
          <span className={`shrink-0 font-normal ${i.id === currentId ? "text-white/80" : "text-slate-400"}`} suppressHydrationWarning>
            {i.status === "running" ? "กำลังขาย" : i.status === "scheduled" ? `อีก ${countdown(i.startsAt - now)}` : "จบแล้ว"}
          </span>
        </button>
      ))}
    </div>
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
  campaign,
  saleIndex,
  select,
  upcoming,
  blockedBy,
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
  campaign: CampaignState;
  saleIndex: number;
  select: (i: number) => void;
  upcoming?: { at: string; left: string };
  blockedBy: string | null;
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
  const windowMinutes = Math.round(state.sale.windowSeconds / 60);
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

      {campaign.sales.length > 1 && <ProductPicker campaign={campaign} saleIndex={saleIndex} select={select} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="relative aspect-[16/10] bg-white sm:aspect-square xl:aspect-[16/9] 2xl:aspect-square">
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
                  <Users size={16} className="shrink-0 text-brand-800" aria-hidden /> 1 บัญชีซื้อได้ 1 ชิ้น{campaign.sales.length > 1 ? "ต่อแคมเปญ" : ""}
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-brand-800" aria-hidden /> ถึงคิวแล้วมีเวลาชำระเงิน {windowMinutes} นาที
                </li>
                <li className="flex items-center gap-2">
                  <RotateCcw size={16} className="shrink-0 text-brand-800" aria-hidden /> ชำระไม่ทันกลับเข้าคิวได้ {state.sale.maxRequeue} ครั้ง
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="xl:sticky xl:top-40">
          <ActionPanel
            upcoming={upcoming}
            blockedBy={blockedBy}
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
  upcoming,
  blockedBy,
  state,
  you,
  expiredCount,
  loggedIn,
  login,
  join,
  leave,
  openPay,
}: {
  upcoming?: { at: string; left: string };
  blockedBy: string | null;
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
  if (upcoming) {
    return (
      <PanelShell>
        <Chip color="warning" variant="soft" size="sm">
          เร็ว ๆ นี้
        </Chip>
        <p className="mt-3 text-sm text-slate-600">เปิดขาย {upcoming.at}</p>
        <p className="text-4xl font-extrabold tabular-nums text-brand-ink" suppressHydrationWarning>
          {upcoming.left}
        </p>
        <Button fullWidth size="lg" className="mt-5" isDisabled>
          เข้าคิว
        </Button>
        {!loggedIn ? (
          <Button fullWidth variant="secondary" className="mt-2" onPress={login}>
            เข้าสู่ระบบไว้ก่อน
          </Button>
        ) : (
          <p className="mt-2 text-center text-xs text-slate-500">เข้าสู่ระบบแล้ว · ถึงเวลาเปิดขาย ปุ่มเข้าคิวจะกดได้ทันที</p>
        )}
      </PanelShell>
    );
  }

  if (sale.status === "closed" && status !== "reserved" && status !== "paid") {
    return (
      <PanelShell>
        <h3 className="text-xl font-bold text-brand-ink">ปิดการขายแล้ว</h3>
        <p className="mt-1 text-sm text-slate-600">หมดช่วงเวลาของแคมเปญนี้ ขอบคุณที่ร่วมกิจกรรม ติดตามรอบถัดไปทาง LINE</p>
      </PanelShell>
    );
  }

  if (blockedBy && sale.status !== "sold_out") {
    return (
      <PanelShell>
        <Chip color="default" variant="soft" size="sm">
          ใช้สิทธิ์ในแคมเปญนี้แล้ว
        </Chip>
        <h3 className="mt-3 text-lg font-bold text-brand-ink">คุณเข้าคิวสินค้าอื่นในแคมเปญนี้อยู่</h3>
        <p className="mt-1 text-sm text-slate-600">
          {blockedBy} — แคมเปญนี้ 1 บัญชีซื้อได้ 1 ชิ้น ถ้ายังรอคิวอยู่และอยากเปลี่ยนสินค้า ให้ออกจากคิวเดิมก่อน
        </p>
      </PanelShell>
    );
  }

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
                  <Timer size={16} aria-hidden /> เหลือเวลา {mmss((entry!.expiresAt ?? 0) - state.now)} นาที
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
  closed: "bg-slate-500",
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

/** Customer side: every product in the campaign, with its own stock. */
function ProductPicker({ campaign, saleIndex, select }: { campaign: CampaignState; saleIndex: number; select: (i: number) => void }) {
  const active = yourActive(campaign);
  return (
    <section className="mb-5" aria-label="เลือกสินค้าในแคมเปญ">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-brand-ink">{campaign.config.title}</h2>
        <p className="text-sm text-slate-500">
          {campaign.sales.length} สินค้า · 1 บัญชีซื้อได้ 1 ชิ้นต่อแคมเปญ
        </p>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-4 2xl:grid-cols-6">
        {campaign.sales.map((s, i) => {
          const left = s.sale.total - s.sale.sold;
          const isSelected = i === saleIndex;
          const mine = active?.saleIndex === i;
          return (
            <button
              key={s.product.slug}
              type="button"
              onClick={() => select(i)}
              aria-pressed={isSelected}
              className={`relative flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl2 bg-white text-left ring-1 transition md:w-auto ${
                isSelected ? "ring-2 ring-brand-800" : "ring-surface-line hover:ring-brand-800/40"
              }`}
            >
              <span className="relative block aspect-square bg-white">
                <Image src={s.product.image} alt="" fill sizes="160px" className="object-contain p-3" />
                {s.sale.status === "sold_out" && (
                  <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-slate-600">หมดแล้ว</span>
                )}
                {mine && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand-800 px-2 py-0.5 text-[10px] font-bold text-white">คิวของคุณ</span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-2.5">
                <span className="line-clamp-2 text-xs font-medium leading-snug text-brand-ink">{s.product.name}</span>
                <span className="mt-auto flex items-baseline justify-between gap-1">
                  <span className="text-sm font-bold text-sale">{formatTHB(s.product.price)}</span>
                  <span className="text-[11px] text-slate-500">
                    เหลือ {left}/{s.sale.total}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdminView({ campaign }: { campaign: CampaignState }) {
  const [focus, setFocus] = useState<number | "all">("all");
  const sales = focus === "all" ? campaign.sales : [campaign.sales[Math.min(focus, campaign.sales.length - 1)]];
  const sum = (f: (s: SaleState) => number) => sales.reduce((t, s) => t + f(s), 0);
  const total = sum((s) => s.sale.total);
  const reservedCount = sum((s) => s.sale.reserved);
  const soldCount = sum((s) => s.sale.sold);
  const waitingCount = sum((s) => metrics(s).waiting);
  const free = sum((s) => available(s));
  const now = campaign.sales[0]?.now ?? 0;

  const reserved = sales
    .flatMap((s) => s.entries.filter((e) => e.status === "reserved").map((e) => ({ e, s })))
    .sort((a, b) => (a.e.expiresAt ?? 0) - (b.e.expiresAt ?? 0));
  const failed = campaign.sales.flatMap((s) => s.entries.filter((e) => e.status === "paid" && e.sync === "failed"));
  const log = focus === "all" ? campaignLog(campaign) : campaignLog({ ...campaign, sales }).slice(0, 40);

  const all = sales.map((s) => ({ s, m: metrics(s) }));
  const customers = all.reduce((t, x) => t + x.m.customers, 0);
  const paid = sales.flatMap((s) => s.entries.filter((e) => e.status === "paid"));
  const avgPay = paid.length ? paid.reduce((t, e) => t + ((e.paidAt ?? 0) - (e.reservedAt ?? 0)), 0) / paid.length : 0;
  const cfg = campaign.config;

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

      {campaign.sales.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="ดูข้อมูลสินค้า">
          {[{ key: "all" as const, label: `ทั้งแคมเปญ (${campaign.sales.length})` }, ...campaign.sales.map((s, i) => ({ key: i, label: s.product.name }))].map((o) => (
            <button
              key={String(o.key)}
              type="button"
              onClick={() => setFocus(o.key)}
              aria-pressed={focus === o.key}
              className={`min-h-9 max-w-[220px] shrink-0 truncate rounded-full px-3.5 text-xs font-semibold ring-1 ${
                focus === o.key ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-slate-600 ring-surface-line hover:bg-surface-mist"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="รอในคิว" value={waitingCount} tone="text-brand-ink" />
        <Stat label="กำลังรอชำระเงิน" value={reservedCount} tone="text-amber-600" />
        <Stat label={`ขายแล้ว / ${total}`} value={soldCount} tone="text-brand-800" />
        <Stat label="สิทธิ์ว่าง" value={free} tone="text-slate-600" />
      </div>

      <Card className="p-5">
        <h3 className="mb-3 font-bold text-brand-ink">สต็อกแต่ละสินค้า</h3>
        <ul className="flex flex-col gap-3">
          {sales.map((s) => (
            <li key={s.product.slug}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-brand-ink">{s.product.name}</span>
                <Chip size="sm" variant="soft" color={s.sale.status === "open" ? "success" : s.sale.status === "sold_out" ? "default" : "warning"}>
                  {{ scheduled: "ยังไม่เปิด", open: `ขาย ${s.sale.sold}/${s.sale.total}`, sold_out: "ขายหมด", closed: `ปิดแล้ว ${s.sale.sold}/${s.sale.total}` }[s.sale.status]}
                </Chip>
              </div>
              <StockBar state={s} compact={sales.length > 1} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h3 className="font-bold text-brand-ink">กำลังรอชำระเงิน ({reserved.length})</h3>
          <p className="text-xs text-slate-500">เรียงจากคนที่ใกล้หมดเวลาที่สุด</p>
          {reserved.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">ยังไม่มีใครกำลังจอง</p>
          ) : (
            <ul className="mt-3 flex max-h-[420px] flex-col divide-y divide-surface-line overflow-y-auto pr-1">
              {reserved.map(({ e, s }) => {
                const left = (e.expiresAt ?? 0) - now;
                return (
                  <li key={`${s.product.slug}-${e.id}`} className="flex items-center gap-3 py-2.5">
                    <span className="w-10 shrink-0 text-xs tabular-nums text-slate-500">#{e.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${e.isYou ? "font-bold text-brand-800" : "text-brand-ink"}`}>
                        {e.isYou ? "คุณ (บัญชีทดลอง)" : e.name}
                        {e.requeueCount > 0 && <span className="ml-1.5 text-xs text-slate-400">เข้าคิวรอบ {e.requeueCount + 1}</span>}
                      </span>
                      {sales.length > 1 && <span className="block truncate text-[11px] text-slate-400">{s.product.name}</span>}
                    </span>
                    <div className="hidden w-24 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div className={`h-full ${left < 180 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${(left / s.sale.windowSeconds) * 100}%` }} />
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
            {log.map((l) => (
              <li key={l.key} className="flex gap-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LOG_TONE[l.kind]}`} aria-hidden />
                <span className="w-12 shrink-0 tabular-nums text-xs leading-5 text-slate-400">{mmss(l.at)}</span>
                <span className="min-w-0">
                  <span className={l.isYou ? "font-semibold text-brand-800" : "text-slate-700"}>{l.text}</span>
                  {campaign.sales.length > 1 && focus === "all" && <span className="block truncate text-[11px] text-slate-400">{l.product}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-brand-ink">สรุปผลการขาย</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            ["ลูกค้าที่เข้าคิว", `${customers} คน`],
            ["อัตราซื้อจริง", customers ? `${Math.round((soldCount / customers) * 100)}%` : "-"],
            ["เวลาเฉลี่ยได้สิทธิ์ → จ่าย", avgPay ? `${mmss(avgPay)} นาที` : "-"],
            ["หมดเวลาไม่จ่าย", `${all.reduce((t, x) => t + x.m.expired, 0)} ครั้ง`],
            ["กลับเข้าคิวใหม่", `${all.reduce((t, x) => t + x.m.requeues, 0)} ครั้ง`],
            ["ออเดอร์ค้างสร้างไม่สำเร็จ", `${all.reduce((t, x) => t + x.m.syncFailed, 0)} ราย`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl2 bg-surface-soft p-3">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-brand-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          แคมเปญ: {cfg.mode === "single" ? "สินค้าชิ้นเดียว" : "กลุ่มสินค้า"} · สต็อก {cfg.stockPerProduct} ชิ้น/สินค้า · ชำระภายใน {cfg.windowMinutes} นาที · กลับเข้าคิวได้ {cfg.maxRequeue} ครั้ง
        </p>
      </Card>
    </div>
  );
}
