-- Merging two accounts that are the same person.
--
-- Every login channel identifies somebody by a different string: an email,
-- a phone number, a Google subject, a LINE user id. A person who signs in
-- by one channel today and another tomorrow is two rows in `users`, each
-- with its own orders, points and tier, and neither knows about the other.
-- Four such pairs exist today; three of them were made in a single week by
-- the staff sale's own email verification, which asked people to prove a
-- @smooth-e.com address they had never used to shop with.
--
-- So: a shopper who proves they hold the other channel may fold the two
-- together. Proving it is the whole of the authorisation — reading an OTP
-- out of that mailbox, or completing that provider's OAuth, is exactly what
-- signing in as that account would have required, so this gives an attacker
-- nothing that logging in would not.
--
-- The hard part is not the permission, it is being exhaustive. User data is
-- spread over thirty tables, and a merge that misses one leaves the shopper
-- with half their history and no way to tell. Listing those tables here by
-- hand would be a list that rots on the next migration, so this reads them
-- out of the catalogue: every column with a foreign key to users, plus the
-- few that reference it without one. A table added next month is covered
-- the day it is added.

-- ---------------------------------------------------------------------------
-- What was merged, kept for ever.
-- ---------------------------------------------------------------------------
-- A merge cannot be undone — the loser's rows are rewritten in place, not
-- copied — so what it did is written down before anyone asks. The row count
-- per table is here because "where did my order go" is answered by reading
-- it, not by trusting that this worked.
create table if not exists public.account_merges (
  id             uuid primary key default gen_random_uuid(),
  survivor_id    uuid not null references public.users(id) on delete cascade,
  -- Deliberately not a foreign key: the row it pointed at is gone by the
  -- time this is written, and that id is the only record that it existed.
  loser_id       uuid not null,
  -- Which channel the shopper proved to earn the merge, e.g. 'email'.
  proved_via     text,
  proved_uid     text,
  -- {"orders": 3, "points_ledger": 12, …} — one entry per table touched.
  moved          jsonb not null default '{}'::jsonb,
  -- The loser's own user row, verbatim, so a mistaken merge can be read
  -- back even though it cannot be rolled back.
  loser_snapshot jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists account_merges_survivor_idx on public.account_merges (survivor_id);
create index if not exists account_merges_loser_idx on public.account_merges (loser_id);

alter table public.account_merges enable row level security;
revoke all on public.account_merges from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which columns point at a user.
-- ---------------------------------------------------------------------------
-- The catalogue answers most of it. The rest are columns that hold a user id
-- without declaring a foreign key — they are listed because leaving a
-- shopper's payments behind would be the worst possible omission, not
-- because the absent constraint is right.
--
-- `shopify_*` tables are not here on purpose: their user_id is text, and it
-- belongs to the embedded Shopify app's own notion of a user, not to
-- public.users.
create or replace function public.user_owned_columns()
returns table (table_name text, column_name text)
language sql
stable
as $$
  select c.relname::text, a.attname::text
    from pg_constraint fk
    join pg_class c on c.oid = fk.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = fk.conkey[1]
   where fk.contype = 'f'
     and fk.confrelid = 'public.users'::regclass
     and n.nspname = 'public'
     and array_length(fk.conkey, 1) = 1
     and c.relname <> 'account_merges'
  union
  select t, 'user_id'
    from unnest(array['payment_transactions', 'conversations', 'channel_account_links']) t
   where to_regclass('public.' || t) is not null;
$$;

-- ---------------------------------------------------------------------------
-- The merge itself.
-- ---------------------------------------------------------------------------
-- Not SECURITY DEFINER: the caller is the service role already, and a
-- function this destructive should not also carry its own privileges.
--
-- Both user rows are locked first, in id order, so two merges racing each
-- other over the same pair cannot interleave — without that, two tabs could
-- each decide the other account is the loser and leave both empty.
create or replace function public.merge_user_accounts(
  p_survivor  uuid,
  p_loser     uuid,
  p_proved_via text default null,
  p_proved_uid text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_rel      record;
  v_idx      record;
  v_moved    jsonb := '{}'::jsonb;
  v_n        bigint;
  v_match    text;
  v_pred     text;
  v_snapshot jsonb;
  v_first    uuid;
  v_second   uuid;
begin
  if p_survivor is null or p_loser is null then
    raise exception 'ids_required' using errcode = 'P0001';
  end if;
  if p_survivor = p_loser then
    raise exception 'same_account' using errcode = 'P0001';
  end if;

  -- Lock in a fixed order, never in the order the caller happened to pass.
  v_first  := least(p_survivor, p_loser);
  v_second := greatest(p_survivor, p_loser);
  perform 1 from public.users where id = v_first for update;
  perform 1 from public.users where id = v_second for update;

  if not exists (select 1 from public.users where id = p_survivor) then
    raise exception 'survivor_not_found' using errcode = 'P0001';
  end if;
  select to_jsonb(u) into v_snapshot from public.users u where u.id = p_loser;
  if v_snapshot is null then
    raise exception 'loser_not_found' using errcode = 'P0001';
  end if;

  for v_rel in select * from public.user_owned_columns() order by 1, 2
  loop
    -- Rows that cannot move, because the survivor already has their
    -- equivalent: the same day's check-in, the same product's review, the
    -- same round's verification. The survivor's copy is the one kept —
    -- it is the account the shopper is keeping, and one of the two has to
    -- go for the unique index to hold.
    for v_idx in
      select (select array_agg(a.attname::text order by k.ord)
                from unnest(i.indkey::int[]) with ordinality k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = i.indrelid and a.attnum = k.attnum) as cols,
             pg_get_expr(i.indpred, i.indrelid) as pred
        from pg_index i
       where i.indrelid = ('public.' || v_rel.table_name)::regclass
         and i.indisunique
         -- An expression index would not survive being rebuilt as text
         -- below; none exists on these tables today, and skipping one is
         -- safer than emitting SQL that is wrong.
         and 0 <> all (i.indkey::int[])
         and exists (
           select 1 from unnest(i.indkey::int[]) ik
            join pg_attribute a2 on a2.attrelid = i.indrelid and a2.attnum = ik
           where a2.attname = v_rel.column_name
         )
    loop
      -- The other key columns have to match for it to be the same row.
      -- `is not distinct from` because a null in a key is still a value
      -- two rows can share.
      select coalesce(string_agg(
               format('s.%I is not distinct from l.%I', c, c), ' and '), 'true')
        into v_match
        from unnest(v_idx.cols) c
       where c <> v_rel.column_name;

      -- A partial index only forbids the collision among rows its predicate
      -- admits. Bare column names inside it bind to whichever alias is in
      -- scope, which is `l` outside and `s` inside the subquery — which is
      -- exactly what is wanted in each.
      v_pred := coalesce(' and (' || v_idx.pred || ')', '');

      execute format(
        'delete from public.%I l where l.%I = $2%s and exists ('
          || 'select 1 from public.%I s where s.%I = $1 and %s%s)',
        v_rel.table_name, v_rel.column_name, v_pred,
        v_rel.table_name, v_rel.column_name, v_match, v_pred
      ) using p_survivor, p_loser;
    end loop;

    execute format('update public.%I set %I = $1 where %I = $2',
                   v_rel.table_name, v_rel.column_name, v_rel.column_name)
      using p_survivor, p_loser;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_moved := v_moved || jsonb_build_object(
        v_rel.table_name || '.' || v_rel.column_name, v_n);
    end if;
  end loop;

  -- Two default addresses is not a state the account page can draw, and the
  -- survivor's was the shopper's most recent choice.
  update public.addresses set is_default = false
   where user_id = p_survivor
     and is_default
     and id <> (select id from public.addresses
                 where user_id = p_survivor and is_default
                 order by updated_at desc nulls last, created_at desc limit 1);

  -- Facts the survivor simply lacks are worth keeping; ones it already has
  -- are not overwritten, because the account being kept is the one the
  -- shopper chose to keep.
  update public.users s set
      phone       = coalesce(s.phone,       v_snapshot->>'phone'),
      birthdate   = coalesce(s.birthdate,  (v_snapshot->>'birthdate')::date),
      gender      = coalesce(s.gender,      v_snapshot->>'gender'),
      avatar_url  = coalesce(s.avatar_url,  v_snapshot->>'avatar_url'),
      -- Only when the survivor has none: two different Shopify customers
      -- cannot be merged from this side, and overwriting the live link
      -- would strand the order history it points at.
      shopify_customer_id = coalesce(s.shopify_customer_id,
                                     v_snapshot->>'shopify_customer_id')
   where s.id = p_survivor;

  -- The tier is a rolling total over orders that just changed hands. Null
  -- the review stamp rather than compute it here — the loyalty cron owns
  -- that sum, and two places computing it is how they come to disagree.
  update public.user_loyalty set last_reviewed_at = null where user_id = p_survivor;

  delete from public.users where id = p_loser;

  insert into public.account_merges
    (survivor_id, loser_id, proved_via, proved_uid, moved, loser_snapshot)
  values
    (p_survivor, p_loser, p_proved_via, p_proved_uid, v_moved, v_snapshot);

  return jsonb_build_object(
    'ok', true,
    'survivor', p_survivor,
    'loser', p_loser,
    'moved', v_moved
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- What the shopper is about to agree to.
-- ---------------------------------------------------------------------------
-- The page says "this other account holds 3 orders and 240 points, and it is
-- the one you will keep" before anything happens. These are the numbers it
-- says, counted the same way the account page counts them, so the two cannot
-- disagree at the moment it matters most.
create or replace function public.account_merge_preview(p_a uuid, p_b uuid)
returns jsonb
language sql
stable
as $$
  with side as (
    select u.id,
           u.display_name,
           u.created_at,
           u.shopify_customer_id,
           (select count(*) from public.payment_transactions t
             where t.user_id = u.id and t.status = 'success')          as orders,
           -- From the same view the account page reads, not a second sum
           -- over the ledger that could come to differ from it.
           (select coalesce(b.balance, 0) from public.points_balance b
             where b.user_id = u.id)                                   as points,
           (select coalesce(array_agg(distinct a.provider order by a.provider), '{}')
              from public.auth_identities a where a.user_id = u.id)    as channels
      from public.users u
     where u.id in (p_a, p_b)
  )
  select jsonb_build_object(
    -- The older account is the one kept. It is the one carrying the order
    -- history and, usually, the Shopify customer the orders hang off; and
    -- "member since" reading later than a shopper's first order is the kind
    -- of small wrongness nobody reports but everybody notices.
    'survivor', (select id from side order by created_at asc limit 1),
    'accounts', (select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', display_name,
        'created_at', created_at,
        'orders', orders,
        'points', points,
        'channels', channels,
        'has_shopify', shopify_customer_id is not null
      ) order by created_at asc) from side),
    -- Both sides linked to different Shopify customers: this side merges
    -- cleanly, Shopify's does not, and somebody has to join those two by
    -- hand. Said out loud rather than discovered later.
    'shopify_conflict', (
      select count(distinct shopify_customer_id) > 1
        from side where shopify_customer_id is not null
    )
  );
$$;

revoke all on function public.user_owned_columns() from anon, authenticated, public;
revoke all on function public.merge_user_accounts(uuid, uuid, text, text) from anon, authenticated, public;
revoke all on function public.account_merge_preview(uuid, uuid) from anon, authenticated, public;
