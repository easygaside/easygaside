-- Revenue ledger for the /admin finance page. Payment is manual (PromptPay slip), so the admin
-- records each received payment here. Service-role only (no client policy → RLS denies clients).
create table if not exists egs_payments (
  id         uuid primary key default gen_random_uuid(),
  amount_thb numeric(12, 2) not null check (amount_thb >= 0),
  note       text,
  paid_at    date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists egs_payments_paid_idx on egs_payments(paid_at desc);
alter table egs_payments enable row level security;
