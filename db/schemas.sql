create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- As tabelas precisam existir antes dos helpers: funções "language sql" têm o
-- corpo validado na criação (check_function_bodies), e as policies abaixo
-- resolvem os helpers na criação. Por isso a ordem é: tabelas -> helpers -> policies.

create table franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  city text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_franchises_state on franchises (state);
create trigger trg_franchises_updated_at before update on franchises for each row execute function set_updated_at();
alter table franchises enable row level security;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  franchise_id uuid references franchises (id) on delete restrict,
  full_name text not null,
  role text not null default 'agent',
  phone_e164 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_franchise_id on profiles (franchise_id);
create index idx_profiles_role on profiles (role);
create index idx_profiles_phone_e164 on profiles (phone_e164);
create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
alter table profiles enable row level security;

-- Helpers de RLS. Usuário sem profile (ou com is_active = false) resolve para null
-- e, portanto, não passa em nenhuma policy por franquia/papel (RS-01).
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

create policy franchises_select on franchises for select to authenticated
  using ("current_role"() = 'central_admin' or id = current_franchise_id());
create policy franchises_insert on franchises for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy franchises_update on franchises for update to authenticated
  using ("current_role"() = 'central_admin') with check ("current_role"() = 'central_admin');
create policy franchises_delete on franchises for delete to authenticated
  using ("current_role"() = 'central_admin');

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
-- role sempre 'agent' (nunca confiar em metadata para papel); franchise_id vem do
-- metadata do convite e é ignorado se não apontar para uma franquia existente.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  plate text not null,
  vehicle_type text not null,
  model text,
  year int,
  current_odometer_km numeric not null default 0,
  current_assignee_id uuid references profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vehicles_plate unique (plate)
);
create index idx_vehicles_franchise_id on vehicles (franchise_id);
create index idx_vehicles_current_assignee_id on vehicles (current_assignee_id);
create trigger trg_vehicles_updated_at before update on vehicles for each row execute function set_updated_at();
alter table vehicles enable row level security;
create policy vehicles_select on vehicles for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy vehicles_insert on vehicles for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy vehicles_update on vehicles for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy vehicles_delete on vehicles for delete to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));

create table vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  agent_id uuid not null references profiles (id) on delete restrict,
  assigned_by uuid not null references profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assignments_vehicle_id on vehicle_assignments (vehicle_id);
create index idx_assignments_agent_id on vehicle_assignments (agent_id);
create unique index idx_assignments_open on vehicle_assignments (vehicle_id) where ended_at is null;
create trigger trg_vehicle_assignments_updated_at before update on vehicle_assignments for each row execute function set_updated_at();
alter table vehicle_assignments enable row level security;
create policy vehicle_assignments_select on vehicle_assignments for select to authenticated
  using ("current_role"() = 'central_admin' or vehicle_id in (select id from vehicles where franchise_id = current_franchise_id()));
create policy vehicle_assignments_insert on vehicle_assignments for insert to authenticated
  with check ("current_role"() in ('central_admin','franchise_manager') and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id() or "current_role"() = 'central_admin'));
create policy vehicle_assignments_update on vehicle_assignments for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));
create policy vehicle_assignments_delete on vehicle_assignments for delete to authenticated
  using ("current_role"() = 'central_admin');

create table maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  rule_label text not null,
  interval_km numeric,
  interval_months int,
  last_done_at timestamptz,
  last_done_odometer_km numeric,
  next_due_at timestamptz,
  next_due_odometer_km numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rules_vehicle_id on maintenance_rules (vehicle_id);
create index idx_rules_next_due_at on maintenance_rules (next_due_at);
create index idx_rules_next_due_km on maintenance_rules (next_due_odometer_km);
create trigger trg_maintenance_rules_updated_at before update on maintenance_rules for each row execute function set_updated_at();
alter table maintenance_rules enable row level security;
create policy maintenance_rules_select on maintenance_rules for select to authenticated
  using ("current_role"() = 'central_admin' or vehicle_id in (select id from vehicles where franchise_id = current_franchise_id()));
create policy maintenance_rules_insert on maintenance_rules for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));
create policy maintenance_rules_update on maintenance_rules for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));
create policy maintenance_rules_delete on maintenance_rules for delete to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  franchise_id uuid not null references franchises (id) on delete restrict,
  rule_id uuid references maintenance_rules (id) on delete set null,
  service_description text not null,
  cost numeric not null,
  supplier_name text,
  odometer_km numeric,
  performed_at timestamptz not null default now(),
  invoice_storage_path text,
  ocr_status text not null default 'none',
  source text not null default 'app',
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maint_vehicle_id on maintenance_records (vehicle_id);
create index idx_maint_franchise_id on maintenance_records (franchise_id);
create index idx_maint_performed_at on maintenance_records (performed_at);
create trigger trg_maintenance_records_updated_at before update on maintenance_records for each row execute function set_updated_at();
alter table maintenance_records enable row level security;
create policy maintenance_records_select on maintenance_records for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy maintenance_records_insert on maintenance_records for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy maintenance_records_update on maintenance_records for update to authenticated
  using ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy maintenance_records_delete on maintenance_records for delete to authenticated
  using ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));

create table fuel_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  franchise_id uuid not null references franchises (id) on delete restrict,
  cost numeric not null,
  liters numeric,
  odometer_km numeric not null,
  fueled_at timestamptz not null default now(),
  receipt_storage_path text,
  ocr_status text not null default 'none',
  source text not null default 'app',
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fuel_vehicle_id on fuel_records (vehicle_id);
create index idx_fuel_franchise_id on fuel_records (franchise_id);
create index idx_fuel_fueled_at on fuel_records (fueled_at);
create trigger trg_fuel_records_updated_at before update on fuel_records for each row execute function set_updated_at();
alter table fuel_records enable row level security;
create policy fuel_records_select on fuel_records for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy fuel_records_insert on fuel_records for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy fuel_records_update on fuel_records for update to authenticated
  using ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy fuel_records_delete on fuel_records for delete to authenticated
  using ("current_role"() = 'central_admin' or created_by = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));

create table inventory_item_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  durability_months int,
  durability_km numeric,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_item_types_category on inventory_item_types (category);
create trigger trg_inventory_item_types_updated_at before update on inventory_item_types for each row execute function set_updated_at();
alter table inventory_item_types enable row level security;
create policy inventory_item_types_select on inventory_item_types for select to authenticated
  using (true);
create policy inventory_item_types_insert on inventory_item_types for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy inventory_item_types_update on inventory_item_types for update to authenticated
  using ("current_role"() = 'central_admin') with check ("current_role"() = 'central_admin');
create policy inventory_item_types_delete on inventory_item_types for delete to authenticated
  using ("current_role"() = 'central_admin');

create table inventory_stock (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid not null references inventory_item_types (id) on delete restrict,
  quantity_on_hand numeric not null default 0,
  min_quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_stock_franchise_item unique (franchise_id, item_type_id)
);
create index idx_stock_franchise_id on inventory_stock (franchise_id);
create trigger trg_inventory_stock_updated_at before update on inventory_stock for each row execute function set_updated_at();
alter table inventory_stock enable row level security;
create policy inventory_stock_select on inventory_stock for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_stock_insert on inventory_stock for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('franchise_manager','purchasing') and franchise_id = current_franchise_id()));
create policy inventory_stock_update on inventory_stock for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('franchise_manager','purchasing') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('franchise_manager','purchasing') and franchise_id = current_franchise_id()));
create policy inventory_stock_delete on inventory_stock for delete to authenticated
  using ("current_role"() = 'central_admin');

create table reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid references inventory_item_types (id) on delete set null,
  requested_amount numeric,
  justification text,
  status text not null default 'open',
  triggered_by_alert_id uuid,
  requested_by uuid not null references profiles (id) on delete restrict,
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_reimb_franchise_id on reimbursement_requests (franchise_id);
create index idx_reimb_status on reimbursement_requests (status);
create trigger trg_reimbursement_requests_updated_at before update on reimbursement_requests for each row execute function set_updated_at();
alter table reimbursement_requests enable row level security;
create policy reimbursement_requests_select on reimbursement_requests for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy reimbursement_requests_insert on reimbursement_requests for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy reimbursement_requests_update on reimbursement_requests for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy reimbursement_requests_delete on reimbursement_requests for delete to authenticated
  using ("current_role"() = 'central_admin');

create table inventory_entries (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid not null references inventory_item_types (id) on delete restrict,
  quantity numeric not null,
  unit_cost numeric not null,
  supplier_name text,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  reimbursement_id uuid references reimbursement_requests (id) on delete set null,
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_entries_franchise_id on inventory_entries (franchise_id);
create index idx_entries_item_type_id on inventory_entries (item_type_id);
create index idx_entries_expires_at on inventory_entries (expires_at);
create trigger trg_inventory_entries_updated_at before update on inventory_entries for each row execute function set_updated_at();
alter table inventory_entries enable row level security;
create policy inventory_entries_select on inventory_entries for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_entries_insert on inventory_entries for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_entries_update on inventory_entries for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_entries_delete on inventory_entries for delete to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));

create table inventory_withdrawals (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid not null references inventory_item_types (id) on delete restrict,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  quantity numeric not null,
  withdrawn_at timestamptz not null default now(),
  source text not null default 'app',
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_withdrawals_franchise_id on inventory_withdrawals (franchise_id);
create index idx_withdrawals_vehicle_id on inventory_withdrawals (vehicle_id);
create index idx_withdrawals_item_type_id on inventory_withdrawals (item_type_id);
create trigger trg_inventory_withdrawals_updated_at before update on inventory_withdrawals for each row execute function set_updated_at();
alter table inventory_withdrawals enable row level security;
create policy inventory_withdrawals_select on inventory_withdrawals for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_withdrawals_insert on inventory_withdrawals for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_withdrawals_update on inventory_withdrawals for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy inventory_withdrawals_delete on inventory_withdrawals for delete to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));

create table alerts (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete cascade,
  alert_type text not null,
  vehicle_id uuid references vehicles (id) on delete cascade,
  item_type_id uuid references inventory_item_types (id) on delete cascade,
  target_profile_id uuid references profiles (id) on delete set null,
  message text not null,
  status text not null default 'pending',
  channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_alerts_franchise_id on alerts (franchise_id);
create index idx_alerts_status on alerts (status);
create index idx_alerts_type on alerts (alert_type);
create trigger trg_alerts_updated_at before update on alerts for each row execute function set_updated_at();
alter table alerts enable row level security;
create policy alerts_select on alerts for select to authenticated
  using ("current_role"() = 'central_admin' or target_profile_id = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy alerts_insert on alerts for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy alerts_update on alerts for update to authenticated
  using ("current_role"() = 'central_admin' or target_profile_id = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or target_profile_id = auth.uid() or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy alerts_delete on alerts for delete to authenticated
  using ("current_role"() = 'central_admin');

alter table reimbursement_requests
  add constraint fk_reimbursement_alert
  foreign key (triggered_by_alert_id) references alerts (id) on delete set null;

create table whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  from_phone_e164 text not null,
  matched_profile_id uuid references profiles (id) on delete set null,
  media_storage_path text,
  raw_payload jsonb,
  parse_status text not null default 'received',
  linked_record_type text,
  linked_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_wa_from_phone on whatsapp_inbound (from_phone_e164);
create index idx_wa_status on whatsapp_inbound (parse_status);
create trigger trg_whatsapp_inbound_updated_at before update on whatsapp_inbound for each row execute function set_updated_at();
alter table whatsapp_inbound enable row level security;
create policy whatsapp_inbound_select on whatsapp_inbound for select to authenticated
  using ("current_role"() = 'central_admin');
create policy whatsapp_inbound_insert on whatsapp_inbound for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy whatsapp_inbound_update on whatsapp_inbound for update to authenticated
  using ("current_role"() = 'central_admin') with check ("current_role"() = 'central_admin');
create policy whatsapp_inbound_delete on whatsapp_inbound for delete to authenticated
  using ("current_role"() = 'central_admin');