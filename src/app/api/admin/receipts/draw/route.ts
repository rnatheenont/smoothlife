import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";

// Drawing the prizes, once, in a way that can be checked afterwards.
//
// The two prizes are decided by different things and must not share code.
// VIP is first come first serve — an ordering, no randomness, the same answer
// every time it is computed. Lucky Fan is a weighted draw, where more entries
// means more tickets in the bag and nothing is guaranteed.
//
// Randomness comes from crypto.randomInt, not Math.random: the difference
// matters the day someone asks whether the shop picked its own winners. What
// makes that answerable is not the generator, though — it is the record written
// alongside the result: how many tickets were in the bag, how many people, and
// the order everyone came out in, winners and reserves alike.
//
// Results are frozen into receipt_campaign_winners rather than recomputed,
// because an entry approved after the announcement would otherwise quietly
// change a result that has already been published.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which campaign this console is looking at; the first one when unstated. */
const campaignOf = (req: NextRequest) => campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));
const WINNERS = 25;
const RESERVES = 10;
/** Winners have until the end of 5 Nov 2569 to claim. */
const CONFIRM_DEADLINE = "2026-11-05T23:59:59+07:00";

type Approved = {
  user_id: string;
  computed_entries: number;
  entries_override: number | null;
  created_at: string;
  payment_transactions: { confirmed_at: string | null } | null;
};

const entriesOf = (r: Approved) => r.entries_override ?? r.computed_entries;

async function approvedEntries(CAMPAIGN: string): Promise<Approved[]> {
  return supabaseRest<Approved[]>(
    `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&status=eq.approved` +
      `&select=user_id,computed_entries,entries_override,created_at,payment_transactions(confirmed_at)` +
      `&order=created_at.asc&limit=5000`
  ).catch(() => [] as Approved[]);
}

/**
 * Weighted, without replacement, at the level of people rather than tickets.
 *
 * Every entry is a ticket, so someone with three is three times as likely to
 * come out first. Once they do, all of their remaining tickets leave the bag:
 * the prize is per person, and leaving them in would mean drawing the same name
 * again and skipping it, which quietly lowers everyone else's odds by a
 * different amount depending on how many tickets the winner held.
 */
export function weightedDraw(pool: { userId: string; entries: number }[], take: number) {
  const tickets: string[] = [];
  for (const p of pool) for (let i = 0; i < p.entries; i++) tickets.push(p.userId);

  const picked: string[] = [];
  const bag = [...tickets];
  while (picked.length < take && bag.length > 0) {
    const winner = bag[randomInt(bag.length)];
    picked.push(winner);
    for (let i = bag.length - 1; i >= 0; i--) if (bag[i] === winner) bag.splice(i, 1);
  }
  return { picked, ticketCount: tickets.length };
}

export async function POST(req: NextRequest) {
  const CAMPAIGN = campaignOf(req);
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const prizeType = body?.prizeType;
  if (prizeType !== "vip" && prizeType !== "lucky_fan") {
    return NextResponse.json({ ok: false, error: "prizeType ต้องเป็น vip หรือ lucky_fan" }, { status: 400 });
  }

  // Drawing twice would replace a published result. Clearing is its own,
  // deliberate action.
  const existing = await supabaseRest<{ id: string }[]>(
    `receipt_campaign_winners?campaign_key=eq.${CAMPAIGN}&prize_type=eq.${prizeType}&select=id&limit=1`
  ).catch(() => []);
  if (existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "ประกาศผลรางวัลนี้ไปแล้ว — ต้องล้างผลเดิมก่อนถึงจะจับใหม่ได้" },
      { status: 409 }
    );
  }

  const rows = await approvedEntries(CAMPAIGN);
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่มีใบเสร็จที่อนุมัติแล้ว" }, { status: 409 });
  }

  const totals = new Map<string, { entries: number; firstAt: string }>();
  for (const r of rows) {
    const at = r.payment_transactions?.confirmed_at ?? r.created_at;
    const cur = totals.get(r.user_id);
    if (cur) {
      cur.entries += entriesOf(r);
      if (at < cur.firstAt) cur.firstAt = at;
    } else {
      totals.set(r.user_id, { entries: entriesOf(r), firstAt: at });
    }
  }

  let picked: string[];
  let ticketCount: number;
  if (prizeType === "vip") {
    // No randomness at all: whoever bought earliest, in order. One place each.
    picked = [...totals.entries()]
      .sort((a, b) => a[1].firstAt.localeCompare(b[1].firstAt))
      .slice(0, WINNERS + RESERVES)
      .map(([userId]) => userId);
    ticketCount = picked.length;
  } else {
    const draw = weightedDraw(
      [...totals.entries()].map(([userId, t]) => ({ userId, entries: t.entries })),
      WINNERS + RESERVES
    );
    picked = draw.picked;
    ticketCount = draw.ticketCount;
  }

  const adminId = getAdminSession(token)?.userId ?? null;

  // The record first: if writing the winners half-fails, what was drawn still
  // exists to compare against.
  await supabaseRest("receipt_campaign_draws", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      campaign_key: CAMPAIGN,
      prize_type: prizeType,
      ticket_count: ticketCount,
      entrant_count: totals.size,
      picked_user_ids: picked,
      drawn_by: adminId,
    }),
  });

  await supabaseRest("receipt_campaign_winners", {
    method: "POST",
    returning: false,
    body: JSON.stringify(
      picked.map((userId, i) => ({
        campaign_key: CAMPAIGN,
        prize_type: prizeType,
        rank: i + 1,
        user_id: userId,
        status: "pending_confirm",
        confirm_deadline: CONFIRM_DEADLINE,
      }))
    ),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: `receipt.draw.${prizeType}`,
      target: CAMPAIGN,
      detail: { entrants: totals.size, tickets: ticketCount, winners: Math.min(WINNERS, picked.length), picked },
    }),
  }).catch((err) => console.error("[receipts/draw] audit write failed", err));

  return NextResponse.json({
    ok: true,
    prizeType,
    entrants: totals.size,
    tickets: ticketCount,
    winners: picked.slice(0, WINNERS).length,
    reserves: Math.max(0, picked.length - WINNERS),
  });
}

/** Clearing a published result — deliberately its own action, never automatic. */
export async function DELETE(req: NextRequest) {
  const CAMPAIGN = campaignOf(req);
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const prizeType = req.nextUrl.searchParams.get("prizeType");
  if (prizeType !== "vip" && prizeType !== "lucky_fan") {
    return NextResponse.json({ ok: false, error: "prizeType ต้องเป็น vip หรือ lucky_fan" }, { status: 400 });
  }

  await supabaseRest(
    `receipt_campaign_winners?campaign_key=eq.${CAMPAIGN}&prize_type=eq.${pgValue(prizeType)}`,
    { method: "DELETE", returning: false }
  );
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({ action: `receipt.draw.clear.${prizeType}`, target: CAMPAIGN, detail: {} }),
  }).catch(() => {});

  // The draws table keeps its rows: what was drawn happened, even if the result
  // was thrown away, and that is the point of having it.
  return NextResponse.json({ ok: true });
}
