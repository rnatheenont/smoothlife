"use client";

// Signing in with the account they bought with.
//
// Everyone this campaign is for has an order on smoothlife.com, which means
// they have a customer account there — so the shortest true path is to ask
// Shopify who they are rather than to ask them again. Someone already signed in
// at the shop comes back signed in here without typing anything, and someone
// who is not gets Shopify's own login page on shopify.com: the real one, at the
// address they already trust, which is worth more on a page asking for receipts
// than any amount of matching the header.
//
// The other ways in stay underneath. A customer who signed up here with LINE or
// a phone number is still a customer, and leading with Shopify must not become
// locking out everyone who did not use it.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import LoginContent from "@/components/LoginContent";
import { SHOPIFY_EMAIL_LOGIN, shopifyAuthStartPath } from "@/lib/shopify-email-login";

const CAMPAIGN = "/campaigns/dentiste-x-kengnamping";

function ShopifyFirst() {
  // useSearchParams rather than window: the href has to be the same on the
  // server and after hydration, and ?test=1 has to survive the round trip so
  // they come back to the form they were trying.
  const params = useSearchParams().toString();
  const returnTo = `${CAMPAIGN}${params ? `?${params}` : ""}`;
  return (
    <div className="mb-6">
      <a
        href={shopifyAuthStartPath({ intent: "login", returnTo })}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white hover:opacity-90"
      >
        <Mail size={18} aria-hidden /> เข้าสู่ระบบด้วยบัญชี Smoothlife.com
      </a>
      <p className="mt-2 text-center text-[13px] text-black/60">
        ใช้บัญชีเดียวกับที่สั่งซื้อ — ถ้าเข้าสู่ระบบที่ smoothlife.com อยู่แล้ว จะเข้าได้ทันทีโดยไม่ต้องกรอกอะไร
      </p>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-black/10" />
        <span className="text-[12px] text-black/50">หรือเข้าสู่ระบบด้วยวิธีอื่น</span>
        <div className="h-px flex-1 bg-black/10" />
      </div>
    </div>
  );
}

export default function CampaignLoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Suspense fallback={<p className="py-20 text-center text-[14px] text-black/50">กำลังโหลด…</p>}>
        {SHOPIFY_EMAIL_LOGIN && <ShopifyFirst />}
        <LoginContent hideEmailLogin={SHOPIFY_EMAIL_LOGIN} />
      </Suspense>
    </div>
  );
}
