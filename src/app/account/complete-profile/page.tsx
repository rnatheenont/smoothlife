import { Suspense } from "react";
import CompleteProfileForm from "./CompleteProfileForm";
import CampaignChrome, { isCampaignReturn, returnToOf } from "@/components/campaign/CampaignChrome";

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Whose header and footer this page wears depends on where the customer is
  // going back to — answered on the server, so a campaign visitor never sees a
  // frame of the shop that has not launched.
  const campaign = isCampaignReturn(returnToOf(await searchParams));
  return (
    <CampaignChrome campaign={campaign}>
      <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
        <CompleteProfileForm />
      </Suspense>
    </CampaignChrome>
  );
}
