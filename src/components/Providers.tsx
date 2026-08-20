"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { CartDrawerProvider } from "@/lib/cart-drawer-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";
import CartDrawer from "@/components/CartDrawer";
import GiftUnlockPopup from "@/components/GiftUnlockPopup";
import GiftCongratsBar from "@/components/GiftCongratsBar";
import GiftFloatingButton from "@/components/GiftFloatingButton";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <AuthProvider>
        <CartProvider>
          <CartDrawerProvider>
            <WishlistProvider>
              <RecentlyViewedProvider>
                <QuickChatProvider>
                  {children}
                  <QuickChat />
                  <MobileTabBar />
                  <CartDrawer />
                  <GiftUnlockPopup />
                  <GiftCongratsBar />
                  <GiftFloatingButton />
                </QuickChatProvider>
              </RecentlyViewedProvider>
            </WishlistProvider>
          </CartDrawerProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
