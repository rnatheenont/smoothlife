-- A code sent to a company mailbox is not a login code.
--
-- The staff shop asks an employee to prove they still hold their
-- @smooth-e.com mailbox, every round, while already signed in as whoever
-- they are. That is a different claim from "let me into this account", and
-- it has to live in a different namespace: if both used provider 'email',
-- a code requested on /staff could be typed into the login form and would
-- sign the requester in as that employee instead.
--
-- Same table, because the expiry, the attempt counter and the single-use
-- rule are the same rules and were already written once.
alter table public.otp_challenges
  drop constraint if exists otp_challenges_provider_check;

alter table public.otp_challenges
  add constraint otp_challenges_provider_check
  check (provider = any (array[
    'phone_otp',
    'email',
    'password_reset',
    'register_reclaim',
    'admin_password_reset',
    'staff_email'
  ]));
