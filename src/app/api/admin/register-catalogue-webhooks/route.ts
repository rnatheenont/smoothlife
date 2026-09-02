import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword } from "@/lib/admin-auth";
import { registerCatalogueWebhooks } from "@/lib/shopify-admin";

// One-off ops endpoint, not linked from any UI — run once via
// `curl -H "Authorization: Bearer $ADMIN_PANEL_SECRET" https://.../api/admin/register-catalogue-webhooks`
// then remove this route. Exists because the credentials needed
// (SHOPIFY_ADMIN_CLIENT_ID/SECRET) are set as Vercel "Sensitive" env
// vars — `vercel env pull` can never retrieve them in plaintext, by
// design, so no local script can do this; only code running inside the
// deployed app itself (which Vercel injects the real values into at
// runtime regardless of Sensitive-type) can. See
// registerCatalogueWebhooks()'s own comment for why it must run under
// this app's credentials specifically (Shopify signs webhook deliveries
// with the registering app's Client Secret, which SHOPIFY_WEBHOOK_SECRET
// must match).
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !checkAdminPassword(token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const callbackUrl = `${req.nextUrl.origin}/api/webhooks/shopify`;
  try {
    const results = await registerCatalogueWebhooks(callbackUrl);
    return NextResponse.json({ ok: true, callbackUrl, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
