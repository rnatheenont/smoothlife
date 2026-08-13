"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <RecentlyViewedProvider>
              <QuickChatProvider>
                {children}
                <QuickChat />
                <MobileTabBar />
              </QuickChatProvider>
            </RecentlyViewedProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
