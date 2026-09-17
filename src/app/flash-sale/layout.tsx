import type { ReactNode } from "react";
import "./heroui.css";

// Flash-sale pages stay out of search until sales are launched publicly.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function FlashSaleLayout({ children }: { children: ReactNode }) {
  return children;
}
