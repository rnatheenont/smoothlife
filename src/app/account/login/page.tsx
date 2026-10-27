import { Suspense } from "react";
import CampaignChrome, { isCampaignReturn, returnToOf } from "@/components/campaign/CampaignChrome";
import LoginDialog from "./LoginDialog";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read here rather than in the browser: signing in on the way back to a
  // campaign wears the store's chrome from the first byte, not after hydration.
  //
  // The chrome still matters even though the card below covers the viewport —
  // it is what sits behind the dim, and what comes back when the dialog is
  // closed.
  const campaign = isCampaignReturn(returnToOf(await searchParams));
  return (
    <CampaignChrome campaign={campaign}>
      <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
        <LoginDialog />
      </Suspense>
    </CampaignChrome>
  );
}
