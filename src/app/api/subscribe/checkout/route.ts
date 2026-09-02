import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { products } from "@/data/products";
import {
  subscriptionPlans,
  subscriptionSets,
  subscriptionSetProducts,
  BUNDLE_MIN_ITEMS,
  BUNDLE_MAX_ITEMS,
  BUNDLE_DISCOUNT_PCT,
} from "@/data/subscriptions";
import { subscriptionBillingConfigured, createRecurringPaymentToken } from "@/lib/2c2p";

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนค่ะ" }, { status: 401 });
  }
  if (!subscriptionBillingConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบตัดเงินอัตโนมัติยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const { productSlug, variantId, setSlug, bundleItems, months, shippingAddress, consentRecurringCharge } = body;
  const plan = subscriptionPlans.find((p) => p.months === months);
  if (!plan) return NextResponse.json({ ok: false, error: "ระยะเวลาสมัครไม่ถูกต้อง" }, { status: 400 });

  if (
    !shippingAddress?.address1 ||
    !shippingAddress?.city ||
    !shippingAddress?.postalCode ||
    !shippingAddress?.countryCode
  ) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่จัดส่งให้ครบ" }, { status: 400 });
  }
  if (consentRecurringCharge !== true) {
    return NextResponse.json({ ok: false, error: "กรุณายืนยันการยอมรับเงื่อนไขการตัดเงินอัตโนมัติ" }, { status: 400 });
  }

  // A single product (productSlug/variantId), a curated set (setSlug, every
  // product in it), or a customer-assembled bundle (bundleItems, picked from
  // the bundle_eligible pool) — all three end up as one 2C2P recurring plan
  // billing monthly, just a different subscription_type/shape on the
  // real_subscriptions row (see migration real_subscriptions_support_sets).
  let subscriptionType: "single_product" | "set" | "custom_bundle";
  let displayName: string;
  let items: { slug: string; variantId: string; price: number }[];

  if (Array.isArray(bundleItems) && bundleItems.length > 0) {
    if (bundleItems.length < BUNDLE_MIN_ITEMS || bundleItems.length > BUNDLE_MAX_ITEMS) {
      return NextResponse.json(
        { ok: false, error: `เลือกสินค้าได้ ${BUNDLE_MIN_ITEMS}-${BUNDLE_MAX_ITEMS} ชิ้นต่อชุด` },
        { status: 400 }
      );
    }
    // Never trust the client's picks or prices — re-check eligibility and
    // resolve current catalogue prices server-side, same principle already
    // applied to consentRecurringCharge below.
    const eligibleRows = await supabaseRest<{ product_slug: string }[]>(
      `product_subscription_settings?bundle_eligible=eq.true&select=product_slug`
    );
    const eligibleSlugs = new Set(eligibleRows.map((r) => r.product_slug));
    const resolved: { slug: string; variantId: string; price: number }[] = [];
    for (const it of bundleItems as { productSlug?: string; variantId?: string }[]) {
      if (!it.productSlug || !eligibleSlugs.has(it.productSlug)) {
        return NextResponse.json({ ok: false, error: "มีสินค้าที่ไม่อยู่ในรายการที่จัดชุดได้" }, { status: 400 });
      }
      const product = products.find((p) => p.slug === it.productSlug);
      const variant = product?.variants.find((v) => v.variantId === it.variantId);
      if (!product || !variant) return NextResponse.json({ ok: false, error: "ไม่พบสินค้าบางชิ้นในชุด" }, { status: 404 });
      resolved.push({ slug: product.slug, variantId: variant.variantId, price: variant.price });
    }
    subscriptionType = "custom_bundle";
    displayName = `ชุดที่คุณจัดเอง (${resolved.length} ชิ้น)`;
    items = resolved;
  } else if (setSlug) {
    const set = subscriptionSets.find((s) => s.slug === setSlug);
    if (!set) return NextResponse.json({ ok: false, error: "ไม่พบชุดสินค้านี้" }, { status: 404 });
    const setProducts = subscriptionSetProducts(set);
    if (setProducts.length === 0) return NextResponse.json({ ok: false, error: "ชุดสินค้านี้ไม่มีสินค้าพร้อมขาย" }, { status: 400 });
    subscriptionType = "set";
    displayName = set.name;
    items = setProducts.map((p) => ({ slug: p.slug, variantId: p.variantId, price: p.price }));
  } else {
    const product = products.find((p) => p.slug === productSlug);
    const variant = product?.variants.find((v) => v.variantId === variantId);
    if (!product || !variant) return NextResponse.json({ ok: false, error: "ไม่พบสินค้านี้" }, { status: 404 });
    subscriptionType = "single_product";
    displayName = product.name;
    items = [{ slug: product.slug, variantId: variant.variantId, price: variant.price }];
  }

  const [user] = await supabaseRest<{ id: string; display_name: string | null; phone: string | null }[]>(
    `users?id=eq.${uid}&select=id,display_name,phone`
  );
  const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid`
  );

  // Charged every month at the discount rate locked in by the chosen term
  // (3/6/12 months = 5/15/20% off) — not a term lump sum. 2C2P has no
  // calendar-month recurring unit, so the interval is passed as ~30 days.
  //
  // recurringCount is the term length, NOT 0 ("charge forever"). A term
  // never stops early — cancelling only means "don't start the next term"
  // — so a plan bounded to exactly this term's cycles expires on its own
  // at the term boundary and there is nothing left to cancel. That keeps
  // the whole subscription lifecycle off the Recurring Payment Maintenance
  // API, which this merchant account currently answers with HTTP 401.
  // Renewing into the next term therefore has to start a *new* plan rather
  // than letting an open-ended one roll on.
  const totalPerCycle = items.reduce((sum, it) => sum + it.price, 0);
  // Bundle discount stacks with (applies before) the term discount — e.g.
  // 10% off the real picked total, then another 5-20% off that for the
  // chosen term (see BUNDLE_DISCOUNT_PCT in data/subscriptions.ts).
  const afterBundleDiscount =
    subscriptionType === "custom_bundle" ? totalPerCycle * (1 - BUNDLE_DISCOUNT_PCT / 100) : totalPerCycle;
  const amountPerCycle = Math.round(afterBundleDiscount * (1 - plan.discountPct / 100));
  const invoicePrefix = `SUB${Date.now().toString(36).toUpperCase()}`.slice(0, 15);
  const invoiceNo = `${invoicePrefix}1`;
  const chargeNextDate = new Date();
  chargeNextDate.setMonth(chargeNextDate.getMonth() + 1);

  const [subscription] = await supabaseRest<{ id: string }[]>("real_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      status: "pending",
      subscription_type: subscriptionType,
      product_slug: subscriptionType === "single_product" ? items[0].slug : null,
      variant_id: subscriptionType === "single_product" ? items[0].variantId : null,
      set_slug: subscriptionType === "set" ? setSlug : null,
      variant_ids:
        subscriptionType === "set" || subscriptionType === "custom_bundle" ? items.map((it) => it.variantId) : null,
      product_name: displayName,
      plan_months: plan.months,
      discount_pct: plan.discountPct,
      amount_per_cycle: amountPerCycle,
      currency_code: "THB",
      invoice_prefix: invoicePrefix,
      shipping_address: shippingAddress,
      contact_email: emailIdentity?.provider_uid ?? null,
      contact_phone: user?.phone ?? null,
    }),
  });

  await supabaseRest("real_subscription_charges", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      subscription_id: subscription.id,
      invoice_no: invoiceNo,
      cycle_number: 1,
      amount: amountPerCycle,
    }),
  });

  const origin = req.nextUrl.origin;
  try {
    const result = await createRecurringPaymentToken({
      invoiceNo,
      invoicePrefix,
      description: `${displayName} (สมัครสมาชิกตัดเงินรายเดือน ล็อกส่วนลด ${plan.discountPct}% เทอม ${plan.months} เดือน)`.slice(0, 250),
      amountPerCycle,
      recurringCount: plan.months,
      recurringIntervalDays: 30,
      chargeNextDate,
      frontendReturnUrl: `${origin}/account/subscriptions?justSubscribed=1`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p`,
      customer: { name: user?.display_name ?? undefined, email: emailIdentity?.provider_uid, mobileNo: user?.phone ?? undefined },
      shippingAddress: {
        address1: shippingAddress.address1,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        countryCode: shippingAddress.countryCode,
        state: shippingAddress.state,
      },
    });
    return NextResponse.json({ ok: true, webPaymentUrl: result.webPaymentUrl });
  } catch (err) {
    console.error("[subscribe/checkout] 2C2P paymentToken failed", err);
    await supabaseRest(`real_subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "cancelled" }),
    });
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
