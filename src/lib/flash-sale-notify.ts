// "ถึงคิวคุณแล้ว" — the message that makes a flash-sale queue usable.
//
// A reservation is granted by the database (fs_settle / fs_sweep) and starts
// counting down immediately, whether or not the shopper still has the page
// open. Someone who queued, closed the tab and went back to work would lose
// their slot without ever knowing they had it. So each granted place gets one
// LINE message, and one reminder before it runs out.
//
// Both are stamped on the row rather than counted, so a retry after a failed
// push cannot send the message twice.
import { getProductBySlug } from "@/data/products";
import { lineOpenLink, linePushConfigured, pushLineText } from "@/lib/line-push";
import { pgValue, supabaseRest } from "@/lib/supabase-server";

type QueueRow = {
  id: string;
  user_id: string;
  campaign_id: string;
  expires_at: string | null;
  flash_sales: { product_slug: string } | null;
  flash_sale_campaigns: { title: string } | null;
};

const SELECT = "id,user_id,campaign_id,expires_at,flash_sales(product_slug),flash_sale_campaigns(title)";

/** Minutes left, rounded down, never negative. */
function minutesLeft(expiresAt: string | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 60000));
}

async function lineIdFor(userId: string): Promise<string | null> {
  const [identity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.line&select=provider_uid&limit=1`
  ).catch((): { provider_uid: string }[] => []);
  return identity?.provider_uid ?? null;
}

function productName(row: QueueRow) {
  const slug = row.flash_sales?.product_slug;
  return (slug && getProductBySlug(slug)?.name) || row.flash_sale_campaigns?.title || "สินค้า Flash Sale";
}

/** Marks the row so the same reservation is never messaged twice. */
async function stamp(id: string, column: "notified_at" | "expiry_warned_at") {
  await supabaseRest(`flash_sale_queue?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ [column]: new Date().toISOString() }),
  });
}

export type NotifyResult = { granted: number; expiring: number; skipped: number };

/**
 * One pass: tell everyone whose turn just came, then nudge anyone about to
 * lose their slot. Runs every minute from cron — a reservation window is a
 * few minutes, so a minute's granularity is the useful resolution.
 */
export async function notifyQueue(warnWithinMinutes = 3): Promise<NotifyResult> {
  if (!linePushConfigured()) return { granted: 0, expiring: 0, skipped: 0 };

  const nowIso = new Date().toISOString();
  let granted = 0;
  let expiring = 0;
  let skipped = 0;

  // 1. Your turn. Only reservations that still have time left: telling someone
  //    about a slot that has already expired is worse than saying nothing.
  const fresh = await supabaseRest<QueueRow[]>(
    `flash_sale_queue?status=eq.reserved&notified_at=is.null&expires_at=gt.${pgValue(nowIso)}&select=${SELECT}&limit=200`
  ).catch((): QueueRow[] => []);

  for (const row of fresh) {
    const lineId = await lineIdFor(row.user_id);
    if (!lineId) {
      // No LINE account linked: stamp anyway, so the row is not retried every
      // minute for the life of the reservation.
      await stamp(row.id, "notified_at");
      skipped += 1;
      continue;
    }
    const sent = await pushLineText(
      lineId,
      `🎉 ถึงคิวคุณแล้ว — ${productName(row)}\n` +
        `กันของไว้ให้ ${minutesLeft(row.expires_at)} นาที ชำระเงินภายในเวลานี้เพื่อรับสิทธิ์\n` +
        lineOpenLink(`/flash-sale/${row.campaign_id}`)
    );
    if (sent) granted += 1;
    else skipped += 1;
    await stamp(row.id, "notified_at");
  }

  // 2. About to lose it. One nudge, only to people already told their turn came.
  const deadline = new Date(Date.now() + warnWithinMinutes * 60_000).toISOString();
  const soon = await supabaseRest<QueueRow[]>(
    `flash_sale_queue?status=eq.reserved&notified_at=not.is.null&expiry_warned_at=is.null&expires_at=gt.${pgValue(
      nowIso
    )}&expires_at=lt.${pgValue(deadline)}&select=${SELECT}&limit=200`
  ).catch((): QueueRow[] => []);

  for (const row of soon) {
    const lineId = await lineIdFor(row.user_id);
    if (lineId) {
      const sent = await pushLineText(
        lineId,
        `⏳ เหลือเวลาอีก ${Math.max(1, minutesLeft(row.expires_at))} นาที — ${productName(row)}\n` +
          `ถ้าไม่ชำระเงินทัน สิทธิ์จะถูกส่งต่อให้คิวถัดไป\n` +
          lineOpenLink(`/flash-sale/${row.campaign_id}`)
      );
      if (sent) expiring += 1;
    }
    await stamp(row.id, "expiry_warned_at");
  }

  return { granted, expiring, skipped };
}
