import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";
import {
  ITEM_COLUMNS,
  discountedPrice,
  type StaffRoundTo,
  parseItemInput,
  type StaffRoundItem,
  MAX_PER_PERSON,
} from "@/lib/staff-sale";

// Admin: the price list of one round.
//
// POST adds or replaces rows (the product picker sends many at once), PATCH
// edits one row or re-prices the whole list, DELETE takes a row off.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as
    | { items?: unknown[]; copyFrom?: string }
    | null;

  // Starting a round from the last one. Each round carries its own products
  // at its own prices — that is the point of keeping them per round — but
  // in practice the next round is the last one with a few changes, and
  // retyping sixty prices to make those changes is how a price gets typed
  // wrong.
  if (body?.copyFrom) {
    const source = await supabaseRest<StaffRoundItem[]>(
      `staff_round_items?round_id=eq.${pgValue(body.copyFrom)}&select=${ITEM_COLUMNS}&limit=2000`,
    ).catch(() => []);
    if (!source?.length) return badRequest("รอบต้นทางยังไม่มีสินค้า");

    const existing = await supabaseRest<{ variant_id: string }[]>(
      `staff_round_items?round_id=eq.${pgValue(id)}&select=variant_id&limit=2000`,
    ).catch(() => []);
    const have = new Set((existing ?? []).map((r) => r.variant_id));

    // Copied, never counted: sold_qty and reserved_qty belong to the round
    // that sold them.
    const fresh = source
      .filter((i) => !have.has(i.variant_id))
      .map((i) => ({
        round_id: id,
        variant_id: i.variant_id,
        product_slug: i.product_slug,
        collection_handle: i.collection_handle,
        regular_price: Number(i.regular_price),
        staff_price: Number(i.staff_price),
        per_person_limit: i.per_person_limit,
        total_quota: i.total_quota,
        enabled: i.enabled,
        updated_at: new Date().toISOString(),
      }));

    if (fresh.length === 0) return badRequest("สินค้าทั้งหมดของรอบนั้นอยู่ในรอบนี้แล้ว");

    await supabaseRest(`staff_round_items`, {
      method: "POST",
      returning: false,
      body: JSON.stringify(fresh),
    });
    await auditStaffSale(req, "staff_sale.items_copy", id, {
      from_round: body.copyFrom,
      count: fresh.length,
      skipped: source.length - fresh.length,
    });
    return NextResponse.json({ ok: true, count: fresh.length, skipped: source.length - fresh.length });
  }

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return badRequest("ยังไม่ได้เลือกสินค้า");
  }
  if (body.items.length > 500) return badRequest("เพิ่มได้ครั้งละไม่เกิน 500 รายการ");

  const rows: Record<string, unknown>[] = [];
  for (const raw of body.items) {
    const parsed = parseItemInput(raw);
    if ("error" in parsed) return badRequest(parsed.error);
    rows.push({ round_id: id, ...parsed.input, updated_at: new Date().toISOString() });
  }
  const seen = new Set(rows.map((r) => r.variant_id as string));
  if (seen.size !== rows.length) return badRequest("มีตัวเลือกสินค้าซ้ำกันในรายการที่ส่งมา");

  // on_conflict so re-adding a product the admin already added is an edit
  // rather than an error — the picker does not know what is already in the
  // list, and it should not have to.
  const saved = await supabaseRest<StaffRoundItem[]>(
    `staff_round_items?on_conflict=round_id,variant_id&select=${ITEM_COLUMNS}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows),
    },
  );

  await auditStaffSale(req, "staff_sale.items_add", id, {
    count: rows.length,
    variants: rows.slice(0, 20).map((r) => r.variant_id),
  });

  return NextResponse.json({ ok: true, items: saved ?? [], count: rows.length });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("ข้อมูลไม่ถูกต้อง");

  // "Everything at X% off." Each row is re-priced from its own regular
  // price, and the number written is the final one — the percentage is not
  // stored anywhere, so nothing recalculates a price after it was quoted.
  if (body.bulk && typeof body.bulk === "object") {
    const bulk = body.bulk as Record<string, unknown>;
    const percent = Number(bulk.percent);
    const roundTo = Number(bulk.roundTo ?? 1);
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      return badRequest("ส่วนลดต้องอยู่ระหว่าง 1–99%");
    }
    // 0 = ไม่ปัด.
    if (roundTo !== 0 && roundTo !== 1 && roundTo !== 5 && roundTo !== 10) {
      return badRequest("การปัดเศษไม่ถูกต้อง");
    }

    const items = await supabaseRest<StaffRoundItem[]>(
      `staff_round_items?round_id=eq.${pgValue(id)}&select=id,variant_id,regular_price,staff_price&limit=2000`,
    );
    if (!items?.length) return badRequest("ยังไม่มีสินค้าในรอบนี้");

    const skipped: string[] = [];
    const updates = items
      .map((i) => {
        const price = discountedPrice(Number(i.regular_price), percent, roundTo as StaffRoundTo);
        // A row whose regular price is 0 has nothing to discount — a free
        // gift variant, or a product the catalogue has no price for yet.
        if (price <= 0 || Number(i.regular_price) <= 0) {
          skipped.push(i.variant_id);
          return null;
        }
        return { id: i.id, price };
      })
      .filter((u): u is { id: string; price: number } => u !== null);

    for (const u of updates) {
      await supabaseRest(`staff_round_items?id=eq.${pgValue(u.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ staff_price: u.price, updated_at: new Date().toISOString() }),
      });
    }

    await auditStaffSale(req, "staff_sale.items_reprice", id, {
      percent,
      roundTo,
      changed: updates.length,
      skipped: skipped.length,
    });

    return NextResponse.json({
      ok: true,
      changed: updates.length,
      skipped: skipped.length,
    });
  }

  // "จำกัดคนละ N ชิ้น ทุกอย่างในรอบ."
  //
  // Its own operation rather than 387 row saves: the limit is a rule about
  // the round, and typing it into every row is both an afternoon's work and
  // a guarantee that a few rows end up different from the rest by accident.
  // One filtered PATCH, so the rows cannot disagree.
  if (body.bulkLimit && typeof body.bulkLimit === "object") {
    const raw = (body.bulkLimit as Record<string, unknown>).perPersonLimit;
    let value: number | null;
    if (raw === null || raw === undefined || raw === "") {
      value = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) return badRequest("จำนวนจำกัดต่อคนต้องเป็นจำนวนเต็มตั้งแต่ 1");
      if (n > MAX_PER_PERSON) return badRequest(`จำนวนจำกัดต่อคนต้องไม่เกิน ${MAX_PER_PERSON} ชิ้น`);
      value = n;
    }

    const rows = await supabaseRest<{ id: string }[]>(
      `staff_round_items?round_id=eq.${pgValue(id)}&select=id&limit=2000`,
    );
    if (!rows?.length) return badRequest("ยังไม่มีสินค้าในรอบนี้");

    await supabaseRest(`staff_round_items?round_id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ per_person_limit: value, updated_at: new Date().toISOString() }),
    });

    await auditStaffSale(req, "staff_sale.items_limit", id, {
      per_person_limit: value,
      changed: rows.length,
    });

    return NextResponse.json({ ok: true, changed: rows.length });
  }

  const itemId = typeof body.id === "string" ? body.id : "";
  if (!itemId) return badRequest("ไม่พบรายการที่จะแก้");

  const beforeRows = await supabaseRest<StaffRoundItem[]>(
    `staff_round_items?id=eq.${pgValue(itemId)}&round_id=eq.${pgValue(id)}&select=${ITEM_COLUMNS}&limit=1`,
  );
  const before = beforeRows?.[0];
  if (!before) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });

  const parsed = parseItemInput({ ...before, ...body });
  if ("error" in parsed) return badRequest(parsed.error);

  // The quota cannot be set below what is already out of the door.
  const committed = Number(before.sold_qty) + Number(before.reserved_qty);
  if (parsed.input.total_quota !== null && parsed.input.total_quota < committed) {
    return badRequest(`โควตารวมต้องไม่ต่ำกว่า ${committed} ชิ้นที่ขาย/จองไปแล้ว`);
  }

  await supabaseRest(`staff_round_items?id=eq.${pgValue(itemId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      staff_price: parsed.input.staff_price,
      per_person_limit: parsed.input.per_person_limit,
      total_quota: parsed.input.total_quota,
      enabled: parsed.input.enabled,
      updated_at: new Date().toISOString(),
    }),
  });

  await auditStaffSale(req, "staff_sale.item_edit", itemId, {
    round_id: id,
    variant_id: before.variant_id,
    staff_price: { from: Number(before.staff_price), to: parsed.input.staff_price },
    per_person_limit: { from: before.per_person_limit, to: parsed.input.per_person_limit },
    total_quota: { from: before.total_quota, to: parsed.input.total_quota },
    enabled: { from: before.enabled, to: parsed.input.enabled },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stop = guard(req);
  if (stop) return stop;
  const { id } = await params;
  const itemId = req.nextUrl.searchParams.get("itemId") ?? "";
  if (!itemId) return badRequest("ไม่พบรายการที่จะลบ");

  const rows = await supabaseRest<StaffRoundItem[]>(
    `staff_round_items?id=eq.${pgValue(itemId)}&round_id=eq.${pgValue(id)}&select=${ITEM_COLUMNS}&limit=1`,
  );
  const item = rows?.[0];
  if (!item) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });

  // Sold or held means the shelf's running totals are in use. Switching the
  // row off takes it out of the shop and keeps the numbers; deleting it
  // would make a refund later restore stock to a row that no longer exists.
  if (Number(item.sold_qty) > 0 || Number(item.reserved_qty) > 0) {
    return badRequest("สินค้านี้ขายหรือถูกจองไปแล้ว — ปิดการขายรายการนี้แทนการลบ");
  }

  await supabaseRest(`staff_round_items?id=eq.${pgValue(itemId)}`, {
    method: "DELETE",
    returning: false,
  });
  await auditStaffSale(req, "staff_sale.item_delete", itemId, {
    round_id: id,
    variant_id: item.variant_id,
  });
  return NextResponse.json({ ok: true });
}
