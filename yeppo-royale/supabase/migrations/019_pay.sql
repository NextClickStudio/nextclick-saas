-- yeppo pricing: plans paid in SOL, straight to the owner's wallet. No account, no card.
-- An order has a unique amount (a few extra lamports) and a Solana Pay reference. yr-pay finds the payment
-- on-chain by the reference, or by the exact amount reaching the wallet, and issues a license key.
-- The receiving wallet lives in yr_config ('pay_wallet'): while it is empty, checkout stays closed. Additive.

create table if not exists yr_orders (
  id uuid primary key default gen_random_uuid(),
  plan text not null,
  lamports bigint not null,
  ref text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  sig text unique,
  payer text,
  license text
);
create index if not exists yr_orders_open on yr_orders (created_at) where paid_at is null;
create index if not exists yr_orders_lamports on yr_orders (lamports) where paid_at is null;

create table if not exists yr_licenses (
  key text primary key,
  plan text not null,
  until timestamptz not null,
  payer text,
  created_at timestamptz not null default now()
);
create index if not exists yr_licenses_payer on yr_licenses (payer);

alter table yr_orders enable row level security;
alter table yr_licenses enable row level security;

insert into yr_config (key, value) values
  ('pay_wallet', ''),
  ('pay_plans', '[{"id":"pro30","name":"Pro","days":30,"sol":0.5},{"id":"pro90","name":"Pro · 90 days","days":90,"sol":1.2}]')
on conflict (key) do nothing;

-- public: what a license key unlocks (the key itself is the secret)
create or replace function yr_license(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', l.until > now(), 'plan', l.plan, 'until', (extract(epoch from l.until) * 1000)::bigint)
       from yr_licenses l where l.key = upper(trim(p_key))),
    jsonb_build_object('ok', false));
$$;
grant execute on function yr_license(text) to anon, authenticated;
