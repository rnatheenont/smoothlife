import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { UUID_RE } from "@/lib/flash-sale";
import { SET_COLUMNS, parseSetInput, setSummary, writeItems, type SubscriptionSet } from "@/lib/subscription-sets";

// Admin: edit one set, or take it off sale.
//   PATCH body { ...set }            — full edit
//   PATCH body { status }            — just flip draft/active/archived
//   DELETE                           — remove a set nobody has subscribed to
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบชุดนี้" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // Flipping the switch on a row in the list: no need to resend the whole set.
  if (body && Object.keys(body).length === 1 && typeof body.status === "string") {
    const status = ["draft", "active", "archived"].includes(body.status) ? body.status : null;
    if (!status) return NextResponse.json({ ok: false, error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    const [set] = await supabaseRest<SubscriptionSet[]>(`subscription_sets?id=eq.${pgValue(id)}&select=${SET_COLUMNS}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!set) return NextResponse.json({ ok: false, error: "ไม่พบชุดนี้" }, { status: 404 });
    return NextResponse.json({ ok: true, set: { ...set, summary: setSummary(set) } });
  }

  const parsed = parseSetInput(body);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const [updated] = await supabaseRest<SubscriptionSet[]>(`subscription_sets?id=eq.${pgValue(id)}&select=${SET_COLUMNS}`, {
    method: "PATCH",
    body: JSON.stringify(parsed.row),
  });
  if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบชุดนี้" }, { status: 404 });
  // Editing a set never rewrites what someone already subscribed to — those
  // are frozen in subscription_set_snapshots on the day they subscribed.
  await writeItems(id, parsed.items);

  const [saved] = await supabaseRest<SubscriptionSet[]>(`subscription_sets?id=eq.${pgValue(id)}&select=${SET_COLUMNS}`);
  return NextResponse.json({ ok: true, set: { ...saved, summary: setSummary(saved) } });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบชุดนี้" }, { status: 404 });

  const subscribed = await supabaseRest<{ id: string }[]>(
    `subscription_set_snapshots?set_id=eq.${pgValue(id)}&select=id&limit=1`
  ).catch((): { id: string }[] => []);
  if (subscribed.length > 0) {
    return NextResponse.json(
      { ok: false, error: "ลบไม่ได้ เพราะมีลูกค้าสมัครชุดนี้แล้ว — ใช้ 'เก็บเข้าคลัง' แทน" },
      { status: 409 }
    );
  }

  await supabaseRest(`subscription_sets?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}
