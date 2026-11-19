-- ============================================================
-- schemas-01-base.sql  —  Bloco 1: tabelas base + RLS helpers
-- Versão idempotente (pode rodar várias vezes)
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  city text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_franchises_state on franchises (state);
drop trigger if exists trg_franchises_updated_at on franchises;
create trigger trg_franchises_updated_at before update on franchises for each row execute function set_updated_at();
alter table franchises enable row level security;

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  franchise_id uuid references franchises (id) on delete restrict,
  full_name text not null,
  role text not null default 'agent',
  phone_e164 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_franchise_id on profiles (franchise_id);
create index if not exists idx_profiles_role on profiles (role);
create index if not exists idx_profiles_phone_e164 on profiles (phone_e164);
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
alter table profiles enable row level security;

-- Helpers de RLS
create or replace function current_franchise_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select franchise_id from profiles where id = auth.uid() and is_active;
$$;

create or replace function "current_role"()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

-- Policies de franchises (drop + recreate para idempotência)
drop policy if exists franchises_select on franchises;
drop policy if exists franchises_insert on franchises;
drop policy if exists franchises_update on franchises;
drop policy if exists franchises_delete on franchises;
create policy franchises_select on franchises for select to authenticated
  using ("current_role"() = 'central_admin' or id = current_franchise_id());
create policy franchises_insert on franchises for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy franchises_update on franchises for update to authenticated
  using ("current_role"() = 'central_admin') with check ("current_role"() = 'central_admin');
create policy franchises_delete on franchises for delete to authenticated
  using ("current_role"() = 'central_admin');

-- Policies de profiles
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_delete on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or "current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy profiles_insert on profiles for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or "current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check (id = auth.uid() or "current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy profiles_delete on profiles for delete to authenticated
  using ("current_role"() = 'central_admin');

-- [EXTENSÃO] provisiona o profile de todo usuário criado no Supabase Auth.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_franchise_id uuid;
  v_full_name text;
begin
  begin
    v_franchise_id := nullif(new.raw_user_meta_data ->> 'franchise_id', '')::uuid;
  exception when others then
    v_franchise_id := null;
  end;

  if v_franchise_id is not null
     and not exists (select 1 from franchises where id = v_franchise_id) then
    v_franchise_id := null;
  end if;

  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Novo usuário'
  );

  insert into profiles (id, franchise_id, full_name, role)
  values (new.id, v_franchise_id, v_full_name, 'agent')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();