import { supabaseRest } from "@/lib/supabase-server";

// Points expiry (plan section 9.2 / 1.1.4): each earned batch expires 12
// months after it was earned, FIFO per batch — not the whole balance at
// once. points_ledger.expires_at has existed since the original schema but
// nothing ever set or acted on it; this is that missing piece.
//
// Rather than requiring every earning code path (order webhook, review
// approval, birthday/migration bonus, checkin, admin adjustments, the
// welcome-bonus RPCs, ...) to correctly stamp expires_at on insert, this
// recomputes the FIFO state from full ledger history each run: walk every
// row chronologically, treat positive deltas as batches and negative
// deltas as consuming the oldest remaining batches first (redemptions,
// refunds, and — on replay — expire rows already inserted all behave the
// same way here). Whatever's left in a batch once its 12-month window has
// passed gets expired. This is O(rows per user) and safe to replay: an
// already-inserted 'expire' row for a batch just re-consumes that same
// now-empty batch on the next run, a no-op.
const POINTS_EXPIRY_DAYS = 365;
const BATCH_SIZE = 25; // same rationale as loyalty-cron: bound each run regardless of user count

type LedgerRow = { id: string; user_id: string; delta: number; reason: string; created_at: string };

function computeExpiredAmount(rows: LedgerRow[], now: number): { batchId: string; amount: number }[] {
  const batches: { id: string; remaining: number; expiresAt: number }[] = [];
  for (const row of rows) {
    if (row.delta > 0) {
      batches.push({ id: row.id, remaining: row.delta, expiresAt: new Date(row.created_at).getTime() + POINTS_EXPIRY_DAYS * 86_400_000 });
    } else if (row.delta < 0) {
      let toConsume = -row.delta;
      for (const b of batches) {
        if (toConsume <= 0) break;
        if (b.remaining <= 0) continue;
        const take = Math.min(b.remaining, toConsume);
        b.remaining -= take;
        toConsume -= take;
      }
    }
  }
  return batches.filter((b) => b.remaining > 0 && b.expiresAt <= now).map((b) => ({ batchId: b.id, amount: b.remaining }));
}

export async function expirePoints(): Promise<{ usersProcessed: number; totalExpired: number }> {
  // Only users with at least one ledger row that's actually old enough to
  // possibly need expiring, oldest-untouched-first so this cycles through
  // everyone over a few days regardless of how many users exist.
  const cutoff = new Date(Date.now() - POINTS_EXPIRY_DAYS * 86_400_000).toISOString();
  const candidates = await supabaseRest<{ user_id: string }[]>(
    `points_ledger?created_at=lte.${cutoff}&delta=gt.0&select=user_id&order=created_at.asc&limit=${BATCH_SIZE * 4}`
  );
  const userIds = [...new Set(candidates.map((c) => c.user_id))].slice(0, BATCH_SIZE);

  let totalExpired = 0;
  const now = Date.now();

  for (const userId of userIds) {
    const rows = await supabaseRest<LedgerRow[]>(
      `points_ledger?user_id=eq.${userId}&select=id,user_id,delta,reason,created_at&order=created_at.asc`
    );
    const expired = computeExpiredAmount(rows, now);
    for (const { batchId, amount } of expired) {
      await supabaseRest("points_ledger", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          user_id: userId,
          delta: -amount,
          reason: "expire",
          metadata: { expired_ledger_id: batchId },
        }),
      });
      totalExpired += amount;
    }
  }

  return { usersProcessed: userIds.length, totalExpired };
}
