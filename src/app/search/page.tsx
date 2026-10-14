import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import SearchWritten from "./SearchWritten";

/**
 * The page, from its document when wave 2 is on and from SearchWritten when
 * it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function SearchPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="search" />;
  return <SearchWritten />;
}
