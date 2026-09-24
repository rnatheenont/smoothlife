import { NextRequest, NextResponse } from "next/server";

// Where 2C2P sends the customer's browser when the payment page is done.
//
// It sends them by POSTing a form, not by following a link — and a Next.js
// page only answers GET, so pointing frontendReturnUrl straight at
// /checkout/success returned 405 with an empty body. Inside the payment frame
// that was invisible (the modal watches our own transaction and never needed
// the return), but the "open in a new tab" escape had nowhere to hide: pay,
// and the tab you paid in goes white.
//
// So the return lands here and leaves again as a 303, which is the one
// redirect that turns a POST into a GET. The posted body is ignored on
// purpose: what a payment did is settled by 2C2P's server-to-server webhook,
// never by something the customer's browser carried back.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fixed destinations only — a redirect built from user input is an open redirect. */
function destination(req: NextRequest): string {
  const params = req.nextUrl.searchParams;
  if (params.get("next") === "subscriptions") return "/account/subscriptions?justSubscribed=1";
  const cartToken = params.get("cartToken");
  return cartToken ? `/checkout/success?cartToken=${encodeURIComponent(cartToken)}` : "/checkout/success";
}

function handoff(req: NextRequest) {
  return NextResponse.redirect(new URL(destination(req), req.nextUrl.origin), 303);
}

export const GET = handoff;
export const POST = handoff;
