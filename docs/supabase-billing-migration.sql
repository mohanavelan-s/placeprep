-- PlacePrep Razorpay billing tables + RLS policies.
-- Run in Supabase SQL editor with the service role / project owner context.
-- Some column names retain the original stripe_* names for compatibility with
-- the first billing migration; Razorpay customer/order/event ids are stored in
-- those provider id fields.

create table if not exists public.billing_customers (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  checkout_session_id text,
  tier text not null check (tier in ('pro', 'college')),
  status text not null,
  price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key,
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_customers_user_id on public.billing_customers(user_id);
create index if not exists idx_billing_subscriptions_user_status on public.billing_subscriptions(user_id, status);
create index if not exists idx_billing_subscriptions_customer on public.billing_subscriptions(stripe_customer_id);
create index if not exists idx_billing_events_type_created_at on public.billing_events(event_type, created_at desc);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own
on public.billing_customers
for select
using (auth.uid() = user_id);

drop policy if exists billing_customers_service_manage on public.billing_customers;
create policy billing_customers_service_manage
on public.billing_customers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists billing_subscriptions_select_own on public.billing_subscriptions;
create policy billing_subscriptions_select_own
on public.billing_subscriptions
for select
using (auth.uid() = user_id);

drop policy if exists billing_subscriptions_service_manage on public.billing_subscriptions;
create policy billing_subscriptions_service_manage
on public.billing_subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists billing_events_service_manage on public.billing_events;
create policy billing_events_service_manage
on public.billing_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
