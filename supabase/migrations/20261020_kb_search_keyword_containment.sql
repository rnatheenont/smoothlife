-- Make the search survive a whole sentence.
--
-- The index already asked "is the customer's question inside this chunk?",
-- which only fires when they type the short thing. A customer who types
-- "ตาล้าจากการจ้องจอ" got nothing at all, while "ตาล้า" scored 1.000 — the
-- longer and more natural the question, the worse the match, because every
-- extra word dilutes word_similarity and breaks the containment test.
--
-- So ask it the other way round as well: is one of this article's own
-- keywords inside the customer's question? "ตาล้าจากการจ้องจอ" contains
-- "ตาล้า"; "หน้ามันเป็นสิวใช้อะไรดี" contains "สิว". Those keywords were
-- written by whoever wrote the answer, so a hit is the author saying this
-- question is mine.
--
-- This is also the fallback the search needs anyway: it costs nothing, it
-- runs when Voyage is down or rate-limited, and it is the only thing holding
-- the search up until the embeddings land.
--
-- Two things it does NOT do, both learned from the real keyword list:
--
--   Short keywords. Thai does not put spaces between words, so a substring
--   test on a two-character keyword matches almost anything — "ผม" is both
--   "hair" and "I". Three characters is the floor.
--
--   Keywords that live inside unrelated words. "LINE" is inside "online"
--   and "deadline"; "trip" is inside "strip" and "triple"; "ผ่อน" is the
--   relaxation article's keyword but also the first half of "ผ่อนชำระ", so
--   a question about paying in instalments would have scored 0.65 on an
--   article about evening supplements. "set"/"เซ็ต"/"bundle"/"gift" are the
--   gift-set articles' words and too generic to carry 0.6 on their own.
--   These are excluded by name rather than by a cleverer rule, because the
--   list is short, visible, and wrong in ways a person can see.
--
-- The score tops out at 0.85, deliberately below the 0.9 that an exact
-- containment match scores: a keyword hit is good evidence, not proof.
create or replace function public.kb_search(
  p_query text,
  p_embedding vector default null,
  p_limit integer default 6,
  p_tags text[] default null,
  p_min_score numeric default 0.42,
  p_statuses text[] default array['published']
)
returns table(article_id uuid, chunk_id uuid, title text, category text, chunk_text text, score numeric)
language sql
stable
set search_path to ''
as $function$
  with scored as (
    select c.article_id,
           c.id as chunk_id,
           a.title,
           a.category,
           c.chunk_text,
           (
             greatest(
               case
                 when p_embedding is not null and c.embedding is not null
                   then (1 - (c.embedding operator(public.<=>) p_embedding))
                 else 0
               end,
               public.word_similarity(coalesce(p_query, ''), c.chunk_text),
               public.word_similarity(coalesce(p_query, ''), a.title),
               public.word_similarity(coalesce(p_query, ''), coalesce(a.search_text, '')),
               -- The customer's whole question appears in the chunk.
               --
               -- position() rather than ilike: the question is untrusted
               -- input, and a question containing a single "%" turned the
               -- old ilike pattern into a match against everything.
               case
                 when coalesce(p_query, '') <> ''
                  and position(lower(p_query) in lower(c.chunk_text)) > 0
                   then 0.9
                 else 0
               end,
               -- One of the article's keywords appears in the question.
               coalesce((
                 select max(least(0.85, 0.60 + 0.05 * (char_length(kw) - 3)))
                 from unnest(a.keywords) as kw
                 where char_length(kw) >= 3
                   and lower(kw) <> all (array[
                         'set', 'เซ็ต', 'bundle', 'gift',
                         'line', 'ไลน์', 'trip', 'ผ่อน'
                       ])
                   and position(lower(kw) in lower(coalesce(p_query, ''))) > 0
               ), 0)
             )
             + case when p_tags is not null and a.product_tags && p_tags then 0.1 else 0 end
           )::numeric as score
    from public.kb_chunks c
    join public.kb_articles a on a.id = c.article_id
    where a.status = any(coalesce(p_statuses, array['published']))
      and a.visibility in ('public', 'ai_only')
      and coalesce(p_query, '') <> ''
  )
  select article_id, chunk_id, title, category, chunk_text, score
  from scored
  where score > coalesce(p_min_score, 0.42)
  order by score desc
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$function$;
