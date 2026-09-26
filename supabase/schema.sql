-- Free GST Billing Software: Supabase schema for Vercel deployment
create table if not exists app_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

create table if not exists app_meta (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists app_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_date timestamptz not null default now(),
  data jsonb not null,
  primary key (user_id, backup_date)
);

create table if not exists app_trash (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  record_id text not null,
  data jsonb not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

alter table app_records enable row level security;
alter table app_meta enable row level security;
alter table app_backups enable row level security;
alter table app_trash enable row level security;

create policy "own records" on app_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meta" on app_meta for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own backups" on app_backups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own trash" on app_trash for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic invoice counters. This avoids duplicate sequential invoice numbers
-- when the same account is open in two browser tabs.
create or replace function increment_invoice_counter(counter_key text, start_number bigint default 1)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_value bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into app_meta(user_id, key, value)
  values (auth.uid(), counter_key, to_jsonb(start_number - 1))
  on conflict (user_id, key) do nothing;

  update app_meta
  set value = to_jsonb((value #>> '{}')::bigint + 1), updated_at = now()
  where user_id = auth.uid() and key = counter_key
  returning (value #>> '{}')::bigint into next_value;

  return next_value;
end;
$$;

grant execute on function increment_invoice_counter(text, bigint) to authenticated;
