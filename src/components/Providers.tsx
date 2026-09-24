"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import { WidgetSettingsProvider } from "@/lib/use-widget-settings";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";
import GiftUnlockPopup from "@/components/GiftUnlockPopup";
import GiftCongratsBar from "@/components/GiftCongratsBar";
import GiftFloatingButton from "@/components/GiftFloatingButton";
import AutoShopifySignIn from "@/components/AutoShopifySignIn";

// Storefront-only chrome (chat bubble, gift popups/floating button, mobile
// tab bar) has no business showing up on the internal /admin tool — it
// visually overlaps the admin panel and has nothing to do with managing
// promos.
function StorefrontWidgets() {
  const pathname = usePathname();
  // /chat is the same conversation at full size — the corner bubble on top of
  // it would be a second door into the room you are already standing in.
  // /campaigns wears the live store's chrome, not this site's — a chat bubble
  // and a tab bar from an unlaunched site would give that away instantly.
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/chat") || pathname?.startsWith("/campaigns")) {
    return null;
  }
  return (
    <>
      {/* Shares the storefront-only rule: /admin has its own sign-in, and
          sending an admin off to Shopify and back mid-task would be its own
          kind of rude. */}
      <AutoShopifySignIn />
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
              <WidgetSettingsProvider>
                <QuickChatProvider>
                  {children}
                  <StorefrontWidgets />
                </QuickChatProvider>
              </WidgetSettingsProvider>
            </RecentlyViewedProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
