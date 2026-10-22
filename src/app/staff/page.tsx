import type { Metadata } from "next";
import StaffShop from "./StaffShop";

// The employee shop.
//
// Nothing is rendered on the server here: every state this page can be in
// depends on who is asking, and the prices depend on whether they have
// proved a company mailbox this round. So the shell is static and the whole
// page comes from /api/staff/round, which is the only place that decides.
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

export default function StaffPage() {
  return <StaffShop />;
}
