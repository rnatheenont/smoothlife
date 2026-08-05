import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smoothlife.com — สุขภาพและความงามครบวงจร",
  description:
    "Smoothlife.com ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ช้อปง่าย ครบจบทุก lifestyle ที่เดียว",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={plexSansThai.variable}>
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <div className="h-[60px] lg:hidden" aria-hidden />
        </Providers>
      </body>
    </html>
  );
}
