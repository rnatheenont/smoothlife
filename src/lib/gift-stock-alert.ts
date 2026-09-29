// Telling somebody a gift is running out, once.
//
// The console shows the shelf to anyone who opens the page, and nobody opens
// the page until something has already gone wrong: on the day this was written
// seven of the shop's twenty-five gifts were at zero while campaigns were
// still handing them out, and the way that was found was by reading orders one
// at a time.
//
// So the check runs on its own each morning and reports a *crossing* — the day
// a gift falls under the line — rather than the state. A list of the same seven
// gifts every morning is a mail nobody reads by the third day, which is the
// same as not sending it.
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { freeGiftProducts, type GiftStockItem } from "@/lib/shopify-admin";
import { emailConfigured, sendEmail } from "@/lib/email";

/** Under this many, a gift is worth chasing before the next campaign leans on it. */
export const LOW_STOCK = 10;

type Level = "low" | "out";
type AlertRow = { variant_id: string; level: Level; stock_at_alert: number };

const levelOf = (stock: number): Level | null => (stock <= 0 ? "out" : stock < LOW_STOCK ? "low" : null);

/** Names a gift the way a person would say it, not the way the catalogue files it. */
export const giftName = (t: string) => t.replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim() || t;

export type GiftStockAlertResult = {
  checked: number;
  newlyLow: GiftStockItem[];
  newlyOut: GiftStockItem[];
  recovered: number;
  emailed: string | null;
  skipped?: string;
};

function alertEmailHtml(out: GiftStockItem[], low: GiftStockItem[]): string {
  const row = (g: GiftStockItem) =>
    `<tr><td style="padding:6px 12px 6px 0">${giftName(g.title)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${
      g.stock <= 0 ? "หมด" : `เหลือ ${g.stock}`
    }</td></tr>`;
  const section = (title: string, items: GiftStockItem[]) =>
    items.length === 0
      ? ""
      : `<p style="margin:18px 0 6px;font-weight:700">${title}</p><table style="border-collapse:collapse;font-size:14px">${items
          .map(row)
          .join("")}</table>`;
  return `<div style="font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;color:#0f172a;line-height:1.6">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px">ของแถมใกล้หมด</p>
  <p style="margin:0;color:#475569;font-size:13px">แคมเปญที่ยังแจกของพวกนี้อยู่จะทำให้ลูกค้าได้ของไม่ครบ — ปิดหรือเปลี่ยนของแถมในแอปที่ตั้งไว้</p>
  ${section("หมดแล้ว", out)}
  ${section(`เหลือน้อยกว่า ${LOW_STOCK} ชิ้น`, low)}
  <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">แจ้งครั้งเดียวต่อของแถมหนึ่งชิ้น — จะแจ้งอีกครั้งก็ต่อเมื่อเติมของแล้วลดลงมาใหม่</p>
</div>`;
}

/**
 * Reads the shelf, reports what has newly fallen below the line, and remembers
 * what it said. Never throws: a cron that dies takes tomorrow's check with it.
 */
export async function checkGiftStock(): Promise<GiftStockAlertResult> {
  // DRAFT gifts are being prepared, not given away — four of the shop's are
  // drafts sitting at zero, and warning about those every time one is sketched
  // out is the noise that gets the whole mail filtered.
  const gifts = (await freeGiftProducts()).filter((g) => g.status !== "DRAFT");
  const empty: GiftStockAlertResult = { checked: gifts.length, newlyLow: [], newlyOut: [], recovered: 0, emailed: null };
  if (gifts.length === 0) return { ...empty, skipped: "ไม่พบของแถมใน Shopify" };

  const rows = await supabaseRest<AlertRow[]>("gift_stock_alerts?select=variant_id,level,stock_at_alert").catch(
    () => [] as AlertRow[]
  );
  const known = new Map<string, AlertRow>(rows.map((r) => [r.variant_id, r] as const));

  const newlyOut: GiftStockItem[] = [];
  const newlyLow: GiftStockItem[] = [];
  const recovered: string[] = [];

  for (const gift of gifts) {
    const level = levelOf(gift.stock);
    const said = known.get(gift.variantId);
    if (!level) {
      // Back above the line: forget it, so the next fall is news again.
      if (said) recovered.push(gift.variantId);
      continue;
    }
    // Only downwards. A gift already reported "low" that reaches zero is worth
    // saying again; one reported "out" that creeps back to nine is not.
    if (said && (said.level === level || said.level === "out")) continue;
    (level === "out" ? newlyOut : newlyLow).push(gift);
  }

  if (recovered.length > 0) {
    await supabaseRest(`gift_stock_alerts?variant_id=in.(${recovered.map(pgValue).join(",")})`, {
      method: "DELETE",
      returning: false,
    }).catch((err) => console.error("[gift-stock] clearing recovered alerts failed", err));
  }

  const fresh = [...newlyOut, ...newlyLow];
  if (fresh.length === 0) return { ...empty, recovered: recovered.length };

  await supabaseRest("gift_stock_alerts?on_conflict=variant_id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(
      fresh.map((g) => ({
        variant_id: g.variantId,
        level: levelOf(g.stock),
        stock_at_alert: g.stock,
        title: g.title,
        alerted_at: new Date().toISOString(),
      }))
    ),
  }).catch((err) => console.error("[gift-stock] recording alerts failed", err));

  const to = process.env.GIFT_STOCK_ALERT_EMAIL?.trim();
  if (!to || !emailConfigured()) {
    // The crossing is still recorded, so switching the address on later does
    // not produce a backlog of everything that ever happened.
    return { ...empty, newlyLow, newlyOut, recovered: recovered.length, skipped: "ยังไม่ได้ตั้ง GIFT_STOCK_ALERT_EMAIL" };
  }

  const subject =
    newlyOut.length > 0
      ? `ของแถมหมด ${newlyOut.length} รายการ${newlyLow.length ? ` · ใกล้หมดอีก ${newlyLow.length}` : ""}`
      : `ของแถมใกล้หมด ${newlyLow.length} รายการ`;
  await sendEmail(to, `${subject} — Smoothlife.com`, alertEmailHtml(newlyOut, newlyLow));

  return { ...empty, newlyLow, newlyOut, recovered: recovered.length, emailed: to };
}
