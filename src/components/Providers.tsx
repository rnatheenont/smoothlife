"use client";

import { ReactNode, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider, WishlistProvider } from "@/lib/cart-context";
import { LangProvider } from "@/lib/lang-context";
import { QuickChatProvider } from "@/lib/quickchat-context";
import { LoginModalProvider, useLoginModal } from "@/lib/login-modal-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import { WidgetSettingsProvider } from "@/lib/use-widget-settings";
import QuickChat from "@/components/QuickChat";
import MobileTabBar from "@/components/MobileTabBar";
import BackToTop from "@/components/BackToTop";
import PwaRegister from "@/components/PwaRegister";
import InstallPrompt from "@/components/InstallPrompt";
import GiftUnlockPopup from "@/components/GiftUnlockPopup";
import GiftCongratsBar from "@/components/GiftCongratsBar";
import GiftFloatingButton from "@/components/GiftFloatingButton";
import AutoShopifySignIn from "@/components/AutoShopifySignIn";

// Storefront-only chrome (chat bubble, gift popups/floating button, mobile
// tab bar) has no business showing up on the internal /admin tool — it
// visually overlaps the admin panel and has nothing to do with managing
// promos.
const BARE = ["/admin", "/chat", "/campaigns", "/flash-sale", "/account/complete-profile", "/account/login"];
const isUnder = (pathname: string | null, base: string) =>
  pathname === base || Boolean(pathname?.startsWith(`${base}/`));

// The sign-in dialog carries the Firebase SDK and HeroUI's modal (~200 KB
// together), and almost nobody opens it on a given page view. It used to be
// mounted on every page anyway, so every visitor downloaded it up front.
// Now it is fetched the first time someone asks to sign in, and stays
// mounted after that so a second open is instant.
const LoginModal = dynamic(() => import("@/components/account/LoginModal"), { ssr: false });

function LazyLoginModal() {
  const { isOpen } = useLoginModal();
  // Remembered during render rather than in an effect: once asked for, the
  // dialog stays mounted, so its closing animation and a second open both
  // work without fetching anything again.
  const [wanted, setWanted] = useState(false);
  if (isOpen && !wanted) setWanted(true);
  return wanted ? <LoginModal /> : null;
}

export function StorefrontWidgets() {
  const pathname = usePathname();
  // /chat is the same conversation at full size — the corner bubble on top of
  // it would be a second door into the room you are already standing in.
  // /campaigns wears the live store's chrome, not this site's — a chat bubble
  // and a tab bar from an unlaunched site would give that away instantly.
  // /flash-sale is off by path and back on by campaign row: a regular sale
  // gets these widgets from its own layout, a special one is wearing the live
  // shop's chrome and cannot be carrying this site's chat bubble.
  // /account/complete-profile is off by path and back on by where the customer
  // is headed: finishing a profile on the way back to a campaign is not a
  // moment to hand someone this site's tab bar.
  if (BARE.some((p) => isUnder(pathname, p))) return null;
  return (
    <>
      {/* Shares the storefront-only rule: /admin has its own sign-in, and
          sending an admin off to Shopify and back mid-task would be its own
          kind of rude. */}
      <AutoShopifySignIn />
      <QuickChat />
      <MobileTabBar />
      <BackToTop />
      <LazyLoginModal />
      <PwaRegister />
      <InstallPrompt />
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
                  <LoginModalProvider>
                    {children}
                    <StorefrontWidgets />
                  </LoginModalProvider>
                </QuickChatProvider>
              </WidgetSettingsProvider>
            </RecentlyViewedProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
