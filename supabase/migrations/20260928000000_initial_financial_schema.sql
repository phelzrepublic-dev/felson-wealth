-- Initial persistent data model for Felson Wealth Management.
-- This migration intentionally contains no family, deposit, balance, or loan data.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  email text not null unique check (btrim(email) <> ''),
  date_of_birth date not null,
  tier smallint not null check (tier in (1, 2, 3)),
  role text not null default 'member' check (role in ('member', 'admin')),
  role_assigned text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null check (amount > 0),
  match_amount bigint not null check (match_amount >= 0),
  deposit_date date not null default current_date,
  recorded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null check (amount > 0),
  reason text not null check (btrim(reason) <> ''),
  adjustment_type text not null
    check (adjustment_type in ('credit', 'debit', 'legacy_balance')),
  recorded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null check (amount > 0),
  term_months smallint not null check (term_months in (6, 12)),
  interest_rate_percent smallint generated always as (
    case term_months when 6 then 0 when 12 then 2 end
  ) stored,
  monthly_payment bigint generated always as (
    round(amount::numeric / term_months)::bigint
  ) stored,
  total_interest bigint generated always as (
    round(
      amount::numeric
      * (case term_months when 6 then 0 when 12 then 2 end)
      / 100
    )::bigint
  ) stored,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  request_date date not null default current_date,
  approved_date date,
  disbursed_date date,
  paid_to_date bigint not null default 0 check (paid_to_date >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_status_dates_check check (
    (status = 'pending' and approved_date is null and disbursed_date is null)
    or
    (status = 'approved' and approved_date is not null and disbursed_date is not null)
  ),
  constraint loans_paid_to_date_not_overpaid_check check (
    paid_to_date <= amount + total_interest
  )
);

create index deposits_member_id_idx on public.deposits (member_id);
create index deposits_recorded_by_idx on public.deposits (recorded_by);
create index balance_adjustments_member_id_idx on public.balance_adjustments (member_id);
create index balance_adjustments_recorded_by_idx on public.balance_adjustments (recorded_by);
create index loans_member_id_idx on public.loans (member_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger deposits_set_updated_at
before update on public.deposits
for each row execute function public.set_updated_at();

create trigger balance_adjustments_set_updated_at
before update on public.balance_adjustments
for each row execute function public.set_updated_at();

create trigger loans_set_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

-- Deposit matches are derived in the database so clients cannot choose them.
create function public.set_deposit_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier smallint;
  minimum_amount bigint;
  match_percent smallint;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may record deposits'
      using errcode = '42501';
  end if;

  select tier
    into member_tier
    from public.profiles
   where id = new.member_id;

  if member_tier is null then
    raise exception 'A valid member profile is required for a deposit';
  end if;

  minimum_amount := case member_tier
    when 1 then 2500
    when 2 then 5000
    when 3 then 10000
  end;

  match_percent := case member_tier
    when 1 then 35
    when 2 then 30
    when 3 then 25
  end;

  if new.amount < minimum_amount then
    raise exception 'Deposit amount is below the minimum for tier %', member_tier;
  end if;

  new.match_amount := round(new.amount::numeric * match_percent / 100)::bigint;
  return new;
end;
$$;

create trigger deposits_set_match
before insert or update of member_id, amount, match_amount on public.deposits
for each row execute function public.set_deposit_match();

revoke all on function public.set_deposit_match() from public, anon, authenticated;

-- Authenticated writes record the actual caller and cannot be reassigned later.
create function public.protect_recorded_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.recorded_by := auth.uid();
    end if;
  else
    new.recorded_by := old.recorded_by;
  end if;

  return new;
end;
$$;

create trigger deposits_protect_recorded_by
before insert or update on public.deposits
for each row execute function public.protect_recorded_by();

create trigger balance_adjustments_protect_recorded_by
before insert or update on public.balance_adjustments
for each row execute function public.protect_recorded_by();

-- Balances are derived from deposits/matches and explicit adjustments; they are
-- never accepted as a client-supplied value.
create function public.calculate_member_balance(target_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(amount + match_amount)
        from public.deposits
       where member_id = target_member_id
    ), 0)
    +
    coalesce((
      select sum(
        case adjustment_type
          when 'debit' then -amount
          else amount
        end
      )
        from public.balance_adjustments
       where member_id = target_member_id
    ), 0)
  )::bigint;
$$;

revoke all on function public.calculate_member_balance(uuid)
from public, anon, authenticated;

create function public.enforce_loan_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.member_id is distinct from auth.uid()
     and not public.is_admin() then
    raise exception 'Members may request loans only for themselves'
      using errcode = '42501';
  end if;

  if public.calculate_member_balance(new.member_id) < 100000 then
    raise exception 'A minimum balance of 100000 Naira is required to request a loan';
  end if;

  return new;
end;
$$;

create trigger loans_enforce_eligibility
before insert on public.loans
for each row execute function public.enforce_loan_eligibility();

revoke all on function public.enforce_loan_eligibility()
from public, anon, authenticated;

-- Admin authority comes only from the authenticated user's profile row.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.deposits enable row level security;
alter table public.balance_adjustments enable row level security;
alter table public.loans enable row level security;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_admin_insert
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy profiles_admin_delete
on public.profiles
for delete
to authenticated
using (public.is_admin());

create policy deposits_select_own_or_admin
on public.deposits
for select
to authenticated
using (member_id = auth.uid() or public.is_admin());

create policy deposits_admin_manage
on public.deposits
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy balance_adjustments_select_own_or_admin
on public.balance_adjustments
for select
to authenticated
using (member_id = auth.uid() or public.is_admin());

create policy balance_adjustments_admin_manage
on public.balance_adjustments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy loans_select_own_or_admin
on public.loans
for select
to authenticated
using (member_id = auth.uid() or public.is_admin());

create policy loans_member_request
on public.loans
for insert
to authenticated
with check (
  member_id = auth.uid()
  and status = 'pending'
  and approved_date is null
  and disbursed_date is null
  and paid_to_date = 0
);

create policy loans_admin_manage
on public.loans
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.profiles from public, anon;
revoke all on table public.deposits from public, anon;
revoke all on table public.balance_adjustments from public, anon;
revoke all on table public.loans from public, anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.deposits to authenticated;
grant select, insert, update, delete on table public.balance_adjustments to authenticated;
grant select, insert, update, delete on table public.loans to authenticated;
