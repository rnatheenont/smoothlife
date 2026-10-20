-- Which tools the assistant reached for, on every turn.
--
-- The log used to be written only when the knowledge-base tool had been
-- called, so a turn where the model went straight to the catalogue left no
-- row at all. That is exactly the turn worth seeing: a customer asked
-- "นอนไม่หลับ", an approved article answers it and scored 1.000, and the
-- model answered from the product search instead. Nothing in the database
-- could show whether it had even asked.
--
-- One row per turn now, with the tool calls in the order they were made.
alter table public.ai_conversation_log
  add column if not exists tools jsonb not null default '[]'::jsonb;

comment on column public.ai_conversation_log.tools is
  'Tool calls for this turn, in order: [{round, name, query, matched:[{id,score}]}]. Empty array = the model answered without calling any tool.';

-- The questions worth reading are the ones where the assistant never asked
-- the knowledge base. Partial, because that is the minority of rows.
create index if not exists ai_conversation_log_no_kb_idx
  on public.ai_conversation_log (created_at desc)
  where tools = '[]'::jsonb;
