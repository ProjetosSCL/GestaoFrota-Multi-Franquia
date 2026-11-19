-- ============================================================
-- schemas-03-inventory.sql  —  Bloco 3: estoque, alertas, WhatsApp
-- Versão idempotente
-- ============================================================

create table if not exists inventory_stock (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid not null references inventory_item_types (id) on delete restrict,
  quantity_on_hand numeric not null default 0,
  min_quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (franchise_id, item_type_id)
);
create index if not exists idx_stock_franchise on inventory_stock (franchise_id);
create index if not exists idx_stock_item_type on inventory_stock (item_type_id);
drop trigger if exists trg_inventory_stock_updated_at on inventory_stock;
create trigger trg_inventory_stock_updated_at before update on inventory_stock for each row execute function set_updated_at();
alter table inventory_stock enable row level security;
drop policy if exists inventory_stock_select on inventory_stock;
drop policy if exists inventory_stock_insert on inventory_stock;
drop policy if exists inventory_stock_update on inventory_stock;
drop policy if exists inventory_stock_delete on inventory_stock;
create policy inventory_stock_select on inventory_stock for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_stock_insert on inventory_stock for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_stock_update on inventory_stock for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_stock_delete on inventory_stock for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists inventory_entries (
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
create index if not exists idx_entries_franchise_id on inventory_entries (franchise_id);
create index if not exists idx_entries_item_type_id on inventory_entries (item_type_id);
create index if not exists idx_entries_expires_at on inventory_entries (expires_at);
drop trigger if exists trg_inventory_entries_updated_at on inventory_entries;
create trigger trg_inventory_entries_updated_at before update on inventory_entries for each row execute function set_updated_at();
alter table inventory_entries enable row level security;
drop policy if exists inventory_entries_select on inventory_entries;
drop policy if exists inventory_entries_insert on inventory_entries;
drop policy if exists inventory_entries_update on inventory_entries;
drop policy if exists inventory_entries_delete on inventory_entries;
create policy inventory_entries_select on inventory_entries for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_entries_insert on inventory_entries for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_entries_update on inventory_entries for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('purchasing','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_entries_delete on inventory_entries for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists inventory_withdrawals (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  item_type_id uuid not null references inventory_item_types (id) on delete restrict,
  quantity numeric not null,
  vehicle_id uuid references vehicles (id) on delete set null,
  withdrawn_by uuid not null references profiles (id) on delete restrict,
  withdrawn_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_withdrawals_franchise on inventory_withdrawals (franchise_id);
create index if not exists idx_withdrawals_item_type on inventory_withdrawals (item_type_id);
create index if not exists idx_withdrawals_vehicle on inventory_withdrawals (vehicle_id);
drop trigger if exists trg_inventory_withdrawals_updated_at on inventory_withdrawals;
create trigger trg_inventory_withdrawals_updated_at before update on inventory_withdrawals for each row execute function set_updated_at();
alter table inventory_withdrawals enable row level security;
drop policy if exists inventory_withdrawals_select on inventory_withdrawals;
drop policy if exists inventory_withdrawals_insert on inventory_withdrawals;
drop policy if exists inventory_withdrawals_update on inventory_withdrawals;
drop policy if exists inventory_withdrawals_delete on inventory_withdrawals;
create policy inventory_withdrawals_select on inventory_withdrawals for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy inventory_withdrawals_insert on inventory_withdrawals for insert to authenticated
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_withdrawals_update on inventory_withdrawals for update to authenticated
  using ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()))
  with check ("current_role"() = 'central_admin' or ("current_role"() in ('agent','franchise_manager') and franchise_id = current_franchise_id()));
create policy inventory_withdrawals_delete on inventory_withdrawals for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  alert_type text not null check (alert_type in ('maintenance_due', 'stock_low', 'item_expiring', 'reimbursement_pending', 'assignment_overdue')),
  message text not null,
  target_profile_id uuid references profiles (id) on delete set null,
  is_read boolean not null default false,
  is_resolved boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_alerts_franchise on alerts (franchise_id);
create index if not exists idx_alerts_target on alerts (target_profile_id);
create index if not exists idx_alerts_unresolved on alerts (is_resolved) where not is_resolved;
drop trigger if exists trg_alerts_updated_at on alerts;
create trigger trg_alerts_updated_at before update on alerts for each row execute function set_updated_at();
alter table alerts enable row level security;
drop policy if exists alerts_select on alerts;
drop policy if exists alerts_insert on alerts;
drop policy if exists alerts_update on alerts;
drop policy if exists alerts_delete on alerts;
create policy alerts_select on alerts for select to authenticated
  using (
    "current_role"() = 'central_admin'
    or target_profile_id = auth.uid()
    or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id())
  );
create policy alerts_insert on alerts for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy alerts_update on alerts for update to authenticated
  using (
    "current_role"() = 'central_admin'
    or target_profile_id = auth.uid()
    or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id())
  )
  with check (
    "current_role"() = 'central_admin'
    or target_profile_id = auth.uid()
    or ("current_role"() = 'franchise_manager' and franchise_id = current_franchise_id())
  );
create policy alerts_delete on alerts for delete to authenticated
  using ("current_role"() = 'central_admin');

create table if not exists whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises (id) on delete restrict,
  from_number text not null,
  message_text text,
  media_url text,
  media_type text,
  processed boolean not null default false,
  linked_record_type text check (linked_record_type in ('fuel', 'maintenance')),
  linked_record_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_franchise on whatsapp_inbound (franchise_id);
create index if not exists idx_whatsapp_processed on whatsapp_inbound (processed);
alter table whatsapp_inbound enable row level security;
drop policy if exists whatsapp_inbound_select on whatsapp_inbound;
drop policy if exists whatsapp_inbound_insert on whatsapp_inbound;
drop policy if exists whatsapp_inbound_update on whatsapp_inbound;
drop policy if exists whatsapp_inbound_delete on whatsapp_inbound;
create policy whatsapp_inbound_select on whatsapp_inbound for select to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy whatsapp_inbound_insert on whatsapp_inbound for insert to authenticated
  with check ("current_role"() = 'central_admin');
create policy whatsapp_inbound_update on whatsapp_inbound for update to authenticated
  using ("current_role"() = 'central_admin' or franchise_id = current_franchise_id())
  with check ("current_role"() = 'central_admin' or franchise_id = current_franchise_id());
create policy whatsapp_inbound_delete on whatsapp_inbound for delete to authenticated
  using ("current_role"() = 'central_admin');