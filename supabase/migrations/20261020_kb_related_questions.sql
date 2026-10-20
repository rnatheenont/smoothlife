-- "Related questions", by meaning when there is meaning to go on.
--
-- The page it feeds used to list the most recently updated questions, which
-- is not a relationship — it put a question about gift sets under a question
-- about sensitive teeth whenever somebody had edited the gift-set answer that
-- morning.
--
-- An article is represented by its lowest-numbered embedded chunk rather than
-- by the average of all of them: avg() has no vector overload in this
-- pgvector build, and chunk 0 is the Thai question, its keywords and its
-- answer — the article's primary form. Chunk 1 is the same answer in English,
-- so averaging the two would move the point very little.
--
-- The fallback matters more than the vector path does today: no chunk has an
-- embedding yet, and a function that returns nothing until an API key is
-- configured would ship a permanently empty section. Without embeddings it
-- falls back to what the team wrote down — the concerns two questions share,
-- then the topic — which is a real relationship, just a coarser one.
--
-- Concerns are compared as rows (my_concerns) rather than with the array
-- intersection operator: `&` belongs to intarray and has no text[] form, and
-- `= any ((select concerns from me))` reads as ANY-of-a-subquery, which then
-- compares text against text[].
create or replace function public.kb_related(p_article_id uuid, p_limit integer default 4)
returns table(id uuid, public_slug text, title text, score numeric)
language sql
stable
set search_path to ''
as $function$
  with me as (
    select a.id, a.topic, coalesce(a.concerns, array[]::text[]) as concerns
    from public.kb_articles a
    where a.id = p_article_id
  ),
  my_concerns as (
    select unnest(concerns) as slug from me
  ),
  my_vec as (
    select c.embedding as v
    from public.kb_chunks c
    where c.article_id = p_article_id and c.embedding is not null
    order by c.chunk_index
    limit 1
  ),
  others as (
    select a.id,
           a.public_slug,
           a.title,
           a.topic,
           coalesce(a.concerns, array[]::text[]) as concerns,
           coalesce(a.helpful_count, 0) as helpful_count,
           (
             select c.embedding
             from public.kb_chunks c
             where c.article_id = a.id and c.embedding is not null
             order by c.chunk_index
             limit 1
           ) as v
    from public.kb_articles a
    where a.status = 'published'
      and a.visibility = 'public'
      and a.public_slug is not null
      and a.id <> p_article_id
  ),
  rated as (
    select o.id,
           o.public_slug,
           o.title,
           o.helpful_count,
           o.v,
           (
             select count(*)
             from unnest(o.concerns) as c(slug)
             where c.slug in (select slug from my_concerns)
           ) as shared_concerns,
           (o.topic is not null and o.topic = (select topic from me)) as same_topic
    from others o
  )
  select r.id,
         r.public_slug,
         r.title,
         case
           when (select v from my_vec) is not null and r.v is not null
             then (1 - (r.v operator(public.<=>) (select v from my_vec)))::numeric
           else (
             0.30 * least(r.shared_concerns, 3)
             + case when r.same_topic then 0.20 else 0 end
             + least(r.helpful_count, 10) * 0.001
           )::numeric
         end as score
  from rated r
  where ((select v from my_vec) is not null and r.v is not null)
     or r.shared_concerns > 0
     or r.same_topic
  order by score desc, r.helpful_count desc, r.title asc
  limit least(greatest(coalesce(p_limit, 4), 1), 12);
$function$;
