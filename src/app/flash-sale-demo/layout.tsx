import type { ReactNode } from "react";
import "./heroui-demo.css";

// A clickable walk-through of the flash-sale queue plan on invented data —
// nothing a search engine should index or a customer should find.
export const metadata = {
  title: "Demo ระบบคิว Flash Sale | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function FlashSaleDemoLayout({ children }: { children: ReactNode }) {
  return children;
}
