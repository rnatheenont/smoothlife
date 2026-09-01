import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { createOrderForSubscriptionCycle } from "@/lib/shopify-admin";
import { products } from "@/data/products";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

// Splits a term's total charge across a set's items proportional to real
// catalogue price — copy of the same helper in api/webhooks/2c2p/route.ts,
// duplicated rather than shared since one lives in a webhook handler and
// importing across route boundaries in Next's route-handler tree is
// awkward; keep both in sync if the split logic ever changes.
function splitAmountByRealPrice(variantIds: string[], totalAmount: number): { variantId: string; price: number }[] {
  const catalogPrices = variantIds.map((vid) => {
    const product = products.find((p) => p.variants.some((v) => v.variantId === vid));
    const variant = product?.variants.find((v) => v.variantId === vid);
    return variant?.price ?? 0;
  });
  const priceSum = catalogPrices.reduce((s, p) => s + p, 0) || 1;
  let allocated = 0;
  return variantIds.map((variantId, i) => {
    const isLast = i === variantIds.length - 1;
    const price = isLast ? totalAmount - allocated : Math.round((catalogPrices[i] / priceSum) * totalAmount);
    allocated += price;
    return { variantId, price };
  });
}

type ChargeRow = {
  id: string;
  subscription_id: string;
  cycle_number: number;
  amount: number;
  tran_ref: string | null;
  shopify_order_id: string | null;
  success: boolean | null;
};

type SubscriptionRow = {
  id: string;
  subscription_type: "single_product" | "set" | "custom_bundle";
  variant_id: string | null;
  variant_ids: string[] | null;
  plan_months: number;
  currency_code: string;
  contact_email: string | null;
  shipping_address: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    postalCode: string;
    countryCode: string;
    state?: string;
    phone?: string;
  };
};

// Manually re-runs order creation for a charge that 2C2P confirmed as
// successful but that never produced a Shopify order (the "silent
// failure" case surfaced on the overview dashboard) — the customer was
// already charged, this just closes the loop on fulfillment without
// touching payment at all.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const chargeId = body?.chargeId;
  if (typeof chargeId !== "string" || !chargeId) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการตัดเงินนี้" }, { status: 400 });
  }

  const [charge] = await supabaseRest<ChargeRow[]>(
    `real_subscription_charges?id=eq.${chargeId}&select=id,subscription_id,cycle_number,amount,tran_ref,shopify_order_id,success`
  );
  if (!charge) return NextResponse.json({ ok: false, error: "ไม่พบรายการตัดเงินนี้" }, { status: 404 });
  if (charge.success !== true) {
    return NextResponse.json({ ok: false, error: "รายการนี้ไม่ได้ตัดเงินสำเร็จ ไม่ควรสร้างออเดอร์" }, { status: 400 });
  }
  if (charge.shopify_order_id) {
    return NextResponse.json({ ok: false, error: "รายการนี้มีออเดอร์อยู่แล้ว" }, { status: 400 });
  }

  const [subscription] = await supabaseRest<SubscriptionRow[]>(
    `real_subscriptions?id=eq.${charge.subscription_id}&select=id,subscription_type,variant_id,variant_ids,plan_months,currency_code,contact_email,shipping_address`
  );
  if (!subscription) return NextResponse.json({ ok: false, error: "ไม่พบรายการสมัครของรายการตัดเงินนี้" }, { status: 404 });

  const cycleInTerm = ((charge.cycle_number - 1) % subscription.plan_months) + 1;
  const termNumber = Math.floor((charge.cycle_number - 1) / subscription.plan_months) + 1;

  const lineItems =
    (subscription.subscription_type === "set" || subscription.subscription_type === "custom_bundle") &&
    subscription.variant_ids
      ? splitAmountByRealPrice(subscription.variant_ids, charge.amount).map((li) => ({ ...li, quantity: 1 }))
      : [{ variantId: subscription.variant_id!, quantity: 1, price: charge.amount }];

  const addr = subscription.shipping_address;
  try {
    const order = await createOrderForSubscriptionCycle({
      email: subscription.contact_email ?? undefined,
      lineItems,
      currencyCode: subscription.currency_code,
      shippingAddress: {
        firstName: addr.firstName,
        lastName: addr.lastName,
        address1: addr.address1,
        city: addr.city,
        provinceCode: addr.state,
        zip: addr.postalCode,
        countryCode: addr.countryCode,
        phone: addr.phone,
      },
      note: `Subscribe & Save — รอบตัดเงินเดือนที่ ${cycleInTerm}/${subscription.plan_months} (เทอมที่ ${termNumber}) [สร้างซ้ำจากหน้าแอดมิน]`,
      tranRef: charge.tran_ref ?? `RETRY-${charge.id}`,
    });

    await supabaseRest(`real_subscription_charges?id=eq.${charge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.id }),
    });
    await supabaseRest("subscription_shipments", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        subscription_id: subscription.id,
        term_number: termNumber,
        cycle_in_term: cycleInTerm,
        shopify_order_id: order.id,
      }),
    });

    return NextResponse.json({ ok: true, orderName: order.name });
  } catch (err) {
    console.error("[admin/subscriptions-overview/retry-order] failed", err);
    return NextResponse.json({ ok: false, error: "สร้างออเดอร์ไม่สำเร็จอีกครั้ง — ลองใหม่ภายหลังหรือสร้างมือใน Shopify" }, { status: 502 });
  }
}
