-- Staff Sale: the five writes that have to be one statement each.
--
-- Everything that can oversell or overspend lives here rather than in the
-- route handler, for the reason the flash sale taught us the hard way: a
-- cap checked by reading a row and then writing it is a cap that two tabs,
-- or two 2C2P webhook deliveries, walk straight through. Each function
-- below locks the row it is about to change before it reads the number it
-- is about to trust.
--
-- Not SECURITY DEFINER, on purpose. The only caller is the server with the
-- service role, which bypasses RLS already, so a definer function here
-- would be a privilege nobody needs and an endpoint somebody could find.
-- Execute is revoked from anon and authenticated at the bottom.
--
-- Shape of every return: `{ok: true, ...}` or `{ok: false, reason: '...'}`.
-- A rule that fails is not an exception to the caller — it is an answer the
-- page has to show in Thai — but it *is* an exception internally, so that
-- the quota and cap increments made before the failing line are rolled back.
-- That is what the inner `begin ... exception` block is for: a plpgsql
-- block with a handler is a subtransaction, and raising inside it undoes
-- the work inside it. Returning early instead would leave a reservation
-- behind on every rejected cart.

-- ---------------------------------------------------------------------------
-- `somchai+promo@SMOOTH-E.com` and `somchai@smooth-e.com` are one person.
-- If the company mail server accepts plus-addressing — most do — then
-- without this one employee has an unlimited supply of fresh identities.
-- ---------------------------------------------------------------------------
create or replace function public.staff_canon_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null then null
    when position('@' in p_email) = 0 then null
    else lower(split_part(split_part(p_email, '@', 1), '+', 1))
         || '@' || lower(split_part(p_email, '@', 2))
  end;
$$;

-- ---------------------------------------------------------------------------
-- Called after the email OTP has already been proven, once per round.
--
-- The two unique constraints on staff_verifications do the work that no
-- amount of checking-before-inserting could: one account cannot collect
-- several company emails to multiply its cap, and one company email cannot
-- be spread over several accounts.
-- ---------------------------------------------------------------------------
create or replace function public.staff_verify(p_round uuid, p_user uuid, p_email text)
returns jsonb
language plpgsql
as $$
declare
  v_canon text;
  v_round public.staff_rounds;
begin
  v_canon := public.staff_canon_email(p_email);
  if v_canon is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;

  select * into v_round from public.staff_rounds where id = p_round;
  if not found or v_round.status <> 'open'
     or now() < v_round.starts_at or now() > v_round.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'round_closed');
  end if;

  -- A block beats an allow, and it is checked first so that adding somebody
  -- to the blocklist is enough on its own — nobody has to remember to also
  -- remove the allow row or the domain that covers them.
  if exists (
    select 1 from public.staff_eligibility
    where kind = 'block_email' and value = v_canon and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  -- The domain is matched exactly, not by suffix: a suffix test lets
  -- `smooth-e.com.example.net` through.
  if not exists (
    select 1 from public.staff_eligibility
    where revoked_at is null and (expires_at is null or expires_at > now())
      and ((kind = 'allow_email' and value = v_canon)
        or (kind = 'allow_domain' and value = split_part(v_canon, '@', 2)))
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  begin
    insert into public.staff_verifications (round_id, user_id, staff_email_canonical)
    values (p_round, p_user, v_canon);
  exception when unique_violation then
    -- Verifying the same pair twice is a person re-running OTP, which is
    -- fine. Anything else is one of the two constraints above refusing.
    if not exists (
      select 1 from public.staff_verifications
      where round_id = p_round and user_id = p_user and staff_email_canonical = v_canon
    ) then
      return jsonb_build_object('ok', false, 'reason', 'email_or_account_taken');
    end if;
  end;

  -- The cap is copied, not read live from the round: raising the cap
  -- mid-round should be a decision taken about the people already in it,
  -- not something that happens to them.
  insert into public.staff_entitlements (round_id, user_id, cap_thb)
  values (p_round, p_user, v_round.cap_thb)
  on conflict (round_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'email', v_canon, 'cap_thb', v_round.cap_thb);
end;
$$;

-- ---------------------------------------------------------------------------
-- The one that must not be racy.
--
-- Order of locks is fixed — the entitlement first, then the items by
-- variant_id — because two employees buying the same two products in
-- opposite order is otherwise a deadlock waiting for a quiet afternoon.
--
-- Prices come from staff_round_items, never from the request body. The
-- browser is told the prices so it can show a total; it is not believed.
-- ---------------------------------------------------------------------------
create or replace function public.staff_create_order(p_round uuid, p_user uuid, p_lines jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_round     public.staff_rounds;
  v_ent       public.staff_entitlements;
  v_item      public.staff_round_items;
  v_canon     text;
  v_line      jsonb;
  v_qty       integer;
  v_already   integer;
  v_subtotal  numeric(10, 2) := 0;
  v_lines     jsonb := '[]'::jsonb;
  v_order_id  uuid;
  v_expires   timestamptz;
  v_reason    text;
  v_detail    text;
begin
  begin
    if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'empty_cart';
    end if;

    -- The same variant twice would be reserved twice and checked against the
    -- per-person limit once. The cart is supposed to send one line per
    -- variant with a quantity; this is the refusal, not a merge, so that a
    -- cart bug is visible rather than quietly rounded off.
    if (select count(distinct value->>'variant_id') from jsonb_array_elements(p_lines))
       <> jsonb_array_length(p_lines) then
      raise exception 'duplicate_lines';
    end if;

    select * into v_round from public.staff_rounds where id = p_round;
    if not found or v_round.status <> 'open'
       or now() < v_round.starts_at or now() > v_round.ends_at then
      raise exception 'round_closed';
    end if;

    select * into v_ent from public.staff_entitlements
      where round_id = p_round and user_id = p_user
      for update;
    if not found then
      raise exception 'not_verified';
    end if;

    select staff_email_canonical into v_canon from public.staff_verifications
      where round_id = p_round and user_id = p_user;

    -- Checked again here, not only at verification: somebody can resign
    -- between opening the page and pressing pay.
    if exists (
      select 1 from public.staff_eligibility
      where kind = 'block_email' and value = v_canon and revoked_at is null
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'not_eligible';
    end if;

    -- The partial unique index would catch this too; caught here so the
    -- page can say "you already have an order waiting for payment" and
    -- offer to continue it.
    if exists (
      select 1 from public.staff_orders
      where round_id = p_round and user_id = p_user and status = 'pending'
    ) then
      raise exception 'pending_order_exists';
    end if;

    for v_line in
      select value from jsonb_array_elements(p_lines)
      order by value->>'variant_id'
    loop
      v_qty := coalesce(nullif(v_line->>'qty', '')::integer, 0);
      if v_qty <= 0 then
        raise exception 'bad_qty';
      end if;

      select * into v_item from public.staff_round_items
        where round_id = p_round and variant_id = v_line->>'variant_id'
        for update;
      if not found or not v_item.enabled then
        raise exception 'item_unavailable'
          using detail = jsonb_build_object('variant_id', v_line->>'variant_id')::text;
      end if;

      if v_item.per_person_limit is not null then
        -- Counts what this person already holds of this variant in this
        -- round, paid or waiting to be paid.
        select coalesce(sum(nullif(l->>'qty', '')::integer), 0) into v_already
        from public.staff_orders o
        cross join lateral jsonb_array_elements(o.lines) l
        where o.round_id = p_round and o.user_id = p_user
          and o.status in ('pending', 'paid')
          and l->>'variant_id' = v_item.variant_id;

        if v_already + v_qty > v_item.per_person_limit then
          raise exception 'per_person_limit'
            using detail = jsonb_build_object(
              'variant_id', v_item.variant_id,
              'limit', v_item.per_person_limit,
              'already', v_already)::text;
        end if;
      end if;

      if v_item.total_quota is not null
         and v_item.reserved_qty + v_item.sold_qty + v_qty > v_item.total_quota then
        raise exception 'sold_out'
          using detail = jsonb_build_object(
            'variant_id', v_item.variant_id,
            'left', v_item.total_quota - v_item.reserved_qty - v_item.sold_qty)::text;
      end if;

      update public.staff_round_items
        set reserved_qty = reserved_qty + v_qty, updated_at = now()
        where id = v_item.id;

      v_subtotal := v_subtotal + v_item.staff_price * v_qty;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_item.variant_id,
        'product_slug', v_item.product_slug,
        'qty', v_qty,
        'staff_price', v_item.staff_price,
        'regular_price', v_item.regular_price));
    end loop;

    if v_ent.reserved_thb + v_ent.spent_thb + v_subtotal > v_ent.cap_thb then
      raise exception 'over_cap'
        using detail = jsonb_build_object(
          'remaining_thb', v_ent.cap_thb - v_ent.reserved_thb - v_ent.spent_thb,
          'subtotal_thb', v_subtotal)::text;
    end if;

    update public.staff_entitlements
      set reserved_thb = reserved_thb + v_subtotal, updated_at = now()
      where round_id = p_round and user_id = p_user;

    v_expires := now() + make_interval(mins => v_round.payment_window_min);

    insert into public.staff_orders (round_id, user_id, staff_email, lines, subtotal_thb, expires_at)
    values (p_round, p_user, v_canon, v_lines, v_subtotal, v_expires)
    returning id into v_order_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order_id,
      'subtotal_thb', v_subtotal,
      'expires_at', v_expires,
      'lines', v_lines);

  exception when raise_exception then
    get stacked diagnostics v_reason = message_text, v_detail = pg_exception_detail;
    if v_detail is null or v_detail = '' then
      return jsonb_build_object('ok', false, 'reason', v_reason);
    end if;
    return jsonb_build_object('ok', false, 'reason', v_reason, 'detail', v_detail::jsonb);
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2C2P has paid. Turn the hold into money spent.
--
-- The branch is on `status`, not on the clock: `pending` means the hold is
-- still held and this payment consumes it; `expired` means the sweep has
-- already given the allowance back and we have to take it again. Deciding
-- by comparing `now()` against expires_at instead would double-count every
-- payment that lands in the seconds between the two.
-- ---------------------------------------------------------------------------
create or replace function public.staff_confirm_payment(p_reference text, p_amount numeric)
returns jsonb
language plpgsql
as $$
declare
  v_order public.staff_orders;
  v_line  jsonb;
  v_qty   integer;
  v_ent   public.staff_entitlements;
  v_short text;
begin
  select * into v_order from public.staff_orders
    where payment_reference = p_reference
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reference');
  end if;

  -- 2C2P retries. The second delivery must be a no-op, not a second sale.
  if v_order.status = 'paid' then
    return jsonb_build_object('ok', true, 'already_paid', true, 'order_id', v_order.id);
  end if;
  if v_order.status not in ('pending', 'expired') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', v_order.status);
  end if;
  if round(p_amount, 2) <> round(v_order.subtotal_thb, 2) then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch',
      'expected_thb', v_order.subtotal_thb, 'paid_thb', p_amount);
  end if;

  select * into v_ent from public.staff_entitlements
    where round_id = v_order.round_id and user_id = v_order.user_id
    for update;

  if v_order.status = 'pending' then
    update public.staff_entitlements
      set reserved_thb = greatest(reserved_thb - v_order.subtotal_thb, 0),
          spent_thb = spent_thb + v_order.subtotal_thb,
          updated_at = now()
      where round_id = v_order.round_id and user_id = v_order.user_id;

    for v_line in select value from jsonb_array_elements(v_order.lines) loop
      v_qty := coalesce(nullif(v_line->>'qty', '')::integer, 0);
      update public.staff_round_items
        set reserved_qty = greatest(reserved_qty - v_qty, 0),
            sold_qty = sold_qty + v_qty,
            updated_at = now()
        where round_id = v_order.round_id and variant_id = v_line->>'variant_id';
    end loop;
  else
    -- Late. The allowance and the quota were handed back; see whether they
    -- are still there to take. If they are not, the money is real and the
    -- goods are not: that is a human decision, flagged rather than guessed.
    if v_ent.reserved_thb + v_ent.spent_thb + v_order.subtotal_thb > v_ent.cap_thb then
      v_short := 'cap';
    else
      select string_agg(l->>'variant_id', ',') into v_short
      from jsonb_array_elements(v_order.lines) l
      join public.staff_round_items i
        on i.round_id = v_order.round_id and i.variant_id = l->>'variant_id'
      where i.total_quota is not null
        and i.reserved_qty + i.sold_qty + coalesce(nullif(l->>'qty', '')::integer, 0) > i.total_quota;
    end if;

    if v_short is not null then
      update public.staff_orders
        set needs_refund = true,
            note = coalesce(note || ' · ', '')
                   || 'paid after hold expired, no room left (' || v_short || ')'
        where id = v_order.id;
      return jsonb_build_object('ok', false, 'reason', 'late_needs_refund', 'short', v_short,
        'order_id', v_order.id);
    end if;

    update public.staff_entitlements
      set spent_thb = spent_thb + v_order.subtotal_thb, updated_at = now()
      where round_id = v_order.round_id and user_id = v_order.user_id;

    for v_line in select value from jsonb_array_elements(v_order.lines) loop
      v_qty := coalesce(nullif(v_line->>'qty', '')::integer, 0);
      update public.staff_round_items
        set sold_qty = sold_qty + v_qty, updated_at = now()
        where round_id = v_order.round_id and variant_id = v_line->>'variant_id';
    end loop;
  end if;

  update public.staff_orders
    set status = 'paid', paid_at = now()
    where id = v_order.id;

  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'late', v_order.status = 'expired');
end;
$$;

-- ---------------------------------------------------------------------------
-- Giving the hold back: by hand, and by the clock.
-- ---------------------------------------------------------------------------
create or replace function public.staff_release_order(p_order uuid, p_status text)
returns boolean
language plpgsql
as $$
declare
  v_order public.staff_orders;
  v_line  jsonb;
  v_qty   integer;
begin
  select * into v_order from public.staff_orders where id = p_order for update;
  if not found or v_order.status <> 'pending' then
    return false;
  end if;

  update public.staff_entitlements
    set reserved_thb = greatest(reserved_thb - v_order.subtotal_thb, 0), updated_at = now()
    where round_id = v_order.round_id and user_id = v_order.user_id;

  for v_line in select value from jsonb_array_elements(v_order.lines) loop
    v_qty := coalesce(nullif(v_line->>'qty', '')::integer, 0);
    update public.staff_round_items
      set reserved_qty = greatest(reserved_qty - v_qty, 0), updated_at = now()
      where round_id = v_order.round_id and variant_id = v_line->>'variant_id';
  end loop;

  update public.staff_orders set status = p_status where id = v_order.id;
  return true;
end;
$$;

create or replace function public.staff_cancel_order(p_order uuid, p_user uuid default null)
returns jsonb
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.staff_orders where id = p_order;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- p_user null is the admin and the webhook's rollback path; a value is an
  -- employee cancelling their own, and it has to be their own.
  if p_user is not null and p_user <> v_owner then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public.staff_release_order(p_order, 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Run by pg_cron every 30 seconds — Vercel cron cannot go under a day on
-- this project, see the flash sale's own sweep.
create or replace function public.staff_sweep()
returns integer
language plpgsql
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.staff_orders
    where status = 'pending' and expires_at < now()
    order by expires_at
    limit 200
  loop
    if public.staff_release_order(v_id, 'expired') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A refund hands the allowance and the stock back. Admin-triggered: a
-- refund in Shopify is not something this database hears about.
-- ---------------------------------------------------------------------------
create or replace function public.staff_refund_restore(p_order uuid)
returns jsonb
language plpgsql
as $$
declare
  v_order public.staff_orders;
  v_line  jsonb;
  v_qty   integer;
begin
  select * into v_order from public.staff_orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_order.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid', 'status', v_order.status);
  end if;

  update public.staff_entitlements
    set spent_thb = greatest(spent_thb - v_order.subtotal_thb, 0), updated_at = now()
    where round_id = v_order.round_id and user_id = v_order.user_id;

  for v_line in select value from jsonb_array_elements(v_order.lines) loop
    v_qty := coalesce(nullif(v_line->>'qty', '')::integer, 0);
    update public.staff_round_items
      set sold_qty = greatest(sold_qty - v_qty, 0), updated_at = now()
      where round_id = v_order.round_id and variant_id = v_line->>'variant_id';
  end loop;

  update public.staff_orders
    set status = 'refunded', needs_refund = false
    where id = v_order.id;

  return jsonb_build_object('ok', true, 'restored_thb', v_order.subtotal_thb);
end;
$$;

revoke all on function
  public.staff_canon_email(text),
  public.staff_verify(uuid, uuid, text),
  public.staff_create_order(uuid, uuid, jsonb),
  public.staff_confirm_payment(text, numeric),
  public.staff_release_order(uuid, text),
  public.staff_cancel_order(uuid, uuid),
  public.staff_sweep(),
  public.staff_refund_restore(uuid)
from anon, authenticated, public;
