"use client";

import { Suspense } from "react";
import LoginContent from "@/components/LoginContent";
import CampaignChrome from "@/components/campaign/CampaignChrome";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
      {/* Signing in on the way back to a campaign wears the store's chrome, the
          same as the page that sent them and the one they finish on. */}
      <CampaignChrome>
        <LoginContent />
      </CampaignChrome>
    </Suspense>
  );
}
