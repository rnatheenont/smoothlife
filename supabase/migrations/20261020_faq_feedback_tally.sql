-- Add one to an answer's helpful/not-helpful count.
--
-- A function rather than a read-then-write from the route: two readers who
-- tap at the same moment both read 4 and both write 5, and the site quietly
-- loses votes. `+ 1` in the database cannot lose one.
--
-- Only published, publicly readable answers can be counted, repeating the
-- route's own check — a count that orders a public page should not depend on
-- one caller remembering to filter.
create or replace function public.faq_feedback_tally(p_article_id uuid, p_helpful boolean)
returns void
language sql
volatile
security definer
set search_path to ''
as $function$
  update public.kb_articles
  set helpful_count = case when p_helpful then coalesce(helpful_count, 0) + 1 else coalesce(helpful_count, 0) end,
      not_helpful_count = case when p_helpful then coalesce(not_helpful_count, 0) else coalesce(not_helpful_count, 0) + 1 end
  where id = p_article_id
    and status = 'published'
    and visibility = 'public'
    and public_slug is not null;
$function$;

-- Reachable only by the server. The anon and authenticated roles have no
-- business calling it: the route in front of it is what enforces one vote per
-- visitor, and a function that increments a counter is the one thing on this
-- page worth scripting.
revoke all on function public.faq_feedback_tally(uuid, boolean) from public;
revoke all on function public.faq_feedback_tally(uuid, boolean) from anon;
revoke all on function public.faq_feedback_tally(uuid, boolean) from authenticated;
grant execute on function public.faq_feedback_tally(uuid, boolean) to service_role;

-- One vote per visitor per question, enforced here rather than only in the
-- route. The route reads "has this hash voted?" and then inserts; two taps
-- that arrive together both read "no" and both insert. The index is what
-- makes the rule true, and the route's check is what makes it quiet.
create unique index if not exists faq_feedback_one_per_visitor
  on public.faq_feedback (article_id, visitor_hash);

create index if not exists faq_feedback_article_idx
  on public.faq_feedback (article_id, created_at desc);
