import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glow Challenge 7 Days | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function GlowChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
