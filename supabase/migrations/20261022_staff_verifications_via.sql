-- How this verification happened, so one kind of it cannot renew itself.
--
-- An employee who signed in with their company address is not asked for a
-- code again every round — but that shortcut has to expire, or somebody who
-- has left keeps shopping at cost on a password alone, which is exactly
-- what the once-a-round code was there to prevent.
--
-- So the shortcut is allowed only when the mailbox was proved by code within
-- the last 30 days, and a row written *by* the shortcut is marked
-- 'account_email' so it does not count as that proof. Only 'otp' rows reset
-- the clock. Without this column the shortcut would renew itself forever.
alter table public.staff_verifications
  add column if not exists via text not null default 'otp'
  check (via in ('otp', 'account_email'));
