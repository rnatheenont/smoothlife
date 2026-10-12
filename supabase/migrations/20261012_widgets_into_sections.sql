-- D1: the four widgets that were really home-page sections move their
-- settings onto the page itself.
--
-- free_gift_widgets held twelve rows. Four of them — deal_of_day,
-- promotion_card, flash_sale_bar, flash_sale_shelf — were sections of the
-- home page edited on a different screen: the section drew nothing until
-- someone found the matching toggle, and its words lived in a third place.
-- The section definitions now carry those settings (src/sections/*), so this
-- moves the live values across. The other eight rows are not sections — a
-- popup, a floating button, the badge on a product card, the bar in the
-- cart — and are left exactly as they are.
--
-- Two mappings, and the second one is the one that is easy to miss:
--   config  -> the section's settings
--   enabled -> the section's own common.hidden, which is the eye icon in the
--              editor. A widget that was off becomes a section that is
--              hidden, so the page looks the same the moment it is served.
--
-- `image` is dropped on the way across: the Widgets screen offered an upload
-- for the shelf banner, but FlashSaleShelf never read it. Carrying a setting
-- nothing renders into a new home for it would be carrying the bug too.
--
-- Both documents are migrated: the draft the editor shows, and the page's
-- published revision. The published one is republished as a new numbered
-- revision rather than edited in place — a revision is a record of what was
-- live at a time, and rewriting one makes the history say something that
-- never happened.

begin;

create or replace function pg_temp.move_widgets_into_sections(doc jsonb)
returns jsonb
language sql
as $$
  select jsonb_set(doc, '{sections}', (
    select coalesce(jsonb_agg(moved order by idx), '[]'::jsonb)
    from (
      select
        case
          when w.key is null then s
          else s
            || jsonb_build_object('v', 2)
            || jsonb_build_object(
                 'settings',
                 coalesce(s->'settings', '{}'::jsonb) || (coalesce(w.config, '{}'::jsonb) - 'image')
               )
            || jsonb_build_object(
                 'common',
                 coalesce(s->'common', '{}'::jsonb) || jsonb_build_object('hidden', not w.enabled)
               )
        end as moved,
        idx
      from jsonb_array_elements(doc->'sections') with ordinality as t(s, idx)
      left join (values
        ('deal_of_day',      'deal_of_day'),
        ('free_gift_promo',  'promotion_card'),
        ('flash_sale_bar',   'flash_sale_bar'),
        ('flash_sale_shelf', 'flash_sale_shelf')
      ) as m(section_type, widget_key) on m.section_type = s->>'type'
      left join free_gift_widgets w on w.key = m.widget_key
    ) rows
  ))
$$;

-- 1. The draft every editor opens.
update pages
set draft_doc = pg_temp.move_widgets_into_sections(draft_doc::jsonb),
    draft_updated_by = 'migration:widgets_into_sections'
where kind = 'home' and slug = 'home';

-- 2. A new published revision, built from the one that is published now.
with current as (
  select p.id as page_id, r.doc, coalesce(max(r2.number), 0) + 1 as next_number
  from pages p
  join page_revisions r on r.id = p.published_revision_id
  left join page_revisions r2 on r2.page_id = p.id
  where p.kind = 'home' and p.slug = 'home'
  group by p.id, r.doc
),
inserted as (
  insert into page_revisions (page_id, number, doc, schema_version, note, published_by)
  select page_id,
         next_number,
         pg_temp.move_widgets_into_sections(doc),
         (doc->>'schemaVersion')::int,
         'ย้าย config ของ widget 4 ตัวเข้า section (D1) — หน้าตาเหมือนเดิมทุกจุด',
         'migration:widgets_into_sections'
  from current
  returning id, page_id
)
update pages p
set published_revision_id = inserted.id
from inserted
where p.id = inserted.page_id;

commit;
