import { PAGES_WAVE4_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import PointsView from "./PointsView";

/**
 * The page, from its document when wave 4 is on and from PointsView when it
 * is not. The document is what lets somebody put a line about this month's
 * redemption offer above the points table without a deploy.
 */
export default function PointsPage() {
  if (PAGES_WAVE4_ENABLED) return <SystemPageBody pageKey="account-points" />;
  return <PointsView />;
}
