-- The staff sale's sweep, every thirty seconds.
--
-- An unpaid staff order holds two things that belong to other people: a
-- share of that employee's own allowance, and a share of the round's quota.
-- Nothing gives those back on its own — staff_confirm_payment only runs when
-- money arrives, and money that never arrives never calls anything. So the
-- clock has to.
--
-- pg_cron rather than a Vercel cron: Vercel's cheapest schedule is daily on
-- this project, and a thirty-minute hold released once a day is a hold.
-- Same pattern and the same interval as flash-sale-sweep, which is next to
-- this one in cron.job.
--
-- Cheap when idle: staff_orders_sweep_idx is a partial index on the pending
-- rows alone, so a round that is not running costs an empty index scan.
select cron.unschedule('staff-sale-sweep')
where exists (select 1 from cron.job where jobname = 'staff-sale-sweep');

select cron.schedule('staff-sale-sweep', '30 seconds', $$select public.staff_sweep()$$);
