-- Query embeddings, kept so the same question is never paid for twice.
--
-- The embedding provider allows three requests a minute on this plan. A
-- customer asking one question fits inside that; two customers searching in
-- the same minute, or the accuracy test running its sentence set, do not —
-- and a failed embedding is silent: searchKb asks for no retries (a shopper
-- cannot wait 21 seconds) so the search quietly degrades to text matching,
-- which scores 0.18-0.27 on a sentence that avoids the answer's keywords and
-- therefore returns nothing at all.
--
-- Caching does not raise the ceiling, but it stops us spending the quota on
-- questions already answered: popular searches, repeat visitors, and the
-- accuracy test re-running the same sentences every month.
--
-- Keyed on a hash of the exact text. No normalisation on purpose — the
-- embedding is of the string as sent, so anything that changes the string
-- must miss the cache.
--
-- RLS on with no policies: service role only.
create table if not exists public.kb_query_embeddings (
  hash        text primary key,
  query_text  text not null,
  embedding   vector(1024) not null,
  hits        integer not null default 0,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.kb_query_embeddings enable row level security;

create index if not exists kb_query_embeddings_last_used_idx
  on public.kb_query_embeddings (last_used_at);

-- Read-and-count in one round trip: a cache that costs an extra request to
-- say "hit" has given back part of what it saves.
create or replace function public.kb_query_embedding_get(p_hash text)
returns vector
language sql
volatile
set search_path to ''
as $function$
  update public.kb_query_embeddings
     set hits = hits + 1, last_used_at = now()
   where hash = p_hash
  returning embedding;
$function$;

revoke all on function public.kb_query_embedding_get(text) from public, anon, authenticated;
grant execute on function public.kb_query_embedding_get(text) to service_role;
