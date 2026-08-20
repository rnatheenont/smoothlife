"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";
import GiftUnlockPopup from "@/components/GiftUnlockPopup";
import GiftCongratsBar from "@/components/GiftCongratsBar";
import GiftFloatingButton from "@/components/GiftFloatingButton";

// Storefront-only chrome (chat bubble, gift popups/floating button, mobile
// tab bar) has no business showing up on the internal /admin tool — it
// visually overlaps the admin panel and has nothing to do with managing
// promos.
function StorefrontWidgets() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <>
      <QuickChat />
      <MobileTabBar />
      <GiftUnlockPopup />
      <GiftCongratsBar />
      <GiftFloatingButton />
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <RecentlyViewedProvider>
              <QuickChatProvider>
                {children}
                <StorefrontWidgets />
              </QuickChatProvider>
            </RecentlyViewedProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
