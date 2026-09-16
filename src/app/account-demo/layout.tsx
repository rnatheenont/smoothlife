import type { ReactNode } from "react";

// A preview of the account page with invented data — useful to look at, but
// nothing a search engine should index or a customer should stumble into.
export const metadata = {
  title: "ตัวอย่างหน้าบัญชี | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function AccountDemoLayout({ children }: { children: ReactNode }) {
  return children;
}
