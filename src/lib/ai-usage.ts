// Token usage and cost per Claude API call, so what a feature really costs is
// measured rather than estimated. Each call writes one line to the server log
// and one row to ai_usage_log (token counts only — no customer, no photo, no
// text). Logging never fails the request it describes.
//
//   select feature, count(*), avg(input_tokens), avg(output_tokens), avg(cost_usd), sum(cost_usd)
//   from ai_usage_log where created_at > now() - interval '30 days' group by feature;

import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// US$ per million tokens (claude.com/pricing, Sept 2026). Thinking is billed
// as output and is already included in output_tokens.
const PRICES: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-sonnet-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  "claude-opus-5": { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  "claude-haiku-4-5": { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
};

export type ApiUsage = {
  input_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  output_tokens?: number;
  output_tokens_details?: { thinking_tokens?: number | null } | null;
};

function priceFor(model: string) {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  return key ? PRICES[key] : null;
}

export async function logAiUsage(entry: {
  feature: string;
  model: string;
  outcome: string;
  usage: ApiUsage | null | undefined;
  photos?: number;
  durationMs?: number;
}) {
  const u = entry.usage ?? {};
  const row = {
    feature: entry.feature,
    model: entry.model,
    outcome: entry.outcome,
    photos: entry.photos ?? null,
    input_tokens: u.input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    thinking_tokens: u.output_tokens_details?.thinking_tokens ?? 0,
    cost_usd: null as number | null,
    duration_ms: entry.durationMs ?? null,
  };
  const price = priceFor(entry.model);
  if (price) {
    const cost =
      (row.input_tokens * price.input +
        row.cache_write_tokens * price.cacheWrite +
        row.cache_read_tokens * price.cacheRead +
        row.output_tokens * price.output) /
      1_000_000;
    row.cost_usd = Math.round(cost * 1_000_000) / 1_000_000;
  }

  console.log(
    `[ai-usage] ${row.feature} outcome=${row.outcome} model=${row.model}` +
      (row.photos !== null ? ` photos=${row.photos}` : "") +
      ` input=${row.input_tokens} cache_write=${row.cache_write_tokens} cache_read=${row.cache_read_tokens}` +
      ` output=${row.output_tokens} thinking=${row.thinking_tokens}` +
      ` cost_usd=${row.cost_usd ?? "?"} ms=${row.duration_ms ?? "?"}`
  );

  if (!supabaseConfigured()) return;
  try {
    await supabaseRest("ai_usage_log", { method: "POST", returning: false, body: JSON.stringify(row) });
  } catch (err) {
    console.error("[ai-usage] insert failed", err);
  }
}
