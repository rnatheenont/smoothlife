import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword } from "@/lib/admin-auth";

// Temporary diagnostic endpoint — DELETE once the Admin API scope blocker is
// resolved. Same pattern (and same reason) as
// ../register-catalogue-webhooks/route.ts: SHOPIFY_ADMIN_CLIENT_ID/SECRET are
// Vercel "Sensitive" env vars, so only code running inside the deployed app
// can see their real values. Answers two questions we can't answer locally:
// which app do these credentials actually belong to, and which scopes does the
// token they mint really carry?
//
//   curl -H "Authorization: Bearer $ADMIN_PANEL_SECRET" https://.../api/admin/shopify-scopes
//
// Never returns the client secret or the access token itself. The client_id
// IS returned in full — it is a public OAuth identifier (it travels in
// authorize URLs), and `shopify app config link --client-id=...` needs the
// whole thing to pull down the owning app's config.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !checkAdminPassword(token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const shop = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  const apiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";

  const identity = {
    shop: shop ?? null,
    clientId: clientId ?? null,
    clientSecretSet: Boolean(clientSecret),
    apiVersion,
  };
  if (!shop || !clientId || !clientSecret) {
    return NextResponse.json({ ok: false, error: "shopify admin credentials not configured", identity }, { status: 412 });
  }

  // 1. Mint a token via the client credentials grant and read the `scope` the
  //    grant itself reports back.
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const tokenBody = await tokenRes.text();
  if (!tokenRes.ok) {
    return NextResponse.json(
      { ok: false, step: "token", status: tokenRes.status, body: tokenBody.slice(0, 500), identity },
      { status: 502 }
    );
  }
  const tokenJson = JSON.parse(tokenBody) as { access_token: string; scope?: string; expires_in?: number };
  const accessToken = tokenJson.access_token;

  // 2. Cross-check against what the shop says this app is actually installed
  //    with — the grant's own `scope` can lag behind a scope change the
  //    merchant hasn't re-consented to.
  let installedScopes: string[] | null = null;
  let installedScopesError: string | null = null;
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (res.ok) {
      const json = (await res.json()) as { access_scopes: { handle: string }[] };
      installedScopes = json.access_scopes.map((s) => s.handle).sort();
    } else {
      installedScopesError = `${res.status} ${(await res.text()).slice(0, 200)}`;
    }
  } catch (err) {
    installedScopesError = err instanceof Error ? err.message : String(err);
  }

  // 3. Reproduce the actual failing query so we see the real error verbatim
  //    rather than inferring it from the scope list.
  let variantProbe: unknown = null;
  try {
    const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({
        query: `{ products(first: 1) { nodes { id title variants(first: 1) { nodes { id availableForSale inventoryQuantity } } } } }`,
      }),
    });
    variantProbe = JSON.parse((await res.text()).slice(0, 2000));
  } catch (err) {
    variantProbe = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    ok: true,
    identity,
    grantedScopeFromTokenGrant: tokenJson.scope ?? null,
    installedScopes,
    installedScopesError,
    variantProbe,
  });
}
