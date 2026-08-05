"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <QuickChatProvider>
              {children}
              <QuickChat />
              <MobileTabBar />
            </QuickChatProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
