import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// Which campaigns exist, and which one a request is about.
//
// There was one, and its key was a constant in nine files. There are about to
// be several, so the key comes from the URL — and is checked against the rows
// that exist, because a key is a path segment and a path segment is whatever
// a stranger types.

/** The campaign that shipped before any of this was a list. */
export const FIRST_CAMPAIGN = "dentiste-x-kengnamping";

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

export type CampaignSummary = { key: string; name: string };

/** Every campaign the team has set up, oldest first. */
export async function listCampaigns(): Promise<CampaignSummary[]> {
  if (!supabaseConfigured()) return [{ key: FIRST_CAMPAIGN, name: FIRST_CAMPAIGN }];
  const rows = await supabaseRest<{ campaign_key: string; eyebrow: string | null; title: string | null }[]>(
    `receipt_campaign_settings?select=campaign_key,eyebrow,title&order=campaign_key`
  ).catch(() => []);
  const found = rows.map((r) => ({
    key: r.campaign_key,
    name: r.eyebrow?.trim() || r.title?.trim() || r.campaign_key,
  }));
  // The original campaign predates the settings table, so it is listed even
  // when nobody has saved a row for it.
  return found.some((c) => c.key === FIRST_CAMPAIGN)
    ? found
    : [{ key: FIRST_CAMPAIGN, name: FIRST_CAMPAIGN }, ...found];
}

/**
 * The campaign a request names, or the first one.
 *
 * Shape-checked before it reaches a query: this value arrives from a URL, and
 * everything downstream trusts it to name a campaign.
 */
export function campaignKeyFrom(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase();
  return KEY_RE.test(key) ? key : FIRST_CAMPAIGN;
}
