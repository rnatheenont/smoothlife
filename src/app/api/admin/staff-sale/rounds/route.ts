import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";
import { ROUND_COLUMNS, parseRoundInput, type StaffRound } from "@/lib/staff-sale";

// Admin: the list of purchase rounds, and adding one.

type Counts = { verified: number; buyers: number; sold_thb: number; pending: number };

export async function GET(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const rounds = await supabaseRest<StaffRound[]>(
    `staff_rounds?select=${ROUND_COLUMNS}&order=starts_at.desc&limit=200`,
  );

  // The three numbers the list has to show per round, in two queries rather
  // than two per round: the console opens on this page and a round a month
  // adds up.
  const [verifications, orders] = await Promise.all([
    supabaseRest<{ round_id: string }[]>(`staff_verifications?select=round_id&limit=20000`).catch(
      () => [],
    ),
    supabaseRest<{ round_id: string; user_id: string; status: string; subtotal_thb: number }[]>(
      `staff_orders?select=round_id,user_id,status,subtotal_thb&limit=20000`,
    ).catch(() => []),
  ]);

  const counts = new Map<string, Counts>();
  const buyers = new Map<string, Set<string>>();
  const bump = (id: string) => {
    let c = counts.get(id);
    if (!c) counts.set(id, (c = { verified: 0, buyers: 0, sold_thb: 0, pending: 0 }));
    return c;
  };
  for (const v of verifications) bump(v.round_id).verified += 1;
  for (const o of orders) {
    const c = bump(o.round_id);
    if (o.status === "paid") {
      c.sold_thb += Number(o.subtotal_thb);
      if (!buyers.has(o.round_id)) buyers.set(o.round_id, new Set());
      buyers.get(o.round_id)!.add(o.user_id);
    }
    if (o.status === "pending") c.pending += 1;
  }
  for (const [id, set] of buyers) bump(id).buyers = set.size;

  return NextResponse.json({
    ok: true,
    rounds: rounds.map((r) => ({
      ...r,
      cap_thb: Number(r.cap_thb),
      stats: counts.get(r.id) ?? { verified: 0, buyers: 0, sold_thb: 0, pending: 0 },
    })),
    serverNow: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const parsed = parseRoundInput(await req.json().catch(() => null));
  if ("error" in parsed) return badRequest(parsed.error);

  const rows = await supabaseRest<StaffRound[]>(`staff_rounds?select=${ROUND_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify({ ...parsed.input, created_by: null, status: "draft" }),
  });
  const round = rows?.[0];
  if (!round) return NextResponse.json({ ok: false, error: "สร้างรอบไม่สำเร็จ" }, { status: 500 });

  // Created as a draft whatever the form said. A round opens from the list,
  // as its own decision, after somebody has looked at the price list — not
  // as a side effect of filling in a name and a date.
  await auditStaffSale(req, "staff_sale.round_create", round.id, {
    name: round.name,
    starts_at: round.starts_at,
    ends_at: round.ends_at,
    cap_thb: Number(round.cap_thb),
  });

  return NextResponse.json({ ok: true, round: { ...round, cap_thb: Number(round.cap_thb) } });
}
