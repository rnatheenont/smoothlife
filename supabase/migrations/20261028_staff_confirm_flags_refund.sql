-- Money that arrives for an order we can no longer fulfil must be flagged.
--
-- Found on 28 Oct 2026, watching the first real staff purchases. An employee
-- cancelled a ฿1,800 order; cancelling releases the allowance and the quota
-- on our side but does not void the payment link at 2C2P, so the payment page
-- in their open tab was still payable. Had they paid it, staff_confirm_payment
-- would have refused with 'bad_status' and returned — the webhook would have
-- recorded the transaction as success (the money is real) and nothing would
-- have set needs_refund.
--
-- The webhook's own comment says such a case is "a human's to resolve from
-- the console's ต้องจัดการ list". It would not have appeared there: that list
-- filters on needs_refund or shopify_sync_status = 'failed', and this case
-- sets neither. The sole trace would have been a console.error in the server
-- log. The late-payment path two branches down already does this correctly;
-- these two refusals are the doors that were left open.
--
-- Only the two early returns change. The paths that take the money are
-- untouched.

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
  -- Money for an order that is no longer collectable: the employee pressed
  -- cancel, or the console did, and the goods and the allowance went back to
  -- the round — by now possibly to somebody else. Cancelling here does not
  -- void the payment link at 2C2P, so a tab left open on the payment page is
  -- still payable, and this is where that payment lands.
  --
  -- Nothing can be resurrected, so the only honest outcome is a refund. The
  -- flag is how a human ever learns of it: the console's "ต้องจัดการ" list
  -- is filtered on needs_refund and shopify_sync_status, so an unflagged row
  -- is an invisible one, and the only other trace is a line in the server
  -- log that nobody is watching.
  if v_order.status not in ('pending', 'expired') then
    update public.staff_orders
      set needs_refund = true,
          note = coalesce(note || ' · ', '')
                 || 'จ่ายเงินเข้ามาหลังออเดอร์เป็น ' || v_order.status || ' — ส่งของไม่ได้ ต้องคืนเงิน'
      where id = v_order.id;
    return jsonb_build_object('ok', false, 'reason', 'bad_status',
      'status', v_order.status, 'order_id', v_order.id);
  end if;
  -- Same reasoning as above: the money is real whatever the sum says, so
  -- refusing it without a flag is the same as losing it.
  if round(p_amount, 2) <> round(v_order.subtotal_thb, 2) then
    update public.staff_orders
      set needs_refund = true,
          note = coalesce(note || ' · ', '')
                 || 'ยอดจ่ายไม่ตรง: จ่าย ' || p_amount || ' แต่ออเดอร์ ' || v_order.subtotal_thb
      where id = v_order.id;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch',
      'expected_thb', v_order.subtotal_thb, 'paid_thb', p_amount, 'order_id', v_order.id);
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
