-- Admin sessions are stateless — a signed cookie with a 12-hour life and no
-- server-side record of it. Until now that meant suspending an account only
-- stopped the next sign-in: whoever was already holding a cookie kept full
-- access until it aged out on its own. Taking someone's access away was a
-- thing you asked for and got up to half a day later.
--
-- This column is the revocation point. Every admin request compares its
-- token's issued-at against it, so moving it to now() invalidates every
-- cookie that account is holding, on every device, in a single write — and
-- costs one indexed lookup, not a session table.

alter table public.admin_users
  add column if not exists sessions_valid_from timestamptz;

comment on column public.admin_users.sessions_valid_from is
  'Admin cookies issued before this moment are refused. Set to now() to sign the account out everywhere — done automatically on suspend, role change, email change and password reset. Null means nothing has been revoked for this account.';
