"use client";

import LiveMonitor from "@/components/flash-sale-demo/LiveMonitor";
import { useMonitors } from "@/components/flash-sale-demo/use-monitors";
import { Spinner } from "@heroui/react";
import {} from "lucide-react";

// One campaign, watched on its own.
//
// The live monitor already existed — the queue, who is holding a slot and how
// long they have left, the sync failures, the shared sources — but only
// inside the simulator's screen, folded under a campaign row. A sale that is
// running is a thing somebody sits and watches, so it gets a page.

export default function CampaignMonitor({
  id,
  names,
}: {
  id: string;
  names: Record<string, string>;
}) {
  const { monitors, error, updatedAt, reload } = useMonitors([id], {
    detail: true,
  });
  const data = monitors[id] ?? null;

  if (!data && !error) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Spinner size="md" color="current" />
      </div>
    );
  }
  return (
    <LiveMonitor
      campaignId={id}
      productNames={names}
      data={data}
      error={error}
      updatedAt={updatedAt}
      reload={reload}
    />
  );
}
