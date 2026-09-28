-- Run manually in the Supabase SQL Editor only after all five Auth users exist.
-- This script links identities to profiles; it does not insert financial data.

do $$
declare
  member_record record;
  auth_user_id uuid;
  auth_user_email text;
  linked_count integer := 0;
begin
  for member_record in
    select *
    from (
      values
        ('Tombra Prezi', 'tombra@felsonwealth.com', date '2003-02-21', 2, null::text),
        ('Sona Prezi', 'sona@felsonwealth.com', date '2003-04-01', 2, null::text),
        ('Henry Prezi', 'henry@felsonwealth.com', date '1996-05-28', 3, null::text),
        ('Bovina Prezi', 'bovina@felsonwealth.com', date '2000-07-09', 3, 'FSS Field Technician'),
        ('Gift Prezi', 'gift@felsonwealth.com', date '1998-09-19', 3, null::text)
    ) as members(name, email, date_of_birth, tier, role_assigned)
  loop
    auth_user_id := null;
    auth_user_email := null;

    select id, email
      into auth_user_id, auth_user_email
      from auth.users
     where lower(email) = lower(member_record.email);

    if auth_user_id is null then
      raise exception 'Missing Supabase Auth user for %', member_record.email;
    end if;

    insert into public.profiles (
      id,
      name,
      email,
      date_of_birth,
      tier,
      role,
      role_assigned
    )
    values (
      auth_user_id,
      member_record.name,
      auth_user_email,
      member_record.date_of_birth,
      member_record.tier,
      'member',
      member_record.role_assigned
    )
    on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        date_of_birth = excluded.date_of_birth,
        tier = excluded.tier,
        role = 'member',
        role_assigned = excluded.role_assigned,
        updated_at = now();

    linked_count := linked_count + 1;
  end loop;

  if linked_count <> 5 then
    raise exception 'Expected to link 5 member profiles, linked %', linked_count;
  end if;
end
$$;
