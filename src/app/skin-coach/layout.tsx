import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skin Coach | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function SkinCoachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
