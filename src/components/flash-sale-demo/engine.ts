// In-browser simulation of the Flash Sale Queue plan (flash-sale-queue-plan.md).
// Nothing here talks to Supabase, 2C2P or Shopify: every rule of the real
// system is played out on invented data so the flow can be seen and clicked
// before anything is built.
//
// The rules mirror the plan section by section:
//   §3  flash_sale + sale_queue rows, per-sale queue positions
//   §4.1 join_queue: one active entry per customer, requeue limit
//   §4.2 grant_reservations: up to the remaining stock at once, in queue order
//   §4.3 expire_reservation: slot goes straight to the next person
//   §4.4 confirm_payment: only a live reservation can be paid, once
//   §8  Shopify order sync runs after payment and may fail and retry
// Time is simulated seconds, so a 15-minute window can be watched at ×30.

export type EntryStatus = "waiting" | "reserved" | "paid" | "expired" | "sold_out";
export type SyncStatus = "pending" | "synced" | "failed";
export type SaleStatus = "scheduled" | "open" | "sold_out";

export type Entry = {
  id: string;
  customerId: string;
  name: string;
  isYou: boolean;
  position: number;
  requeueCount: number;
  status: EntryStatus;
  joinedAt: number;
  reservedAt?: number;
  expiresAt?: number;
  paidAt?: number;
  paymentRef?: string;
  orderNo?: string;
  sync?: SyncStatus;
  syncAt?: number;
  syncAttempts?: number;
  // bot behaviour, decided when the bot gets its slot
  payAt?: number;
  willRequeue?: boolean;
};

export type LogKind = "join" | "reserve" | "pay" | "expire" | "requeue" | "sync" | "sync_failed" | "sold_out" | "open" | "reject";
export type LogEvent = { id: number; at: number; kind: LogKind; text: string; isYou?: boolean };

type Bot = { customerId: string; name: string; joinAt: number };

export type SaleState = {
  now: number;
  sale: {
    name: string;
    total: number;
    reserved: number;
    sold: number;
    nextPosition: number;
    windowSeconds: number;
    maxRequeue: number;
    status: SaleStatus;
    opensAt: number;
  };
  entries: Entry[];
  log: LogEvent[];
  pendingBots: Bot[];
  pendingRequeues: { customerId: string; name: string; at: number }[];
  shopifyDown: boolean;
  seq: number;
  rand: number; // PRNG state, so a reset replays the same story
};

export const YOU_ID = "you";

// Deterministic PRNG (mulberry32): the demo tells the same story every reset.
function next(state: SaleState): number {
  let t = (state.rand = (state.rand + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const FIRST = ["พิมพ์", "ณัฐ", "กมล", "ปวีณ", "ศิริ", "ธนา", "อรุณ", "มาลี", "วรร", "สุภา", "จิรา", "ชล", "นภา", "ปิยะ", "รัตน", "อัญ", "เบญ", "ภัท", "ดาว", "ฟ้า"];
const maskName = (i: number) => `คุณ${FIRST[i % FIRST.length]}***`;

export function createSale(opts?: { total?: number; bots?: number; opensIn?: number }): SaleState {
  const total = opts?.total ?? 25;
  const botCount = opts?.bots ?? 70;
  const opensAt = opts?.opensIn ?? 300;
  const state: SaleState = {
    now: 0,
    sale: {
      name: "Smooth E Gold Miracle — Flash Sale 25 ชิ้น",
      total,
      reserved: 0,
      sold: 0,
      nextPosition: 0,
      windowSeconds: 15 * 60,
      maxRequeue: 3,
      status: "scheduled",
      opensAt,
    },
    entries: [],
    log: [],
    pendingBots: [],
    pendingRequeues: [],
    shopifyDown: false,
    seq: 1,
    rand: 20260917,
  };
  // A rush in the first minute after opening, then a trickle for ~20 minutes.
  for (let i = 0; i < botCount; i++) {
    const rush = i < botCount * 0.6;
    const joinAt = opensAt + (rush ? next(state) * 60 : 60 + next(state) * 1200);
    state.pendingBots.push({ customerId: `c${1000 + i}`, name: maskName(i), joinAt });
  }
  state.pendingBots.sort((a, b) => a.joinAt - b.joinAt);
  return state;
}

function log(state: SaleState, kind: LogKind, text: string, isYou = false) {
  state.log.unshift({ id: state.seq++, at: state.now, kind, text, isYou });
  if (state.log.length > 200) state.log.length = 200;
}

const activeOf = (state: SaleState, customerId: string) =>
  state.entries.find((e) => e.customerId === customerId && (e.status === "waiting" || e.status === "reserved" || e.status === "paid"));

export const available = (state: SaleState) => state.sale.total - state.sale.reserved - state.sale.sold;

export type JoinResult = { ok: true; entry: Entry } | { ok: false; reason: string };

/** §4.1 join_queue — one active entry per customer, capped requeues. */
export function joinQueue(state: SaleState, customerId: string, name: string, isYou = false): JoinResult {
  if (state.sale.status === "scheduled") return { ok: false, reason: "ยังไม่เปิดขาย" };
  if (state.sale.status === "sold_out") return { ok: false, reason: "สินค้าหมดแล้ว" };
  if (activeOf(state, customerId)) return { ok: false, reason: "คุณอยู่ในคิวหรือมีสิทธิ์จองอยู่แล้ว" };
  const previous = state.entries.filter((e) => e.customerId === customerId && e.status === "expired").length;
  if (previous > state.sale.maxRequeue) {
    return { ok: false, reason: `กลับเข้าคิวได้สูงสุด ${state.sale.maxRequeue} ครั้งต่อการขายนี้` };
  }
  state.sale.nextPosition += 1;
  const entry: Entry = {
    id: `q${state.seq++}`,
    customerId,
    name,
    isYou,
    position: state.sale.nextPosition,
    requeueCount: previous,
    status: "waiting",
    joinedAt: state.now,
  };
  state.entries.push(entry);
  log(state, previous ? "requeue" : "join", `${isYou ? "คุณ" : name} ${previous ? "กลับเข้าคิว" : "เข้าคิว"} ลำดับที่ ${entry.position}`, isYou);
  return { ok: true, entry };
}

/** §4.2 grant_reservations — hand out every free slot, in queue order. */
function grantReservations(state: SaleState) {
  let free = available(state);
  if (free <= 0) return;
  const waiting = state.entries.filter((e) => e.status === "waiting").sort((a, b) => a.position - b.position);
  for (const e of waiting) {
    if (free <= 0) break;
    e.status = "reserved";
    e.reservedAt = state.now;
    e.expiresAt = state.now + state.sale.windowSeconds;
    state.sale.reserved += 1;
    free -= 1;
    if (!e.isYou) {
      // Most people pay within a few minutes; some never do.
      if (next(state) < 0.62) e.payAt = state.now + 45 + next(state) * 600;
      e.willRequeue = next(state) < 0.55;
    }
    log(state, "reserve", `${e.isYou ? "คุณ" : e.name} ได้สิทธิ์จอง (ลำดับ ${e.position}) — มีเวลา 15 นาที`, e.isYou);
  }
}

/** §4.4 confirm_payment — only a live, unpaid reservation; then the Shopify sync starts. */
export function confirmPayment(state: SaleState, entryId: string): { ok: boolean; reason?: string } {
  const e = state.entries.find((x) => x.id === entryId);
  if (!e || e.status !== "reserved") return { ok: false, reason: "สิทธิ์จองนี้ใช้ไม่ได้แล้ว" };
  if ((e.expiresAt ?? 0) <= state.now) return { ok: false, reason: "หมดเวลาชำระเงินแล้ว" };
  e.status = "paid";
  e.paidAt = state.now;
  e.paymentRef = `2C2P-${(100000 + state.seq * 7919).toString().slice(-6)}`;
  e.sync = "pending";
  e.syncAt = state.now + 4;
  e.syncAttempts = 0;
  state.sale.reserved -= 1;
  state.sale.sold += 1;
  log(state, "pay", `${e.isYou ? "คุณ" : e.name} ชำระเงินสำเร็จ (${e.paymentRef})`, e.isYou);
  return { ok: true };
}

/** Leave the queue before your turn (frees nothing: waiting rows hold no stock). */
export function leaveQueue(state: SaleState, customerId: string) {
  const e = state.entries.find((x) => x.customerId === customerId && x.status === "waiting");
  if (!e) return;
  state.entries = state.entries.filter((x) => x !== e);
}

/** One simulated step of `dt` seconds: arrivals, payments, expiries, grants, sync. */
export function tick(state: SaleState, dt: number): SaleState {
  const s: SaleState = { ...state, sale: { ...state.sale }, entries: state.entries.map((e) => ({ ...e })), log: [...state.log], pendingBots: [...state.pendingBots], pendingRequeues: [...state.pendingRequeues] };
  s.now = state.now + dt;

  if (s.sale.status === "scheduled" && s.now >= s.sale.opensAt) {
    s.sale.status = "open";
    log(s, "open", "เปิดขายแล้ว — เข้าคิวได้");
  }

  if (s.sale.status === "open") {
    while (s.pendingBots.length && s.pendingBots[0].joinAt <= s.now) {
      const b = s.pendingBots.shift()!;
      joinQueue(s, b.customerId, b.name);
    }
    s.pendingRequeues = s.pendingRequeues.filter((r) => {
      if (r.at > s.now) return true;
      joinQueue(s, r.customerId, r.name);
      return false;
    });

    for (const e of s.entries) {
      if (e.status === "reserved" && !e.isYou && e.payAt !== undefined && e.payAt <= s.now && (e.expiresAt ?? 0) > s.now) {
        confirmPayment(s, e.id);
      }
    }

    // §4.3 + §7 lazy expiry: anything past its window is released first.
    for (const e of s.entries) {
      if (e.status === "reserved" && (e.expiresAt ?? 0) <= s.now) {
        e.status = "expired";
        s.sale.reserved -= 1;
        log(s, "expire", `${e.isYou ? "คุณ" : e.name} ชำระเงินไม่ทัน — คืนสิทธิ์ให้คิวถัดไป`, e.isYou);
        if (!e.isYou && e.willRequeue) s.pendingRequeues.push({ customerId: e.customerId, name: e.name, at: s.now + 20 + next(s) * 60 });
      }
    }

    grantReservations(s);

    if (s.sale.sold >= s.sale.total) {
      s.sale.status = "sold_out";
      for (const e of s.entries) if (e.status === "waiting") e.status = "sold_out";
      s.pendingBots = [];
      s.pendingRequeues = [];
      log(s, "sold_out", `ขายครบ ${s.sale.total} ชิ้นแล้ว — ปิดรับคิว`);
    }
  }

  // §5 / §8 Shopify order creation, outside the payment step; retries when it fails.
  for (const e of s.entries) {
    if (e.status !== "paid" || e.sync === "synced" || (e.syncAt ?? 0) > s.now) continue;
    e.syncAttempts = (e.syncAttempts ?? 0) + 1;
    if (s.shopifyDown) {
      e.sync = "failed";
      e.syncAt = s.now + 30;
      if (e.syncAttempts === 1) log(s, "sync_failed", `สร้างออเดอร์ Shopify ไม่สำเร็จ (${e.paymentRef}) — จะลองใหม่อัตโนมัติ`, e.isYou);
    } else {
      e.sync = "synced";
      e.orderNo = `#SL${String(24000 + s.seq++).padStart(6, "0")}`;
      log(s, "sync", `สร้างออเดอร์ ${e.orderNo} ใน Shopify แล้ว${e.syncAttempts > 1 ? ` (ลองครั้งที่ ${e.syncAttempts})` : ""}`, e.isYou);
    }
  }

  return s;
}

/** Demo control: open the sale now, bringing every simulated arrival forward with it. */
export function openNow(state: SaleState): SaleState {
  const shift = state.sale.opensAt - state.now;
  if (state.sale.status !== "scheduled" || shift <= 0) return state;
  return tick(
    {
      ...state,
      sale: { ...state.sale, opensAt: state.now },
      pendingBots: state.pendingBots.map((b) => ({ ...b, joinAt: b.joinAt - shift })),
    },
    0
  );
}

/** Mutating helpers need a copy, so React sees a new state. */
export function mutate(state: SaleState, fn: (s: SaleState) => void): SaleState {
  const s: SaleState = { ...state, sale: { ...state.sale }, entries: state.entries.map((e) => ({ ...e })), log: [...state.log], pendingBots: [...state.pendingBots], pendingRequeues: [...state.pendingRequeues] };
  fn(s);
  // join/leave/pay can free or claim slots right away (§4.2 is called after each)
  if (s.sale.status === "open") grantReservations(s);
  return s;
}

/** §11.4 report numbers, from the rows alone. */
export function metrics(state: SaleState) {
  const customers = new Set(state.entries.map((e) => e.customerId)).size;
  const paid = state.entries.filter((e) => e.status === "paid");
  const expired = state.entries.filter((e) => e.status === "expired").length;
  const requeues = state.entries.filter((e) => e.requeueCount > 0).length;
  const avgPay = paid.length ? paid.reduce((t, e) => t + ((e.paidAt ?? 0) - (e.reservedAt ?? 0)), 0) / paid.length : 0;
  return {
    customers,
    waiting: state.entries.filter((e) => e.status === "waiting").length,
    conversion: customers ? state.sale.sold / customers : 0,
    avgPaySeconds: avgPay,
    expired,
    requeues,
    syncFailed: paid.filter((e) => e.sync === "failed").length,
  };
}

export const mmss = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
