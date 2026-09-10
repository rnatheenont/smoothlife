import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getCustomerOrders, ordersByCustomerId, grantedScopes, shopifyAdminConfigured } from "@/lib/shopify-admin";

// Exactly what the customer's own order page would show them.
//
// Not what Shopify holds — what THIS app can read, which is not the same
// thing and is the difference that matters when someone says "my orders are
// missing". Our access token has its own scopes, and Shopify withholds orders
// older than sixty days from an app that lacks read_all_orders: the customer
// record still reports "4 orders" in its totals while the list comes back with
// one. Support needs to see that gap rather than infer it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!/^(gid:\/\/shopify\/Customer\/)?\d+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "รหัสลูกค้าไม่ถูกต้อง" }, { status: 400 });
  }

  const numericId = id.replace("gid://shopify/Customer/", "");
  // Two ways of asking the same question, because they are not documented to
  // behave the same: the customer's own orders connection, and a store-wide
  // order search filtered to that customer. If one of them returns the older
  // orders, the customer can have their history today instead of after a scope
  // change. The granted scopes come back too — "which orders may we read" is
  // decided by that list and nothing else.
  const [viaCustomer, viaOrderSearch, scopes] = await Promise.all([
    getCustomerOrders(id, 50),
    ordersByCustomerId(numericId, 50),
    grantedScopes(),
  ]);
  const orders = viaCustomer;
  return NextResponse.json({
    ok: true,
    visible: orders?.length ?? 0,
    viaOrderSearch: viaOrderSearch?.map((o) => `${o.name} ${o.createdAt.slice(0, 10)}`) ?? null,
    app: scopes ? `${scopes.app} (${scopes.apiKey})` : null,
    canReadAllOrders: scopes?.scopes.includes("read_all_orders") ?? null,
    scopes: scopes?.scopes ?? null,
    orders: (orders || []).map((o) => ({
      name: o.name,
      createdAt: o.createdAt,
      total: o.total,
      currency: o.currency,
      fulfillmentStatus: o.fulfillmentStatus,
      trackingNumbers: o.trackingNumbers,
      items: o.items.map((i) => `${i.title} x${i.quantity}`),
    })),
  });
}
