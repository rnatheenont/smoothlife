import { NextResponse } from "next/server";
import { listWebDiscountCodes } from "@/lib/shopify-discounts";

export const revalidate = 300;

// The coupons the shop advertises on the site. Empty is a perfectly normal
// answer — it means nothing is currently named "WEB: …" in Shopify Admin —
// and the cart simply shows the code box on its own.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, coupons: await listWebDiscountCodes() });
  } catch (err) {
    console.error("[api/coupons] could not read discounts from Shopify", err);
    return NextResponse.json({ ok: true, coupons: [] });
  }
}
