import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { currentStaffRound, staffShopVisible } from "@/lib/staff-shop";
import AuroraBackground from "@/components/ui/AuroraBackground";
import StaffShop from "./StaffShop";

// The employee shop.
//
// Nothing is rendered on the server beyond the gate below: every state this
// page can be in depends on who is asking, and the prices depend on whether
// they have proved a company mailbox this round. So the shell is static and
// the page itself comes from /api/staff/round, which is the only place that
// decides.
//
// noindex twice over. The proxy already sends X-Robots-Tag on everything
// outside /faq (see search-visibility.ts), and this says it in the page as
// well — a staff price list is the last thing that should turn up in a
// search result, and one layer of that rule living in middleware is one
// deploy away from being the only layer.
export const metadata: Metadata = {
  title: "ร้านพนักงาน | Smoothlife.com",
  description: "ซื้อสินค้าราคาพนักงานสำหรับพนักงานที่มีสิทธิ์",
  robots: { index: false, follow: false, nocache: true },
};

// Reading a cookie makes this dynamic anyway; said out loud so nobody is
// surprised by a page that cannot be cached.
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // Somebody who is not signed in is sent to sign in, and learns nothing on
  // the way: they see the ordinary login page, not a page announcing that
  // there is an employee store, what the round is called and how long is
  // left on it.
  //
  // A redirect rather than a 404, because the people who most often arrive
  // here signed out are employees opening the link from a chat message —
  // they come back to /staff the moment they are in, and the check below
  // decides whether the page exists for them.
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/account/login?returnTo=%2Fstaff");

  // Signed in is not the same as entitled. A customer who found this URL
  // used to get a verification panel here — an invitation to prove a
  // company mailbox, on a page that told them a staff shop exists. Now the
  // address simply does not resolve for them.
  //
  // notFound rather than a redirect, and rather than a page saying "you do
  // not have access": both of those confirm there is something here.
  const round = await currentStaffRound();
  if (!round || !(await staffShopVisible(round.id, session))) notFound();

  // The light sits behind the shop rather than wrapping it: the version this
  // came from is a full-height hero that centres whatever you give it, and
  // this page is a long scrolling grid. Fixed, so it stays put while the
  // products move over it — a background that scrolls away is a header.
  return (
    <>
      <AuroraBackground className="pointer-events-none fixed inset-0 -z-10" />
      <StaffShop />
    </>
  );
}
