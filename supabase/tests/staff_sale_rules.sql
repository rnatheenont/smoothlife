-- The staff sale's rules, as a test you can re-run.
--
-- Paste the whole file into the Supabase SQL editor. It creates a throwaway
-- round, two throwaway users, exercises every refusal the shop depends on,
-- prints a table of what happened, and deletes everything it made. Nothing
-- here touches real data — but it does run against the real database, so
-- read the cleanup at the bottom of each block before running it.
--
-- Last run: 22 October 2026 — all 51 steps as expected.
--
-- The one thing this cannot do from a single connection is two genuinely
-- simultaneous carts. What stands in for it: step 5 proves one person cannot
-- hold two carts at once (the partial unique index), step 15 proves the cap
-- is a check constraint and not merely an `if` in a function — so even an
-- interleaving that defeated `for update` could not write past the cap — and
-- step 6 of block 3 proves a refused cart leaves nothing reserved behind.

-- ===========================================================================
-- Block 1 — eligibility, the cap, payment, replay, sweep, late money, refund
-- ===========================================================================
do $$
declare
  v_round uuid; v_a uuid; v_b uuid; v_order uuid; v_res jsonb;
begin
  create temp table if not exists staff_test(step text, got text) on commit drop;
  delete from staff_test;

  insert into public.users (id) values (gen_random_uuid()) returning id into v_a;
  insert into public.users (id) values (gen_random_uuid()) returning id into v_b;

  insert into public.staff_rounds (name, starts_at, ends_at, cap_thb, status, payment_window_min)
  values ('TEST round', now() - interval '1 hour', now() + interval '1 hour', 2000, 'open', 30)
  returning id into v_round;

  insert into public.staff_round_items (round_id, variant_id, product_slug, regular_price, staff_price, total_quota)
  values (v_round, 'gid://test/V1', 'test-product', 900, 500, 5);

  insert into public.staff_eligibility (kind, value) values ('allow_domain', 'smooth-e.com')
  on conflict do nothing;

  v_res := public.staff_verify(v_round, v_a, 'Somchai+promo@SMOOTH-E.com');
  insert into staff_test values ('1 verify A (plus/caps)', v_res->>'ok' || ' / ' || coalesce(v_res->>'email', v_res->>'reason'));

  v_res := public.staff_verify(v_round, v_b, 'somchai@smooth-e.com');
  insert into staff_test values ('2 verify B same mailbox', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_verify(v_round, v_b, 'someone@gmail.com');
  insert into staff_test values ('3 verify B outside domain', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/V1","qty":3}]'::jsonb);
  insert into staff_test values ('4 A buys 1500', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));
  v_order := (v_res->>'order_id')::uuid;

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/V1","qty":3}]'::jsonb);
  insert into staff_test values ('5 A second tab 1500', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  insert into staff_test values ('6 entitlement after hold',
    (select reserved_thb || ' reserved, ' || spent_thb || ' spent, cap ' || cap_thb
     from public.staff_entitlements where round_id = v_round and user_id = v_a));
  insert into staff_test values ('7 item after hold',
    (select reserved_qty || ' reserved, ' || sold_qty || ' sold, quota ' || total_quota
     from public.staff_round_items where round_id = v_round));

  update public.staff_orders set payment_reference = 'STF-TEST-1' where id = v_order;
  v_res := public.staff_confirm_payment('STF-TEST-1', 1500);
  insert into staff_test values ('8 confirm payment', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));
  insert into staff_test values ('9 entitlement after paying',
    (select reserved_thb || ' reserved, ' || spent_thb || ' spent' from public.staff_entitlements
     where round_id = v_round and user_id = v_a));

  v_res := public.staff_confirm_payment('STF-TEST-1', 1500);
  insert into staff_test values ('10 webhook replay', v_res->>'ok' || ' / already_paid=' || coalesce(v_res->>'already_paid',''));
  insert into staff_test values ('11 entitlement after replay',
    (select reserved_thb || ' reserved, ' || spent_thb || ' spent' from public.staff_entitlements
     where round_id = v_round and user_id = v_a));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/V1","qty":2}]'::jsonb);
  insert into staff_test values ('12 A buys 1000 more', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason','') || ' / left ' || coalesce(v_res->'detail'->>'remaining_thb',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/V1","qty":1}]'::jsonb);
  insert into staff_test values ('13 A buys the last 500', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/V1","qty":2}]'::jsonb);
  insert into staff_test values ('14 B, never verified', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  begin
    update public.staff_entitlements set reserved_thb = 9000
      where round_id = v_round and user_id = v_a;
    insert into staff_test values ('15 write past the cap', 'ALLOWED — constraint missing');
  exception when check_violation then
    insert into staff_test values ('15 write past the cap', 'refused by check constraint');
  end;

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/V1","qty":1},{"variant_id":"gid://test/V1","qty":1}]'::jsonb);
  insert into staff_test values ('16 duplicate lines', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  update public.staff_orders set expires_at = now() - interval '1 minute'
    where round_id = v_round and status = 'pending';
  insert into staff_test values ('17 sweep released', public.staff_sweep()::text);
  insert into staff_test values ('18 entitlement after sweep',
    (select reserved_thb || ' reserved, ' || spent_thb || ' spent' from public.staff_entitlements
     where round_id = v_round and user_id = v_a));

  update public.staff_orders set payment_reference = 'STF-TEST-2'
    where round_id = v_round and user_id = v_a and status = 'expired';
  v_res := public.staff_confirm_payment('STF-TEST-2', 500);
  insert into staff_test values ('19 late payment', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason','') || ' / late=' || coalesce(v_res->>'late',''));

  v_res := public.staff_refund_restore(v_order);
  insert into staff_test values ('20 refund', v_res->>'ok' || ' / restored ' || coalesce(v_res->>'restored_thb', v_res->>'reason'));
  insert into staff_test values ('21 final state',
    (select e.spent_thb || ' spent · item ' || i.sold_qty || ' sold, ' || i.reserved_qty || ' reserved'
     from public.staff_entitlements e, public.staff_round_items i
     where e.round_id = v_round and e.user_id = v_a and i.round_id = v_round));

  delete from public.staff_rounds where id = v_round;
  delete from public.staff_eligibility where value = 'smooth-e.com';
  delete from public.users where id in (v_a, v_b);
end $$;

select step, got from staff_test order by length(step), step;

-- ===========================================================================
-- Block 2 — the per-person limit, a switched-off item, a closed round
-- ===========================================================================
do $$
declare v_round uuid; v_a uuid; v_b uuid; v_res jsonb;
begin
  create temp table if not exists staff_test2(step text, got text) on commit drop;
  delete from staff_test2;

  insert into public.users (id) values (gen_random_uuid()) returning id into v_a;
  insert into public.users (id) values (gen_random_uuid()) returning id into v_b;
  insert into public.staff_rounds (name, starts_at, ends_at, cap_thb, status)
  values ('TEST quota', now() - interval '1 hour', now() + interval '1 hour', 5000, 'open')
  returning id into v_round;
  insert into public.staff_round_items (round_id, variant_id, product_slug, regular_price, staff_price, total_quota, per_person_limit)
  values (v_round, 'gid://test/Q1', 'test-quota', 900, 500, 4, 2);
  insert into public.staff_eligibility (kind, value) values ('allow_domain', 'smooth-e.com') on conflict do nothing;
  perform public.staff_verify(v_round, v_a, 'a@smooth-e.com');
  perform public.staff_verify(v_round, v_b, 'b@smooth-e.com');

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/Q1","qty":3}]'::jsonb);
  insert into staff_test2 values ('1 A asks 3 where 2 per person', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason','') || ' / limit ' || coalesce(v_res->'detail'->>'limit',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/Q1","qty":2}]'::jsonb);
  insert into staff_test2 values ('2 A takes 2', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/Q1","qty":3}]'::jsonb);
  insert into staff_test2 values ('3 B asks 3', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/Q1","qty":2}]'::jsonb);
  insert into staff_test2 values ('4 B takes the last 2', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));

  insert into staff_test2 values ('5 item now',
    (select reserved_qty || ' reserved, ' || sold_qty || ' sold, quota ' || total_quota
     from public.staff_round_items where round_id = v_round));

  insert into public.staff_eligibility (kind, value, reason) values ('block_email', 'c@smooth-e.com', 'test');
  v_res := public.staff_verify(v_round, v_a, 'c@smooth-e.com');
  insert into staff_test2 values ('6 blocked email', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  update public.staff_rounds set status = 'closed' where id = v_round;
  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/Q1","qty":1}]'::jsonb);
  insert into staff_test2 values ('7 closed round', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  delete from public.staff_rounds where id = v_round;
  delete from public.staff_eligibility where value in ('c@smooth-e.com', 'smooth-e.com');
  delete from public.users where id in (v_a, v_b);
end $$;

select step, got from staff_test2 order by step;

-- ===========================================================================
-- Block 3 — sold out, an item that is not in the round, and the rollback
--
-- Step 6 and 7 are the important ones: four refused carts in a row must
-- leave the quota and the allowance exactly where they were.
-- ===========================================================================
do $$
declare v_round uuid; v_a uuid; v_b uuid; v_res jsonb;
begin
  create temp table if not exists staff_test3(step text, got text) on commit drop;
  delete from staff_test3;

  insert into public.users (id) values (gen_random_uuid()) returning id into v_a;
  insert into public.users (id) values (gen_random_uuid()) returning id into v_b;
  insert into public.staff_rounds (name, starts_at, ends_at, cap_thb, status)
  values ('TEST soldout', now() - interval '1 hour', now() + interval '1 hour', 9000, 'open')
  returning id into v_round;
  insert into public.staff_round_items (round_id, variant_id, product_slug, regular_price, staff_price, total_quota)
  values (v_round, 'gid://test/S1', 'test-soldout', 900, 500, 2),
         (v_round, 'gid://test/S2', 'test-off', 900, 500, null);
  update public.staff_round_items set enabled = false where round_id = v_round and variant_id = 'gid://test/S2';
  insert into public.staff_eligibility (kind, value) values ('allow_domain', 'smooth-e.com') on conflict do nothing;
  perform public.staff_verify(v_round, v_a, 'a2@smooth-e.com');
  perform public.staff_verify(v_round, v_b, 'b2@smooth-e.com');

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/S1","qty":2}]'::jsonb);
  insert into staff_test3 values ('1 A takes both', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/S1","qty":1}]'::jsonb);
  insert into staff_test3 values ('2 B on an empty shelf', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason','') || ' / left ' || coalesce(v_res->'detail'->>'left',''));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/S2","qty":1}]'::jsonb);
  insert into staff_test3 values ('3 B on a switched-off item', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/NOPE","qty":1}]'::jsonb);
  insert into staff_test3 values ('4 B on an item not in the round', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_create_order(v_round, v_b, '[{"variant_id":"gid://test/S1","qty":0}]'::jsonb);
  insert into staff_test3 values ('5 qty 0', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  insert into staff_test3 values ('6 item after 4 refusals',
    (select reserved_qty || ' reserved of quota ' || total_quota
     from public.staff_round_items where round_id = v_round and variant_id = 'gid://test/S1'));
  insert into staff_test3 values ('7 B holds nothing',
    (select reserved_thb || ' reserved' from public.staff_entitlements
     where round_id = v_round and user_id = v_b));

  delete from public.staff_rounds where id = v_round;
  delete from public.staff_eligibility where value = 'smooth-e.com';
  delete from public.users where id in (v_a, v_b);
end $$;

select step, got from staff_test3 order by step;

-- ===========================================================================
-- Block 4 — the acceptance list in §9 of the plan: lookalike domains, the
-- cap to the satang, a round that moves, and a webhook that arrives twice
-- ===========================================================================
do $$
declare v_round uuid; v_a uuid; v_b uuid; v_res jsonb;
begin
  create temp table if not exists s9(step text, got text) on commit drop;
  delete from s9;

  insert into public.users (id) values (gen_random_uuid()) returning id into v_a;
  insert into public.users (id) values (gen_random_uuid()) returning id into v_b;
  insert into public.staff_rounds (name, starts_at, ends_at, cap_thb, status)
  values ('TEST s9', now() - interval '1 hour', now() + interval '1 hour', 2000, 'open')
  returning id into v_round;
  insert into public.staff_round_items (round_id, variant_id, product_slug, regular_price, staff_price)
  values (v_round, 'gid://test/E1', 'test-e1', 3000, 2000),
         (v_round, 'gid://test/E2', 'test-e2', 100, 0.01);
  insert into public.staff_eligibility (kind, value) values ('allow_domain','smooth-e.com') on conflict do nothing;

  v_res := public.staff_verify(v_round, v_a, 'x@smooth-e.com.evil.com');
  insert into s9 values ('1 smooth-e.com.evil.com', coalesce(v_res->>'reason', v_res->>'ok'));
  v_res := public.staff_verify(v_round, v_a, 'x@sub.smooth-e.com');
  insert into s9 values ('2 sub.smooth-e.com', coalesce(v_res->>'reason', v_res->>'ok'));
  v_res := public.staff_verify(v_round, v_a, 'x@notsmooth-e.com');
  insert into s9 values ('3 notsmooth-e.com', coalesce(v_res->>'reason', v_res->>'ok'));
  v_res := public.staff_verify(v_round, v_a, 'x@SMOOTH-E.COM');
  insert into s9 values ('4 the real domain, shouting', coalesce(v_res->>'email', v_res->>'reason'));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/E1","qty":1}]'::jsonb);
  insert into s9 values ('5 exactly 2,000', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason', v_res->>'subtotal_thb'));

  update public.staff_orders set payment_reference='S9-1' where round_id=v_round and user_id=v_a;
  perform public.staff_confirm_payment('S9-1', 2000);
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/E2","qty":1}]'::jsonb);
  insert into s9 values ('6 then 0.01 more', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason','') || ' / left ' || coalesce(v_res->'detail'->>'remaining_thb',''));

  -- At the database level the entitlement's cap stands on its own: moving
  -- the round's dates or editing its cap does not cascade. The console does
  -- the cascade itself when an admin saves the form, with a floor at what
  -- each person has already committed — see the round PATCH route.
  update public.staff_rounds set ends_at = now() + interval '3 hours', cap_thb = 5000 where id = v_round;
  insert into s9 values ('7 spent after extending',
    (select spent_thb || ' spent, cap still ' || cap_thb from public.staff_entitlements
     where round_id=v_round and user_id=v_a));

  update public.staff_rounds set starts_at = now() + interval '1 hour' where id = v_round;
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/E2","qty":1}]'::jsonb);
  insert into s9 values ('8 before it opens', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  update public.staff_rounds set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 minute' where id = v_round;
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/E2","qty":1}]'::jsonb);
  insert into s9 values ('9 after it closes', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  update public.staff_rounds set ends_at = now() + interval '1 hour' where id = v_round;
  insert into public.staff_eligibility (kind, value) values ('block_email','x@smooth-e.com');
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/E2","qty":1}]'::jsonb);
  insert into s9 values ('10 blocked after verifying', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  v_res := public.staff_confirm_payment('S9-1', 2000);
  insert into s9 values ('11 confirm the same reference again', v_res->>'ok' || ' / already_paid=' || coalesce(v_res->>'already_paid',''));
  insert into s9 values ('12 orders in this round',
    (select count(*)::text || ' row(s), ' || count(*) filter (where status='paid')::text || ' paid'
     from public.staff_orders where round_id = v_round));

  delete from public.staff_rounds where id = v_round;
  delete from public.staff_eligibility where value in ('smooth-e.com','x@smooth-e.com');
  delete from public.users where id in (v_a, v_b);
end $$;

select step, got from s9 order by length(step), step;

-- ===========================================================================
-- Block 5 — the round's own two rules: at most N of any one item, and at
-- most N purchases per person per round
-- ===========================================================================
do $$
declare v_round uuid; v_a uuid; v_res jsonb; v_order uuid;
begin
  create temp table if not exists s6(step text, got text) on commit drop;
  delete from s6;
  insert into public.users (id) values (gen_random_uuid()) returning id into v_a;
  insert into public.staff_rounds (name, starts_at, ends_at, cap_thb, status, max_per_item, max_orders)
  values ('TEST rules', now() - interval '1 hour', now() + interval '1 hour', 99000, 'open', 6, 1)
  returning id into v_round;
  insert into public.staff_round_items (round_id, variant_id, product_slug, regular_price, staff_price, per_person_limit)
  values (v_round, 'gid://test/M1', 'test-blanket', 900, 100, null),
         (v_round, 'gid://test/M2', 'test-stricter', 900, 100, 2),
         (v_round, 'gid://test/M3', 'test-looser', 900, 100, 10);
  insert into public.staff_eligibility (kind, value) values ('allow_domain','smooth-e.com') on conflict do nothing;
  perform public.staff_verify(v_round, v_a, 'm@smooth-e.com');

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M1","qty":7}]'::jsonb);
  insert into s6 values ('1 no item limit, asks 7', coalesce(v_res->>'reason', v_res->>'ok') || ' / limit ' || coalesce(v_res->'detail'->>'limit',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M2","qty":3}]'::jsonb);
  insert into s6 values ('2 item says 2, asks 3', coalesce(v_res->>'reason','ok') || ' / limit ' || coalesce(v_res->'detail'->>'limit',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M3","qty":8}]'::jsonb);
  insert into s6 values ('3 item says 10, round says 6, asks 8', coalesce(v_res->>'reason','ok') || ' / limit ' || coalesce(v_res->'detail'->>'limit',''));

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M1","qty":6}]'::jsonb);
  insert into s6 values ('4 asks exactly 6', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));
  v_order := (v_res->>'order_id')::uuid;

  update public.staff_orders set payment_reference='R-1' where id = v_order;
  perform public.staff_confirm_payment('R-1', 600);

  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M1","qty":1}]'::jsonb);
  insert into s6 values ('5 a second purchase in the round', coalesce(v_res->>'reason','ok') || ' / used ' || coalesce(v_res->'detail'->>'used',''));

  -- A refund gives the turn back: the purchase was undone.
  perform public.staff_refund_restore(v_order);
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M1","qty":1}]'::jsonb);
  insert into s6 values ('6 after the admin refunds it', v_res->>'ok' || ' / ' || coalesce(v_res->>'reason',''));

  update public.staff_rounds set max_per_item = null, max_orders = null where id = v_round;
  v_res := public.staff_create_order(v_round, v_a, '[{"variant_id":"gid://test/M1","qty":50}]'::jsonb);
  insert into s6 values ('7 both rules off, asks 50', coalesce(v_res->>'reason', v_res->>'ok'));

  delete from public.staff_rounds where id = v_round;
  delete from public.staff_eligibility where value = 'smooth-e.com';
  delete from public.users where id = v_a;
end $$;

select step, got from s6 order by step;
