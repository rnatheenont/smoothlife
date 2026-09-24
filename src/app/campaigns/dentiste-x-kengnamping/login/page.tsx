"use client";

// Signing in without leaving the shop.
//
// The campaign page wears smoothlife.com's header and footer because the
// customer has never seen this site. Sending them to /account/login for the one
// step that asks for their identity would have undone all of it — that page
// carries this site's own chrome, and a login form on unfamiliar branding is
// the exact moment a person decides a link was not what it claimed to be.
//
// Same form, same flows, same session; it just lives under /campaigns so it
// inherits the store's chrome from the layout.
import { Suspense } from "react";
import LoginContent from "@/components/LoginContent";

export default function CampaignLoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Suspense fallback={<p className="py-20 text-center text-[14px] text-black/50">กำลังโหลด…</p>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
