import { pgValue, supabaseRest } from "@/lib/supabase-server";

// Places in a queue that came from the same source as another account's.
//
// Not an accusation and never a block. A family sharing a router, an office,
// a campus and a mobile network's NAT all look exactly like this, and plenty
// of drops are won fairly by two people in the same house. It is shown because
// the opposite — a queue quietly farmed from one machine — looks like nothing
// at all otherwise, and somebody who can see "nine of twenty-five came from
// one place" can go and check.

export type SharedSource = {
  /** Six characters of the hash: enough to tell two groups apart, useless otherwise. */
  source: string;
  accounts: { userId: string; customer: string | null; status: string; position: number }[];
};

type Row = {
  campaign_id: string;
  user_id: string;
  status: string;
  position: number;
  source_hash: string | null;
  users?: { display_name: string | null } | null;
};

export async function sharedSourcesFor(campaignIds: string[]): Promise<Record<string, SharedSource[]>> {
  const out: Record<string, SharedSource[]> = {};
  if (!campaignIds.length) return out;

  const rows = await supabaseRest<Row[]>(
    `flash_sale_queue?campaign_id=in.(${campaignIds.map(pgValue).join(",")})&source_hash=not.is.null` +
      `&select=campaign_id,user_id,status,position,source_hash,users(display_name)&order=position&limit=1000`
  ).catch(() => [] as Row[]);

  const byCampaign = new Map<string, Map<string, Row[]>>();
  for (const row of rows) {
    if (!row.source_hash) continue;
    const sources = byCampaign.get(row.campaign_id) ?? new Map<string, Row[]>();
    sources.set(row.source_hash, [...(sources.get(row.source_hash) ?? []), row]);
    byCampaign.set(row.campaign_id, sources);
  }

  for (const id of campaignIds) {
    const sources = byCampaign.get(id) ?? new Map<string, Row[]>();
    out[id] = [...sources.entries()]
      // One account joining twice from its own machine is a person changing
      // their mind. Two different accounts is the thing worth showing.
      .filter(([, group]) => new Set(group.map((r) => r.user_id)).size > 1)
      .map(([hash, group]) => ({
        source: hash.slice(0, 6),
        accounts: [...new Map(group.map((r) => [r.user_id, r])).values()].map((r) => ({
          userId: r.user_id,
          customer: r.users?.display_name ?? null,
          status: r.status,
          position: r.position,
        })),
      }))
      .sort((a, b) => b.accounts.length - a.accounts.length);
  }
  return out;
}
