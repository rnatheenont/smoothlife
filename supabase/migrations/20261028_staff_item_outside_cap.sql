-- An item can sit outside the allowance.
--
-- Asked for on 28 Oct 2026 for one line (LEXS Lactis, ฿1,800 against a
-- ฿1,000 allowance): the employee pays the full staff price, but buying it
-- does not use up any of the allowance. It still counts as the person's one
-- order of the round and still obeys its per-item limit and quota — only the
-- money rule is lifted.
--
-- So an order now carries two numbers. subtotal_thb is what 2C2P charges and
-- is unchanged. cap_charged_thb is the part of it that came out of the
-- allowance, and it is the only number the entitlement ledger moves by —
-- hold, payment, late payment, release and refund all read it. Writing it on
-- the order at hold time, rather than re-deriving it from the items, means a
-- flag changed while somebody is paying cannot make the ledger give back a
-- different amount from the one it took.

alter table public.staff_round_items
  add column if not exists counts_toward_cap boolean not null default true;

comment on column public.staff_round_items.counts_toward_cap is
  'False = paid at the staff price but not charged against the allowance.';

alter table public.staff_orders
  add column if not exists cap_charged_thb numeric(10, 2);

-- Every order so far was charged in full.
update public.staff_orders set cap_charged_thb = subtotal_thb where cap_charged_thb is null;

alter table public.staff_orders
  alter column cap_charged_thb set not null,
  add constraint staff_orders_cap_charged_range
    check (cap_charged_thb >= 0 and cap_charged_thb <= subtotal_thb);

comment on column public.staff_orders.cap_charged_thb is
  'Part of subtotal_thb charged against the allowance; the ledger moves by this.';

-- ---------------------------------------------------------------------------
create or replace function public.staff_create_order(p_round uuid, p_user uuid, p_lines jsonb)
 returns jsonb
 language plpgsql
as $function$
declare
  v_round     public.staff_rounds;
  v_ent       public.staff_entitlements;
  v_item      public.staff_round_items;
  v_canon     text;
  v_line      jsonb;
  v_qty       integer;
  v_limit     integer;
  v_orders    integer;
  v_already   integer;
  v_subtotal  numeric(10, 2) := 0;
  v_capped    numeric(10, 2) := 0;
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

    if exists (
      select 1 from public.staff_eligibility
      where kind = 'block_email' and value = v_canon and revoked_at is null
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'not_eligible';
    end if;

    if exists (
      select 1 from public.staff_orders
      where round_id = p_round and user_id = p_user and status = 'pending'
    ) then
      raise exception 'pending_order_exists';
    end if;

    -- How many times this person may buy in this round at all. Only
    -- 'pending' and 'paid' count: a cart that expired or was cancelled was
    -- never a purchase, and one the admin refunded has been undone.
    if v_round.max_orders is not null then
      select count(*) into v_orders
      from public.staff_orders
      where round_id = p_round and user_id = p_user and status in ('pending', 'paid');

      if v_orders >= v_round.max_orders then
        raise exception 'order_limit_reached'
          using detail = jsonb_build_object('limit', v_round.max_orders, 'used', v_orders)::text;
      end if;
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

      -- The round's blanket cap and the item's own, whichever bites first.
      v_limit := least(v_item.per_person_limit, v_round.max_per_item);

      if v_limit is not null then
        select coalesce(sum(nullif(l->>'qty', '')::integer), 0) into v_already
        from public.staff_orders o
        cross join lateral jsonb_array_elements(o.lines) l
        where o.round_id = p_round and o.user_id = p_user
          and o.status in ('pending', 'paid')
          and l->>'variant_id' = v_item.variant_id;

        if v_already + v_qty > v_limit then
          raise exception 'per_person_limit'
            using detail = jsonb_build_object(
              'variant_id', v_item.variant_id,
              'limit', v_limit,
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
      if v_item.counts_toward_cap then
        v_capped := v_capped + v_item.staff_price * v_qty;
      end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_item.variant_id,
        'product_slug', v_item.product_slug,
        'qty', v_qty,
        'staff_price', v_item.staff_price,
        'regular_price', v_item.regular_price,
        'counts_toward_cap', v_item.counts_toward_cap));
    end loop;

    -- Only the part of the cart that comes out of the allowance is checked
    -- against it; an item outside the allowance is paid for but not counted.
    if v_ent.reserved_thb + v_ent.spent_thb + v_capped > v_ent.cap_thb then
      raise exception 'over_cap'
        using detail = jsonb_build_object(
          'remaining_thb', v_ent.cap_thb - v_ent.reserved_thb - v_ent.spent_thb,
          'subtotal_thb', v_capped)::text;
    end if;

    update public.staff_entitlements
      set reserved_thb = reserved_thb + v_capped, updated_at = now()
      where round_id = p_round and user_id = p_user;

    v_expires := now() + make_interval(mins => v_round.payment_window_min);

    insert into public.staff_orders (round_id, user_id, staff_email, lines, subtotal_thb, cap_charged_thb, expires_at)
    values (p_round, p_user, v_canon, v_lines, v_subtotal, v_capped, v_expires)
    returning id into v_order_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order_id,
      'subtotal_thb', v_subtotal,
      'cap_charged_thb', v_capped,
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
$function$;

-- ---------------------------------------------------------------------------
-- Payment. The amount check still compares against subtotal_thb — 2C2P is
-- charged the whole cart — while the ledger moves by cap_charged_thb.
create or replace function public.staff_confirm_payment(p_reference text, p_amount numeric)
 returns jsonb
 language plpgsql
as $function$
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

  -- 2C2P retries: the second delivery is a no-op, not a second sale.
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

  -- Branch on status, not on the clock: 'pending' means the hold is still
  -- held, 'expired' means the sweep gave it back and we must retake it.
  if v_order.status = 'pending' then
    update public.staff_entitlements
      set reserved_thb = greatest(reserved_thb - v_order.cap_charged_thb, 0),
          spent_thb = spent_thb + v_order.cap_charged_thb,
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
    if v_ent.reserved_thb + v_ent.spent_thb + v_order.cap_charged_thb > v_ent.cap_thb then
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
      set spent_thb = spent_thb + v_order.cap_charged_thb, updated_at = now()
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
$function$;

-- ---------------------------------------------------------------------------
create or replace function public.staff_release_order(p_order uuid, p_status text)
 returns boolean
 language plpgsql
as $function$
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
    set reserved_thb = greatest(reserved_thb - v_order.cap_charged_thb, 0), updated_at = now()
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
$function$;

-- ---------------------------------------------------------------------------
create or replace function public.staff_refund_restore(p_order uuid)
 returns jsonb
 language plpgsql
as $function$
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
    set spent_thb = greatest(spent_thb - v_order.cap_charged_thb, 0), updated_at = now()
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

  return jsonb_build_object('ok', true, 'restored_thb', v_order.cap_charged_thb);
end;
$function$;
