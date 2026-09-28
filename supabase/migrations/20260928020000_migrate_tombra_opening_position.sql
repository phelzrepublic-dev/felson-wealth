do $$
declare
  tombra_id uuid;
  management_id uuid;
  tombra_balance bigint;
  tombra_matched bigint;
  tombra_deposit_count integer;
  history_only_count integer;
  balance_affecting_count integer;
begin
  select id
    into tombra_id
    from public.profiles
   where lower(email) = 'tombra@felsonwealth.com'
     and role = 'member';

  if tombra_id is null then
    raise exception 'Tombra member profile was not found';
  end if;

  select id
    into management_id
    from public.profiles
   where lower(email) = 'felsonprezi01@gmail.com'
     and role = 'admin';

  if management_id is null then
    raise exception 'Management admin profile was not found';
  end if;

  insert into public.balance_adjustments (
    id,
    member_id,
    amount,
    reason,
    adjustment_type,
    recorded_by
  )
  values (
    '78000000-0000-4000-8000-000000000001',
    tombra_id,
    78000,
    'Confirmed brought-forward balance before the latest deposit',
    'legacy_balance',
    management_id
  )
  on conflict (id) do update
  set member_id = excluded.member_id,
      amount = excluded.amount,
      reason = excluded.reason,
      adjustment_type = excluded.adjustment_type,
      recorded_by = excluded.recorded_by,
      updated_at = now();

  insert into public.deposits (
    id,
    member_id,
    amount,
    match_amount,
    deposit_date,
    recorded_by,
    affects_balance
  )
  values
    (
      '50000000-0701-4000-8000-000000000001',
      tombra_id,
      5000,
      0,
      date '2026-07-01',
      management_id,
      false
    ),
    (
      '50000000-0801-4000-8000-000000000002',
      tombra_id,
      5000,
      0,
      date '2026-08-01',
      management_id,
      false
    ),
    (
      '50000000-0901-4000-8000-000000000003',
      tombra_id,
      5000,
      0,
      date '2026-09-01',
      management_id,
      false
    ),
    (
      '50000000-0928-4000-8000-000000000004',
      tombra_id,
      5000,
      0,
      date '2026-09-28',
      management_id,
      true
    )
  on conflict (id) do update
  set member_id = excluded.member_id,
      amount = excluded.amount,
      deposit_date = excluded.deposit_date,
      recorded_by = excluded.recorded_by,
      affects_balance = excluded.affects_balance,
      updated_at = now();

  select public.calculate_member_balance(tombra_id)
    into tombra_balance;

  select count(*),
         coalesce(sum(match_amount), 0),
         count(*) filter (where affects_balance = false),
         count(*) filter (where affects_balance = true)
    into tombra_deposit_count,
         tombra_matched,
         history_only_count,
         balance_affecting_count
    from public.deposits
   where member_id = tombra_id;

  if tombra_balance <> 84500 then
    raise exception 'Unexpected Tombra balance: %', tombra_balance;
  end if;

  if tombra_deposit_count <> 4
     or tombra_matched <> 6000
     or history_only_count <> 3
     or balance_affecting_count <> 1 then
    raise exception
      'Unexpected Tombra deposit ledger: count %, matched %, history-only %, balance-affecting %',
      tombra_deposit_count,
      tombra_matched,
      history_only_count,
      balance_affecting_count;
  end if;

  if exists (
    select 1
      from public.deposits d
      join public.profiles p on p.id = d.member_id
     where p.role = 'member'
       and p.id <> tombra_id
  ) or exists (
    select 1
      from public.balance_adjustments a
      join public.profiles p on p.id = a.member_id
     where p.role = 'member'
       and p.id <> tombra_id
  ) or exists (
    select 1
      from public.loans l
      join public.profiles p on p.id = l.member_id
     where p.role = 'member'
  ) then
    raise exception 'Unexpected financial records exist outside the confirmed Tombra ledger';
  end if;
end
$$;
