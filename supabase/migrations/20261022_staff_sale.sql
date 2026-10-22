-- Staff Sale: the employee shop's own tables.
--
-- A separate shop beside the customer one, not a discount inside it. Staff
-- prices, a per-person spending cap and a purchase window are rules the
-- normal checkout has no concept of, and the lesson from the flash sale is
-- that a cap you check by reading and then writing is a cap two tabs walk
-- straight through. So the money is held in one row per person per round,
-- and every change to it happens inside an RPC that locks that row first.
--
-- RLS on, no policies, on every table here: the service role is the only way
-- in, which means the staff price list cannot be read by a logged-in
-- customer poking at PostgREST. The browser never sees these tables.
--
-- Reference: /Users/User/Documents/staff-purchase-plan.md §6.2 (approved
-- 22 October 2026).

-- ---------------------------------------------------------------------------
-- A round: one open window with one cap.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_rounds (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  -- The per-person spending cap, copied onto each entitlement when somebody
  -- verifies. Copied rather than read live so that an allowance already
  -- granted is a row somebody can see and reason about. Editing this number
  -- in the console does move the existing rows with it — floored at what
  -- each person has already committed — but that is the console's doing,
  -- deliberately, not a cascade the database performs behind it.
  cap_thb            numeric(10, 2) not null check (cap_thb > 0),
  status             text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- How long an unpaid order holds its reservation. 2C2P's payment page gets
  -- the same number, so the page and the hold expire together.
  payment_window_min integer not null default 30 check (payment_window_min between 5 and 180),
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.staff_rounds enable row level security;

-- ---------------------------------------------------------------------------
-- What is on sale, and for how much. The price here is the price charged —
-- a stored number, not a percentage applied at checkout, so a rounding rule
-- changed in the admin cannot move a price somebody has already been quoted.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_round_items (
  id                uuid primary key default gen_random_uuid(),
  round_id          uuid not null references public.staff_rounds(id) on delete cascade,
  -- Shopify's variant GID. The variant, not the product: sizes are priced
  -- separately and the order lines are built from variants.
  variant_id        text not null,
  product_slug      text not null,
  collection_handle text,
  regular_price     numeric(10, 2) not null check (regular_price >= 0),
  staff_price       numeric(10, 2) not null check (staff_price > 0),
  -- Null means no limit of that kind.
  per_person_limit  integer check (per_person_limit > 0),
  total_quota       integer check (total_quota > 0),
  sold_qty          integer not null default 0 check (sold_qty >= 0),
  reserved_qty      integer not null default 0 check (reserved_qty >= 0),
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (round_id, variant_id),
  -- The quota is enforced here as well as in the RPC. The RPC is what gives
  -- a customer a readable "this one is gone"; this is what makes overselling
  -- impossible even if a future caller forgets to ask.
  check (total_quota is null or reserved_qty + sold_qty <= total_quota)
);

alter table public.staff_round_items enable row level security;

create index if not exists staff_round_items_round_idx
  on public.staff_round_items (round_id) where enabled;

-- ---------------------------------------------------------------------------
-- Who may buy. Three kinds in one table so the admin reads as one list and
-- so a block can out-rank an allow without a join across two tables.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_eligibility (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('allow_domain', 'allow_email', 'block_email')),
  -- Already canonical when it lands: lower-cased, and for emails with any
  -- `+tag` stripped. The RPC canonicalises what it is given the same way,
  -- so one person cannot become ten by adding plus-addresses.
  value      text not null,
  reason     text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.staff_eligibility enable row level security;

-- One live row per rule. Revoked rows stay as history, which is why the
-- index is partial rather than a plain unique constraint.
create unique index if not exists staff_eligibility_live_idx
  on public.staff_eligibility (kind, value) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Proof that this account, this round, holds a company mailbox.
--
-- Two unique constraints, and they are the point: one account cannot collect
-- several staff emails to multiply its cap, and one staff email cannot be
-- spread across several accounts.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_verifications (
  round_id              uuid not null references public.staff_rounds(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  staff_email_canonical text not null,
  verified_at           timestamptz not null default now(),
  primary key (round_id, user_id),
  unique (round_id, staff_email_canonical)
);

alter table public.staff_verifications enable row level security;

-- ---------------------------------------------------------------------------
-- The cap, as money. One row per person per round, and the only row the
-- checkout RPC locks.
--
-- Three numbers instead of one balance because an unpaid order has to hold
-- its share: `reserved` is what is waiting on a payment page, `spent` is
-- what went through, and the check constraint is the cap itself. A bug that
-- forgets to subtract shows up here as a failed write rather than as an
-- employee who spent 4,000 baht of a 2,000 baht allowance.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_entitlements (
  round_id     uuid not null references public.staff_rounds(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  cap_thb      numeric(10, 2) not null check (cap_thb > 0),
  reserved_thb numeric(10, 2) not null default 0 check (reserved_thb >= 0),
  spent_thb    numeric(10, 2) not null default 0 check (spent_thb >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (round_id, user_id),
  check (reserved_thb + spent_thb <= cap_thb)
);

alter table public.staff_entitlements enable row level security;

-- ---------------------------------------------------------------------------
-- The staff order itself. It exists before the money does, because the hold
-- on the cap and on the quota has to be written down somewhere while the
-- person is still on the payment page.
--
-- `lines` is a snapshot, not a reference: the price charged is the price the
-- order was created at, and an admin editing the price list afterwards must
-- not change what an order says it cost.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_orders (
  id                  uuid primary key default gen_random_uuid(),
  round_id            uuid not null references public.staff_rounds(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  staff_email         text not null,
  status              text not null default 'pending'
                      check (status in ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  -- [{ variant_id, qty, staff_price, regular_price }]
  lines               jsonb not null,
  subtotal_thb        numeric(10, 2) not null check (subtotal_thb > 0),
  expires_at          timestamptz not null,
  payment_reference   text unique,
  shopify_order_id    text,
  shopify_sync_status text not null default 'pending'
                      check (shopify_sync_status in ('pending', 'synced', 'failed')),
  -- Set when a late payment arrived after the hold was swept and the cap or
  -- the quota no longer covers it. The flash sale taught us this case is
  -- real and that it must be a flag a human clears, not an automatic refund.
  needs_refund        boolean not null default false,
  note                text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

alter table public.staff_orders enable row level security;

-- One unpaid order at a time per person per round. Without this, an abandoned
-- payment page plus a new attempt holds the cap twice.
create unique index if not exists staff_orders_one_pending_idx
  on public.staff_orders (round_id, user_id) where status = 'pending';

create index if not exists staff_orders_sweep_idx
  on public.staff_orders (expires_at) where status = 'pending';

create index if not exists staff_orders_user_idx
  on public.staff_orders (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The link from the money to the staff order.
--
-- Nullable, and that is what makes it useful beyond the join: every report
-- that counts customer revenue — marketing attribution included — filters on
-- `staff_order_id is null`, so an employee buying at cost cannot land in a
-- channel's sales figures.
-- ---------------------------------------------------------------------------
alter table public.payment_transactions
  add column if not exists staff_order_id uuid references public.staff_orders(id);

create index if not exists payment_transactions_staff_order_idx
  on public.payment_transactions (staff_order_id) where staff_order_id is not null;

-- ---------------------------------------------------------------------------
-- A new table in `public` starts fully granted to anon and authenticated —
-- see 20261022_lock_down_rls_disabled_tables.sql. RLS with no policies
-- already means no rows come back, but the grant is what lets PostgREST
-- publish the table at all, and a staff price list should not be an endpoint
-- that exists and returns an empty array. Both layers, on purpose.
-- ---------------------------------------------------------------------------
revoke all on table
  public.staff_rounds,
  public.staff_round_items,
  public.staff_eligibility,
  public.staff_verifications,
  public.staff_entitlements,
  public.staff_orders
from anon, authenticated;
