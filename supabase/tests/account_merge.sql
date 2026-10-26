-- merge_user_accounts, checked against the ways it can quietly go wrong.
--
-- Self-cleaning: every row it makes is removed at the end, pass or fail, and
-- it only ever touches the two throwaway users it created. Run it against
-- the live database the same way the staff-sale tests are run.
--
-- What it is actually guarding:
--
--   1. Nothing is left behind. The merge is catalogue-driven, so the test
--      asserts on the catalogue too: after merging, no column that points at
--      a user may still hold the loser's id. That is the assertion that
--      survives a table being added next month.
--   2. A collision drops the loser's row and keeps the survivor's, rather
--      than failing the whole merge. One wishlist entry, one loyalty row.
--   3. Things that merely add up, add up: points, orders, addresses.
--   4. Exactly one default address comes out the other side.
--   5. The audit row says what moved.

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000aaaa';  -- survivor, older
  b uuid := '00000000-0000-4000-8000-00000000bbbb';  -- loser, newer
  v_result   jsonb;
  v_n        bigint;
  v_rel      record;
  v_left     text := '';
  v_defaults bigint;
begin
  -- ---------------------------------------------------------------- set up
  delete from public.users where id in (a, b);

  insert into public.users (id, display_name, created_at, phone, shopify_customer_id)
  values (a, 'เทสต์ A (เก่ากว่า)', now() - interval '60 days', null, 'gid://shopify/Customer/1'),
         (b, 'เทสต์ B (ใหม่กว่า)', now() - interval '1 day', '0800000000', null);

  insert into public.auth_identities (user_id, provider, provider_uid, verified_at)
  values (a, 'email', 'merge-test-a@example.invalid', now()),
         (b, 'phone_otp', '+66800000000', now());

  -- Points: 100 + 50 must come out as 150.
  -- 'manual_adjust' because points_ledger.reason is a closed list; the
  -- reason does not matter here, only that the two balances add up.
  insert into public.points_ledger (user_id, delta, reason)
  values (a, 100, 'manual_adjust'), (b, 50, 'manual_adjust');

  -- Orders: one each.
  insert into public.payment_transactions (user_id, amount, invoice_no, status, cart_token)
  values (a, 100, 'MERGETESTA', 'success', 'merge-test-a'),
         (b, 200, 'MERGETESTB', 'success', 'merge-test-b');

  -- Wishlist: both want the same thing, B also wants another. The shared one
  -- must not come through twice; the other must come through.
  insert into public.wishlist_items (user_id, product_slug)
  values (a, 'merge-test-shared'),
         (b, 'merge-test-shared'),
         (b, 'merge-test-only-b');

  -- One row per user, by primary key: the collision that would abort a naive
  -- update of the whole table.
  insert into public.user_loyalty (user_id, current_tier, last_reviewed_at)
  values (a, 'Bronze', now()), (b, 'Silver', now());

  -- Both accounts call their own address the default one.
  insert into public.addresses
    (user_id, recipient_name, phone, address_line, subdistrict, district, province, postal_code, is_default)
  values (a, 'A', '0800000000', '1', 'x', 'y', 'z', '10000', true),
         (b, 'B', '0800000000', '2', 'x', 'y', 'z', '10000', true);

  -- ----------------------------------------------------------------- merge
  v_result := public.merge_user_accounts(a, b, 'phone_otp', '+66800000000');

  if v_result->>'ok' <> 'true' then
    raise exception 'เทสต์ล้ม: merge ไม่สำเร็จ — %', v_result;
  end if;

  -- 1. the loser is gone, and nothing anywhere still points at it
  if exists (select 1 from public.users where id = b) then
    raise exception 'เทสต์ล้ม: บัญชีที่ถูกรวมยังอยู่';
  end if;

  for v_rel in select * from public.user_owned_columns()
  loop
    execute format('select count(*) from public.%I where %I = $1',
                   v_rel.table_name, v_rel.column_name)
      into v_n using b;
    if v_n > 0 then
      v_left := v_left || format(' %s.%s=%s', v_rel.table_name, v_rel.column_name, v_n);
    end if;
  end loop;
  if v_left <> '' then
    raise exception 'เทสต์ล้ม: ยังมีแถวค้างอยู่กับบัญชีเดิม —%', v_left;
  end if;

  -- 2. collisions: the survivor's copy stayed, the loser's was dropped
  select count(*) into v_n from public.wishlist_items
   where user_id = a and product_slug = 'merge-test-shared';
  if v_n <> 1 then
    raise exception 'เทสต์ล้ม: wishlist ที่ซ้ำกันควรเหลือ 1 แถว ได้ %', v_n;
  end if;
  select count(*) into v_n from public.wishlist_items
   where user_id = a and product_slug = 'merge-test-only-b';
  if v_n <> 1 then
    raise exception 'เทสต์ล้ม: wishlist ที่ไม่ซ้ำควรย้ายมาด้วย ได้ %', v_n;
  end if;

  select count(*) into v_n from public.user_loyalty where user_id = a;
  if v_n <> 1 then
    raise exception 'เทสต์ล้ม: user_loyalty ควรเหลือแถวเดียว ได้ %', v_n;
  end if;
  -- the survivor's tier is kept, not the loser's
  if (select current_tier from public.user_loyalty where user_id = a) <> 'Bronze' then
    raise exception 'เทสต์ล้ม: ระดับสมาชิกของบัญชีที่เก็บไว้ถูกทับ';
  end if;
  -- and it is queued for the cron to recompute
  if (select last_reviewed_at from public.user_loyalty where user_id = a) is not null then
    raise exception 'เทสต์ล้ม: ควรล้าง last_reviewed_at เพื่อให้ cron คิดระดับใหม่';
  end if;

  -- 3. things that add up
  if (select balance from public.points_balance where user_id = a) <> 150 then
    raise exception 'เทสต์ล้ม: แต้มควรรวมเป็น 150 ได้ %',
      (select balance from public.points_balance where user_id = a);
  end if;
  select count(*) into v_n from public.payment_transactions
   where user_id = a and status = 'success';
  if v_n <> 2 then
    raise exception 'เทสต์ล้ม: ออร์เดอร์ควรรวมเป็น 2 ได้ %', v_n;
  end if;
  select count(*) into v_n from public.auth_identities where user_id = a;
  if v_n <> 2 then
    raise exception 'เทสต์ล้ม: ช่องทางเข้าสู่ระบบควรรวมเป็น 2 ได้ %', v_n;
  end if;

  -- 4. one default address, both addresses kept
  select count(*) into v_n from public.addresses where user_id = a;
  if v_n <> 2 then
    raise exception 'เทสต์ล้ม: ที่อยู่ควรเก็บไว้ทั้ง 2 ได้ %', v_n;
  end if;
  select count(*) into v_defaults from public.addresses where user_id = a and is_default;
  if v_defaults <> 1 then
    raise exception 'เทสต์ล้ม: ที่อยู่ตั้งต้นต้องมีอันเดียว ได้ %', v_defaults;
  end if;

  -- 5. facts the survivor lacked are filled in, ones it had are not touched
  if (select phone from public.users where id = a) <> '0800000000' then
    raise exception 'เทสต์ล้ม: เบอร์โทรที่บัญชีเก่าไม่มี ควรรับมาจากบัญชีที่ถูกรวม';
  end if;
  if (select shopify_customer_id from public.users where id = a)
       <> 'gid://shopify/Customer/1' then
    raise exception 'เทสต์ล้ม: ลิงก์ Shopify ของบัญชีที่เก็บไว้ถูกทับ';
  end if;

  -- 6. the audit row
  select count(*) into v_n from public.account_merges
   where survivor_id = a and loser_id = b and proved_via = 'phone_otp';
  if v_n <> 1 then
    raise exception 'เทสต์ล้ม: ไม่ได้บันทึก account_merges';
  end if;
  if (select loser_snapshot->>'display_name' from public.account_merges
       where survivor_id = a and loser_id = b) <> 'เทสต์ B (ใหม่กว่า)' then
    raise exception 'เทสต์ล้ม: snapshot ของบัญชีที่ถูกรวมไม่ถูกต้อง';
  end if;

  -- 7. refusals
  begin
    perform public.merge_user_accounts(a, a);
    raise exception 'เทสต์ล้ม: รวมบัญชีเดียวกันกับตัวเองไม่ควรผ่าน';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'same_account' then raise; end if;
  end;
  begin
    perform public.merge_user_accounts(a, b);  -- b no longer exists
    raise exception 'เทสต์ล้ม: รวมกับบัญชีที่ไม่มีอยู่ไม่ควรผ่าน';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'loser_not_found' then raise; end if;
  end;

  raise notice 'ผ่านทั้งหมด — moved = %', v_result->'moved';

  -- --------------------------------------------------------------- cleanup
  delete from public.account_merges where survivor_id = a;
  delete from public.payment_transactions where invoice_no in ('MERGETESTA', 'MERGETESTB');
  delete from public.users where id in (a, b);

exception when others then
  delete from public.account_merges where survivor_id = a;
  delete from public.payment_transactions where invoice_no in ('MERGETESTA', 'MERGETESTB');
  delete from public.users where id in (a, b);
  raise;
end;
$$;
