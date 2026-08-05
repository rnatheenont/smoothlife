import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCAL_AI_ENABLED } from "@/lib/local-ai";

export const metadata: Metadata = {
  title: "Skin Coach | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function SkinCoachLayout({ children }: { children: React.ReactNode }) {
  if (!LOCAL_AI_ENABLED) notFound();
  return children;
}
