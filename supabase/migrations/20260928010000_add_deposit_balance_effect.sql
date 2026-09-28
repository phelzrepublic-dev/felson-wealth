alter table public.deposits
add column affects_balance boolean not null default true;

comment on column public.deposits.affects_balance is
  'Whether this deposit and its match contribute to the calculated member balance.';

create or replace function public.calculate_member_balance(target_member_id uuid)
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
         and affects_balance = true
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
