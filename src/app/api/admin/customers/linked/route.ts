import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseCount, supabaseRest } from "@/lib/supabase-server";

// Every account that is joined to a Shopify customer record, newest first.
//
// The search beside this answers "which shop record belongs to this login",
// which is the question you ask about one customer you are already talking
// to. This answers the other one — "who is linked at all" — which is how
// somebody checks the work rather than a single case.
//
// Paged and not whole: there are 438 of them against 457 accounts, and a
// page nobody scrolls to the end of hides the rows that matter. Newest
// first, because a link made wrong was made recently.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 50;
const LINKED = "users?shopify_customer_id=not.is.null";

type UserRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  shopify_customer_id: string | null;
  created_at: string;
};
type IdentityRow = { user_id: string; provider_uid: string };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("page")) || 1));
  const offset = (page - 1) * PAGE;

  let total = 0;
  let accounts: UserRow[] = [];
  try {
    [total, accounts] = await Promise.all([
      supabaseCount(`${LINKED}&select=id`),
      supabaseRest<UserRow[]>(
        `${LINKED}&select=id,display_name,phone,shopify_customer_id,created_at` +
          `&order=created_at.desc&offset=${offset}&limit=${PAGE}`
      ),
    ]);
  } catch (err) {
    console.error("[admin/customers/linked]", err);
    return NextResponse.json({ ok: false, error: "โหลดรายชื่อไม่สำเร็จ" }, { status: 502 });
  }

  // One more read for the sign-in addresses: a row with only a display name
  // is not enough to recognise someone by, and the e-mail is what support
  // has in front of them.
  const list = accounts.map((a) => `"${a.id}"`).join(",");
  const identities = list
    ? await supabaseRest<IdentityRow[]>(
        `auth_identities?select=user_id,provider_uid&provider=eq.email&user_id=in.(${encodeURIComponent(list)})`
      ).catch((): IdentityRow[] => [])
    : [];
  const emailOf = new Map(identities.map((i) => [i.user_id, i.provider_uid]));

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize: PAGE,
    accounts: accounts.map((a) => ({
      id: a.id,
      displayName: a.display_name,
      phone: a.phone,
      email: emailOf.get(a.id) ?? null,
      shopifyCustomerId: a.shopify_customer_id,
      createdAt: a.created_at,
    })),
  });
}
