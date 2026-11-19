-- ============================================================
-- schemas-02-core.sql  —  Bloco 2: catálogo de itens, frota, manutenção, abastecimento, reembolsos
-- Versão idempotente
-- ============================================================

create table if not exists inventory_item_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('car_tire', 'motorcycle_tire', 'oil', 'transmission_kit')),
  durability_months integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_item_types_category on inventory_item_types (category);
drop trigger if exists trg_inventory_item_types_updated_at on inventory_item_types;
create trigger trg_inventory_item_types_updated_at before update on inventory_item_types for each row execute function set_updated_at();
alter table inventory_item_types enable row level security;
drop policy if exists inventory_item_types_select on inventory_item_types;
drop policy if exists inventory_item_types_insert on inventory_item_types;
drop policy if exists inventory_item_types_update on inventory_item_types;
drop policy if exists inventory_item_types_delete on inventory_item_types;
create policy inventory_item_types_select on inventory_item_types for select to authenticated
  using ("current_role"() = 'central_admin' or true);
create policy inventory_item_types_insert on inventory_item_types for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy inventory_item_types_update on inventory_item_types for update to authenticated
  using ("current_role"() = 'central_admin') with check ("current_role"() = 'central_admin');
create policy inventory_item_types_delete on inventory_item_types for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  plate text not null,
  vehicle_type text not null check (vehicle_type in ('car', 'motorcycle')),
  model text not null,
  current_odometer_km numeric not null default 0,
  current_assignee_id uuid references profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vehicles_franchise_id on vehicles (franchise_id);
create index if not exists idx_vehicles_plate on vehicles (plate);
create index if not exists idx_vehicles_assignee on vehicles (current_assignee_id);
drop trigger if exists trg_vehicles_updated_at on vehicles;
create trigger trg_vehicles_updated_at before update on vehicles for each row execute function set_updated_at();
alter table vehicles enable row level security;
drop policy if exists vehicles_select on vehicles;
drop policy if exists vehicles_insert on vehicles;
drop policy if exists vehicles_update on vehicles;
drop policy if exists vehicles_delete on vehicles;
create policy vehicles_select on vehicles for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy vehicles_insert on vehicles for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy vehicles_update on vehicles for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy vehicles_delete on vehicles for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  agent_id uuid not null references profiles (id) on delete restrict,
  assigned_by uuid not null references profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_assignments_vehicle_id on vehicle_assignments (vehicle_id);
create index if not exists idx_assignments_agent_id on vehicle_assignments (agent_id);
drop trigger if exists trg_vehicle_assignments_updated_at on vehicle_assignments;
create trigger trg_vehicle_assignments_updated_at before update on vehicle_assignments for each row execute function set_updated_at();
alter table vehicle_assignments enable row level security;
drop policy if exists vehicle_assignments_select on vehicle_assignments;
drop policy if exists vehicle_assignments_insert on vehicle_assignments;
drop policy if exists vehicle_assignments_update on vehicle_assignments;
drop policy if exists vehicle_assignments_delete on vehicle_assignments;
create policy vehicle_assignments_select on vehicle_assignments for select to authenticated
  using ("current_role"() = 'central_admin' or vehicle_id in (select id from vehicles where franchise_id = current_franchise_id()));
create policy vehicle_assignments_insert on vehicle_assignments for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));
create policy vehicle_assignments_update on vehicle_assignments for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and vehicle_id in (select id from vehicles where franchise_id = current_franchise_id())));
create policy vehicle_assignments_delete on vehicle_assignments for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  vehicle_type text not null check (vehicle_type in ('car', 'motorcycle')),
  rule_name text not null,
  interval_km numeric,
  interval_months integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_maintenance_rules_franchise on maintenance_rules (franchise_id);
drop trigger if exists trg_maintenance_rules_updated_at on maintenance_rules;
create trigger trg_maintenance_rules_updated_at before update on maintenance_rules for each row execute function set_updated_at();
alter table maintenance_rules enable row level security;
drop policy if exists maintenance_rules_select on maintenance_rules;
drop policy if exists maintenance_rules_insert on maintenance_rules;
drop policy if exists maintenance_rules_update on maintenance_rules;
drop policy if exists maintenance_rules_delete on maintenance_rules;
create policy maintenance_rules_select on maintenance_rules for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy maintenance_rules_insert on maintenance_rules for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy maintenance_rules_update on maintenance_rules for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy maintenance_rules_delete on maintenance_rules for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists maintenance_records (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  rule_id uuid references maintenance_rules (id) on delete set null,
  service_description text not null,
  cost numeric,
  odometer_km numeric,
  service_date timestamptz not null default now(),
  receipt_storage_path text,
  ocr_status text check (ocr_status in ('pending', 'parsed', 'failed')),
  next_due_km numeric,
  next_due_date timestamptz,
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_maintenance_franchise on maintenance_records (franchise_id);
create index if not exists idx_maintenance_vehicle on maintenance_records (vehicle_id);
create index if not exists idx_maintenance_odometer on maintenance_records (odometer_km);
create index if not exists idx_maintenance_next_due_km on maintenance_records (next_due_km);
create index if not exists idx_maintenance_next_due_date on maintenance_records (next_due_date);
drop trigger if exists trg_maintenance_records_updated_at on maintenance_records;
create trigger trg_maintenance_records_updated_at before update on maintenance_records for each row execute function set_updated_at();
alter table maintenance_records enable row level security;
drop policy if exists maintenance_records_select on maintenance_records;
drop policy if exists maintenance_records_insert on maintenance_records;
drop policy if exists maintenance_records_update on maintenance_records;
drop policy if exists maintenance_records_delete on maintenance_records;
create policy maintenance_records_select on maintenance_records for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy maintenance_records_insert on maintenance_records for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy maintenance_records_update on maintenance_records for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy maintenance_records_delete on maintenance_records for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists fuel_records (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  cost numeric not null,
  liters numeric not null,
  odometer_km numeric not null,
  fueled_at timestamptz not null default now(),
  receipt_storage_path text,
  ocr_status text check (ocr_status in ('pending', 'parsed', 'failed')),
  source text not null default 'app' check (source in ('app', 'whatsapp')),
  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fuel_franchise on fuel_records (franchise_id);
create index if not exists idx_fuel_vehicle on fuel_records (vehicle_id);
create index if not exists idx_fuel_odometer on fuel_records (odometer_km);
create index if not exists idx_fuel_fueled_at on fuel_records (fueled_at);
drop trigger if exists trg_fuel_records_updated_at on fuel_records;
create trigger trg_fuel_records_updated_at before update on fuel_records for each row execute function set_updated_at();
alter table fuel_records enable row level security;
drop policy if exists fuel_records_select on fuel_records;
drop policy if exists fuel_records_insert on fuel_records;
drop policy if exists fuel_records_update on fuel_records;
drop policy if exists fuel_records_delete on fuel_records;
create policy fuel_records_select on fuel_records for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy fuel_records_insert on fuel_records for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy fuel_records_update on fuel_records for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy fuel_records_delete on fuel_records for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  agent_id uuid not null references profiles (id) on delete restrict,
  item_type_id uuid references inventory_item_types (id) on delete set null,
  requested_amount numeric,
  justification text,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'paid')),
  triggered_by_alert_id uuid,
  requested_by uuid not null references profiles (id) on delete restrict,
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reimb_franchise_id on reimbursement_requests (franchise_id);
create index if not exists idx_reimb_status on reimbursement_requests (status);
drop trigger if exists trg_reimbursement_requests_updated_at on reimbursement_requests;
create trigger trg_reimbursement_requests_updated_at before update on reimbursement_requests for each row execute function set_updated_at();
alter table reimbursement_requests enable row level security;
drop policy if exists reimbursement_requests_select on reimbursement_requests;
drop policy if exists reimbursement_requests_insert on reimbursement_requests;
drop policy if exists reimbursement_requests_update on reimbursement_requests;
drop policy if exists reimbursement_requests_delete on reimbursement_requests;
create policy reimbursement_requests_select on reimbursement_requests for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy reimbursement_requests_insert on reimbursement_requests for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy reimbursement_requests_update on reimbursement_requests for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id()));
create policy reimbursement_requests_delete on reimbursement_requests for delete to authenticated
  using ("current_role"() = 'central_admin');