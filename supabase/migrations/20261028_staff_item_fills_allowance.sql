-- An item that takes the whole allowance — replacing "outside the allowance".
--
-- The earlier migration today (staff_item_outside_cap) let LEXS Lactis be
-- bought without touching the allowance. TOP corrected that the same
-- afternoon: buying it should be allowed even though ฿1,800 is more than the
-- ฿1,000 allowance, but it is then the person's whole allowance. So:
--
--   * one piece, alone in the cart — nothing else can ride along;
--   * the order is charged whatever is left of the allowance (all of it, on
--     a first order), so nothing is left for later in the round;
--   * the employee still pays the full staff price at 2C2P.
--
-- A new column rather than a new meaning for counts_toward_cap: the deployed
-- shop and console still select that column by name, and dropping or
-- inverting it under them would break the page until the next build. It is
-- set back to true everywhere and left unused; drop it in a later migration.
--
-- cap_charged_thb can now exceed the subtotal (a ฿1,800 item against a
-- ฿3,000 allowance charges ฿3,000), so the upper bound comes off.

alter table public.staff_round_items
  add column if not exists fills_allowance boolean not null default false;

comment on column public.staff_round_items.fills_allowance is
  'True = sold alone, one per order, and charges the whole remaining allowance.';

update public.staff_round_items set fills_allowance = true where counts_toward_cap = false;
update public.staff_round_items set counts_toward_cap = true where counts_toward_cap = false;

comment on column public.staff_round_items.counts_toward_cap is
  'Unused since 20261028_staff_item_fills_allowance; kept only for the build that still selects it. Drop later.';

alter table public.staff_orders drop constraint if exists staff_orders_cap_charged_range;
alter table public.staff_orders
  add constraint staff_orders_cap_charged_nonneg check (cap_charged_thb >= 0);

comment on column public.staff_orders.cap_charged_thb is
  'What this order took from the allowance; the ledger moves by this. May exceed subtotal_thb for a fills_allowance item.';

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
  v_fills     boolean := false;
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

      -- An item that takes the whole allowance is bought on its own, one
      -- piece: anything beside it would be riding on an allowance that is
      -- already spent.
      if v_item.fills_allowance then
        if jsonb_array_length(p_lines) <> 1 or v_qty <> 1 then
          raise exception 'fills_allowance_alone'
            using detail = jsonb_build_object('variant_id', v_item.variant_id)::text;
        end if;
        v_fills := true;
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
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_item.variant_id,
        'product_slug', v_item.product_slug,
        'qty', v_qty,
        'staff_price', v_item.staff_price,
        'regular_price', v_item.regular_price,
        'fills_allowance', v_item.fills_allowance));
    end loop;

    if v_fills then
      -- Whatever is left of the allowance, all of it. Nothing left means
      -- there is no allowance for it to take.
      v_capped := v_ent.cap_thb - v_ent.reserved_thb - v_ent.spent_thb;
      if v_capped <= 0 then
        raise exception 'over_cap'
          using detail = jsonb_build_object('remaining_thb', 0, 'subtotal_thb', v_subtotal)::text;
      end if;
    else
      v_capped := v_subtotal;
      if v_ent.reserved_thb + v_ent.spent_thb + v_capped > v_ent.cap_thb then
        raise exception 'over_cap'
          using detail = jsonb_build_object(
            'remaining_thb', v_ent.cap_thb - v_ent.reserved_thb - v_ent.spent_thb,
            'subtotal_thb', v_subtotal)::text;
      end if;
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
