import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import {
  checkAdminPermission,
  checkOwnerSession,
} from "@/lib/admin-permissions";
import {
  pgValue,
  supabaseConfigured,
  supabaseRest,
} from "@/lib/supabase-server";

// Everything the shop knows about one customer, in one call.
//
// The search screen next door answers one question — which Shopify record
// belongs to this login — and stops there. Anything past it ("did their
// payment go through", "why do they have 40 points", "was their receipt
// approved") meant opening four more consoles and matching the same person by
// hand in each, or asking a developer to run a query. Support had no page
// that simply says who this person is and what they have done.
//
// Read-only on purpose. Editing lives in ../profile and ../addresses, which
// audit what they change; nothing is written from here.
//
// Each block is gated on the permission of the console it comes from, checked
// here and not only in the route map. The map gates this path on
// customers.manage — support's permission for linking accounts — and that is
// not meant to become a side door into the payments console or the receipt
// queue. A block the viewer may not open is left out and named in `denied`,
// so the page can say "ซ่อนไว้ เพราะสิทธิ์ไม่ถึง" instead of showing an
// empty section where there is something.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

type Row = Record<string, unknown>;

/** One table's rows, never throwing: a table that cannot be read should cost
 *  its own block, not the whole screen. Untyped on purpose — every caller
 *  below names its own columns in the query, and the page is what decides
 *  what to do with them. */
function read(path: string): Promise<Row[]> {
  return supabaseRest<Row[]>(path).catch((): Row[] => []);
}

/** The stand-in for a block this admin may not open. */
const none = (): Promise<Row[]> => Promise.resolve([]);

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" },
      { status: 401 },
    );
  }
  if (!supabaseConfigured())
    return NextResponse.json(
      { ok: false, error: "ระบบยังไม่พร้อมใช้งาน" },
      { status: 503 },
    );

  const userId = (req.nextUrl.searchParams.get("userId") || "").trim();
  if (!UUID.test(userId))
    return NextResponse.json(
      { ok: false, error: "รหัสบัญชีไม่ถูกต้อง" },
      { status: 400 },
    );

  const id = pgValue(userId);
  const mine = `user_id=eq.${id}`;

  const [user] = await read(
    `users?id=eq.${id}&select=id,display_name,phone,gender,birthdate,avatar_url,referral_code,shopify_customer_id,created_at&limit=1`,
  );
  if (!user)
    return NextResponse.json(
      { ok: false, error: "ไม่พบบัญชีนี้" },
      { status: 404 },
    );

  // What this admin is allowed to see. Asked once, in parallel, before any
  // of the reads those answers decide.
  const may = async (permission: string) =>
    (await checkAdminPermission(token, permission)).ok;
  const ownerCheck = await checkOwnerSession(token);
  // `"reason" in result`, not `!result.ok` — see checkOwnerSession's doc
  // comment for why a {ok:true}|{ok:false} union is not narrowed on the
  // boolean here (strictNullChecks is off).
  const isOwner = !("reason" in ownerCheck);
  const [
    mayPoints,
    mayCheckout,
    mayReceipts,
    mayFlash,
    mayStaff,
    mayInbox,
    mayReviews,
  ] = await Promise.all([
    may("points.view"),
    may("checkout.view"),
    may("receipts.view"),
    may("flash_sale.view"),
    may("staff_sale.view"),
    may("inbox.manage"),
    may("reviews.manage"),
  ]);

  const [
    identities,
    addresses,
    storeLinks,
    balance,
    ledger,
    loyalty,
    payments,
    receipts,
    queue,
    staffVerifications,
    staffEntitlements,
    staffOrders,
    conversations,
    escalations,
    reviews,
    questions,
    subscriptions,
    wishlist,
    cycles,
    checkins,
    notifications,
    audit,
  ] = await Promise.all([
    // secret_hash is never selected — it is the password, and nothing on a
    // support screen has any use for it.
    read(
      `auth_identities?${mine}&select=provider,provider_uid,verified_at,created_at&order=created_at.asc`,
    ),
    read(
      `addresses?${mine}&select=id,label,recipient_name,phone,address_line,subdistrict,district,province,postal_code,country,is_default,created_at,updated_at&order=is_default.desc,created_at.asc`,
    ),
    read(`store_customer_links?${mine}&select=store,shopify_customer_id`),
    mayPoints ? read(`points_balance?${mine}&select=balance&limit=1`) : none(),
    mayPoints
      ? read(
          `points_ledger?${mine}&select=id,delta,reason,shopify_order_id,shopify_discount_code,expires_at,created_at&order=created_at.desc&limit=30`,
        )
      : none(),
    mayPoints
      ? read(
          `user_loyalty?${mine}&select=current_tier,rolling_12mo_spend,rolling_12mo_orders,tier_downgrade_grace_until,last_reviewed_at&limit=1`,
        )
      : none(),
    mayCheckout
      ? read(
          `payment_transactions?${mine}&select=id,invoice_no,amount,currency_code,status,resp_code,resp_desc,shopify_order_id,discount_code,discount_amount,refunded_at,refund_note,confirmed_at,created_at&order=created_at.desc&limit=30`,
        )
      : none(),
    mayReceipts
      ? read(
          `receipt_campaign_entries?${mine}&select=id,campaign_key,status,manual_receipt_no,declared_order_number,dentiste_net_amount,keychain_amount,computed_entries,entries_override,reject_reason,revoked_at,reviewed_at,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    mayFlash
      ? read(
          `flash_sale_queue?${mine}&select=id,campaign_id,status,position,reserved_at,expires_at,paid_at,shopify_order_id,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    mayStaff
      ? read(
          `staff_verifications?${mine}&select=round_id,staff_email_canonical,verified_at,via`,
        )
      : none(),
    mayStaff
      ? read(
          `staff_entitlements?${mine}&select=round_id,cap_thb,reserved_thb,spent_thb,updated_at`,
        )
      : none(),
    mayStaff
      ? read(
          `staff_orders?${mine}&select=id,round_id,status,subtotal_thb,shopify_order_id,needs_refund,note,paid_at,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    mayInbox
      ? read(
          `conversations?${mine}&select=id,channel,status,urgency,subject,last_message_at,created_at&order=last_message_at.desc&limit=20`,
        )
      : none(),
    mayInbox
      ? read(
          `chat_escalations?${mine}&select=id,status,contact_method,contact_value,product_slug,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    mayReviews
      ? read(
          `product_reviews?${mine}&select=id,product_slug,rating,title,status,points_awarded,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    mayReviews
      ? read(
          `product_questions?${mine}&select=id,product_slug,question,answer,answered_at,created_at&order=created_at.desc&limit=20`,
        )
      : none(),
    read(
      `real_subscriptions?${mine}&select=id,status,product_name,product_slug,set_slug,plan_months,amount_per_cycle,discount_pct,next_charge_date,next_shipment_date,current_term_number,auto_renew_cancelled,created_at&order=created_at.desc&limit=10`,
    ),
    read(
      `wishlist_items?${mine}&select=product_slug,created_at&order=created_at.desc&limit=30`,
    ),
    read(
      `checkin_cycles?${mine}&select=id,start_date,completed_days,status,day3_reward_claimed,day7_reward_claimed,created_at&order=created_at.desc&limit=6`,
    ),
    read(
      `daily_checkins?${mine}&select=checkin_date,source,points_spent&order=checkin_date.desc&limit=30`,
    ),
    read(
      `notifications?${mine}&select=id,type,title,body,link,read_at,created_at&order=created_at.desc&limit=10`,
    ),
    // Who has already edited this account, and what they changed. Gated like
    // the audit console itself: the owner only.
    isOwner
      ? read(
          `admin_audit_log?target=eq.${id}&select=id,created_at,actor,action,detail&order=created_at.desc&limit=25`,
        )
      : none(),
  ]);

  // The queue rows say which campaign by id; the page needs its name.
  const campaignIds = [
    ...new Set(queue.map((q) => q.campaign_id).filter(Boolean)),
  ] as string[];
  const campaigns = campaignIds.length
    ? await read(
        `flash_sale_campaigns?id=in.(${pgValue(campaignIds.join(","))})&select=id,title`,
      )
    : [];
  const campaignTitle = new Map(
    campaigns.map((c) => [c.id as string, c.title as string]),
  );

  // Named rather than silently absent: "ไม่มีข้อมูล" and "คุณดูไม่ได้" are
  // different answers, and support acting on the first when it was the
  // second is how a customer gets told their payment never arrived.
  const denied = [
    !mayPoints && "points",
    !mayCheckout && "payments",
    !mayReceipts && "receipts",
    !mayFlash && "flashSale",
    !mayStaff && "staff",
    !mayInbox && "chat",
    !mayReviews && "reviews",
    !isOwner && "audit",
  ].filter((v): v is string => Boolean(v));

  return NextResponse.json({
    ok: true,
    user,
    identities,
    addresses,
    storeLinks,
    points: mayPoints
      ? {
          balance: (balance[0]?.balance as number) ?? 0,
          ledger,
          loyalty: loyalty[0] ?? null,
        }
      : null,
    payments: mayCheckout ? payments : null,
    receipts: mayReceipts ? receipts : null,
    flashSale: mayFlash
      ? queue.map((q) => ({
          ...q,
          campaignTitle: campaignTitle.get(q.campaign_id as string) ?? null,
        }))
      : null,
    staff: mayStaff
      ? {
          verifications: staffVerifications,
          entitlements: staffEntitlements,
          orders: staffOrders,
        }
      : null,
    chat: mayInbox ? { conversations, escalations } : null,
    reviews: mayReviews ? { reviews, questions } : null,
    subscriptions,
    wishlist,
    checkins: { cycles, days: checkins },
    notifications,
    audit: isOwner ? audit : null,
    denied,
  });
}
