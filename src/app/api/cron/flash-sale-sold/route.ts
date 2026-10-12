import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { syncExternalSold } from "@/lib/flash-sale-sold";

// Keeps the queue's idea of stock honest while nobody is looking.
//
// A campaign's products are usually on sale in two places at once: the queue
// page and the shop's own product page. The queue counts its own sales and
// cannot see the others, so fs_join hands out slots for stock that is already
// gone — it did, on a campaign of ฿55,000 sets.
//
// The sale page refreshes this every time somebody loads it, which covers a
// busy sale. It does not cover the quiet hours, and the quiet hours are
// exactly when a storefront sale goes unnoticed: nobody is watching the queue
// page, somebody buys the box from the product page, and the first person to
// open the queue page afterwards is told there is more left than there is.
//
// Scheduled from Supabase (pg_cron + pg_net), not vercel.json: Vercel's Hobby
// plan allows one cron a day, and adding a second costs the ability to deploy
// at all.

async function authorized(req: NextRequest) {
  // Same three callers as the other crons: the token pg_cron keeps in the
  // database (checked by the database, so it never has to be copied into
  // Vercel's environment), CRON_SECRET if this is ever scheduled from Vercel,
  // and a signed-in admin pressing it by hand to see what it would do.
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
    try {
      const ok = await supabaseRest<boolean>("rpc/fs_cron_token_ok", {
        method: "POST",
        body: JSON.stringify({ p_token: token }),
      });
      if (ok === true) return true;
    } catch {
      // fall through to the admin cookie
    }
  }
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type OpenCampaign = { id: string; title: string; starts_at: string };

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  try {
    // Only campaigns that are actually selling. A finished or future campaign
    // has nothing to keep honest, and asking Shopify about it would spend the
    // API budget on a question with no consequence.
    const campaigns = await supabaseRest<OpenCampaign[]>(
      `flash_sale_campaigns?select=id,title,starts_at` +
        `&published=is.true&is_demo=not.is.true` +
        `&starts_at=lte.${encodeURIComponent(new Date().toISOString())}` +
        `&ended_manually_at=is.null` +
        `&or=(ends_at.is.null,ends_at.gt.${encodeURIComponent(new Date().toISOString())})` +
        `&limit=25`
    );

    const changed: { campaign: string; slug: string; external: number }[] = [];
    for (const campaign of campaigns) {
      // One campaign failing — a variant with no SKU, a Shopify hiccup — must
      // not stop the others being checked.
      try {
        for (const row of await syncExternalSold(campaign.id, campaign.starts_at)) {
          if (row.external > 0) {
            changed.push({ campaign: campaign.title, slug: row.slug, external: row.external });
          }
        }
      } catch (err) {
        console.error(`[cron/flash-sale-sold] ${campaign.id} failed`, err);
      }
    }

    return NextResponse.json({ ok: true, checked: campaigns.length, storefrontSales: changed });
  } catch (err) {
    console.error("[cron/flash-sale-sold] failed", err);
    return NextResponse.json({ ok: false, error: "ตรวจยอดขายหน้าร้านไม่สำเร็จ" }, { status: 500 });
  }
}
