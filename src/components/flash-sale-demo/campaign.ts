// A flash-sale campaign: one product, or a group of products (a category, a
// brand, a Shopify collection) sold at the same time. In the real system each
// product is its own `flash_sale` row with its own stock and queue (plan §0:
// several sales can run at once, every query keyed by sale_id); the campaign
// only ties them together on one page and holds the one rule that spans them:
// a customer gets one piece per campaign, not one per product.

import {
  closeSale,
  confirmPayment,
  createSale,
  joinQueue,
  leaveQueue,
  mutate,
  openNow as openSaleNow,
  tick as tickSale,
  YOU_ID,
  type Entry,
  type JoinResult,
  type LogEvent,
  type SaleState,
} from "./engine";

export type DemoProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  compareAtPrice?: number;
};

export type CampaignConfig = {
  /** "single" = one product; "group" = every product in the chosen group. */
  mode: "single" | "group";
  title: string;
  products: DemoProduct[];
  stockPerProduct: number;
  windowMinutes: number;
  maxRequeue: number;
};

export type CampaignState = {
  config: CampaignConfig;
  now: number;
  sales: (SaleState & { product: DemoProduct })[];
  shopifyDown: boolean;
};

export const MAX_GROUP_PRODUCTS = 12;

/** `opensIn` 0 = the sale opens the moment the campaign starts (scheduled runs). */
export function createCampaign(config: CampaignConfig, opensIn = 0): CampaignState {
  const products = config.products.slice(0, MAX_GROUP_PRODUCTS);
  // Keep the whole demo to roughly 70–120 simulated shoppers.
  const botsPerSale = Math.max(12, Math.min(70, Math.round(Math.max(config.stockPerProduct * 2.8, 110 / products.length))));
  return {
    config: { ...config, products },
    now: 0,
    shopifyDown: false,
    sales: products.map((product, i) => ({
      ...createSale({
        name: product.name,
        total: config.stockPerProduct,
        bots: botsPerSale,
        windowSeconds: config.windowMinutes * 60,
        maxRequeue: config.maxRequeue,
        opensIn,
        seed: 20260917 + i * 7919,
      }),
      product,
    })),
  };
}

const withProduct = (next: SaleState, product: DemoProduct) => ({ ...next, product });

export function tickCampaign(c: CampaignState, dt: number): CampaignState {
  return {
    ...c,
    now: c.now + dt,
    sales: c.sales.map((s) => withProduct(tickSale({ ...s, shopifyDown: c.shopifyDown }, dt), s.product)),
  };
}

export function closeCampaign(c: CampaignState): CampaignState {
  return { ...c, sales: c.sales.map((s) => withProduct(closeSale(s), s.product)) };
}

export function openCampaignNow(c: CampaignState): CampaignState {
  return { ...c, sales: c.sales.map((s) => withProduct(openSaleNow(s), s.product)) };
}

/** Your active row anywhere in the campaign (waiting, reserved or paid). */
export function yourActive(c: CampaignState): { saleIndex: number; entry: Entry } | null {
  for (let i = 0; i < c.sales.length; i++) {
    const entry = c.sales[i].entries.find((e) => e.isYou && (e.status === "waiting" || e.status === "reserved" || e.status === "paid"));
    if (entry) return { saleIndex: i, entry };
  }
  return null;
}

export function joinCampaign(c: CampaignState, saleIndex: number): { next: CampaignState; result: JoinResult } {
  const active = yourActive(c);
  if (active && active.saleIndex !== saleIndex) {
    return {
      next: c,
      result: { ok: false, reason: "1 บัญชีซื้อได้ 1 ชิ้นต่อแคมเปญ — คุณมีคิวหรือสิทธิ์ในสินค้าอื่นของแคมเปญนี้อยู่แล้ว" },
    };
  }
  let result: JoinResult = { ok: false, reason: "" };
  const sales = c.sales.map((s, i) =>
    i === saleIndex ? withProduct(mutate(s, (m) => (result = joinQueue(m, YOU_ID, "คุณ", true))), s.product) : s
  );
  return { next: { ...c, sales }, result };
}

export function leaveCampaign(c: CampaignState, saleIndex: number): CampaignState {
  return { ...c, sales: c.sales.map((s, i) => (i === saleIndex ? withProduct(mutate(s, (m) => leaveQueue(m, YOU_ID)), s.product) : s)) };
}

export function payCampaign(c: CampaignState, saleIndex: number, entryId: string): { next: CampaignState; reason?: string } {
  let reason: string | undefined;
  const sales = c.sales.map((s, i) =>
    i === saleIndex
      ? withProduct(
          mutate(s, (m) => {
            const r = confirmPayment(m, entryId);
            if (!r.ok) reason = r.reason;
          }),
          s.product
        )
      : s
  );
  return { next: { ...c, sales }, reason };
}

export type CampaignLogEvent = LogEvent & { product: string; key: string };

/** Events from every product, newest first, for the admin log. */
export function campaignLog(c: CampaignState, limit = 40): CampaignLogEvent[] {
  return c.sales
    .flatMap((s, i) => s.log.slice(0, limit).map((l) => ({ ...l, product: s.product.name, key: `${i}-${l.id}` })))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
