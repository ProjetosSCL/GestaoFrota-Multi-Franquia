-- =====================================================================
-- Fleet SCL — teste de isolamento por franquia (gate da Fase 1)
--
-- Pré-requisito: existir um profile com role 'agent' vinculado a RN - Macau
-- (troque o nome da franquia nas duas referências se preferir outro par).
--
-- Simula o JWT de um agente de Macau e confirma que ele NÃO enxerga
-- nenhuma linha de PB - Patos. Roda em transação e termina com ROLLBACK.
-- =====================================================================

do $$
begin
  if not exists (select 1 from franchises where name = 'PB - Patos') then
    raise exception 'Franquia PB - Patos não encontrada. Rode db/seed.sql antes do teste.';
  end if;

  if not exists (
    select 1
    from profiles p
    join franchises f on f.id = p.franchise_id
    where f.name = 'RN - Macau' and p.role = 'agent' and p.is_active
  ) then
    raise exception 'Crie antes um usuário agent ativo vinculado a RN - Macau.';
  end if;
end;
$$;

begin;

-- Guarda o id de Patos antes de trocar de role (o agente não pode ler franchises de outra unidade).
select set_config(
  'test.patos_id',
  (select id::text from franchises where name = 'PB - Patos'),
  true
);

-- Simula o JWT do agente de Macau.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (
      select p.id
      from profiles p
      join franchises f on f.id = p.franchise_id
      where f.name = 'RN - Macau' and p.role = 'agent' and p.is_active
      limit 1
    ),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

select
  auth.uid() as uid_do_agente,
  current_franchise_id() as franquia_do_agente,
  "current_role"() as papel_do_agente;

-- Cada linha deve retornar 0.
select 'vehicles' as tabela, count(*) as linhas_de_patos
  from vehicles where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'fuel_records', count(*)
  from fuel_records where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'maintenance_records', count(*)
  from maintenance_records where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'inventory_stock', count(*)
  from inventory_stock where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'inventory_entries', count(*)
  from inventory_entries where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'inventory_withdrawals', count(*)
  from inventory_withdrawals where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'reimbursement_requests', count(*)
  from reimbursement_requests where franchise_id = current_setting('test.patos_id')::uuid
union all
select 'vehicle_assignments', count(*)
  from vehicle_assignments where vehicle_id in (
    select id from vehicles where franchise_id = current_setting('test.patos_id')::uuid
  )
union all
select 'maintenance_rules', count(*)
  from maintenance_rules where vehicle_id in (
    select id from vehicles where franchise_id = current_setting('test.patos_id')::uuid
  );

do $$
declare
  v_patos uuid := current_setting('test.patos_id')::uuid;
  v_vehicles bigint;
  v_fuel bigint;
  v_maint bigint;
  v_stock bigint;
  v_entries bigint;
  v_withdrawals bigint;
  v_reimbursements bigint;
  v_assignments bigint;
  v_rules bigint;
begin
  select count(*) into v_vehicles from vehicles where franchise_id = v_patos;
  select count(*) into v_fuel from fuel_records where franchise_id = v_patos;
  select count(*) into v_maint from maintenance_records where franchise_id = v_patos;
  select count(*) into v_stock from inventory_stock where franchise_id = v_patos;
  select count(*) into v_entries from inventory_entries where franchise_id = v_patos;
  select count(*) into v_withdrawals from inventory_withdrawals where franchise_id = v_patos;
  select count(*) into v_reimbursements from reimbursement_requests where franchise_id = v_patos;
  select count(*) into v_assignments
    from vehicle_assignments
   where vehicle_id in (select id from vehicles where franchise_id = v_patos);
  select count(*) into v_rules
    from maintenance_rules
   where vehicle_id in (select id from vehicles where franchise_id = v_patos);

  if v_vehicles + v_fuel + v_maint + v_stock + v_entries + v_withdrawals
     + v_reimbursements + v_assignments + v_rules > 0 then
    raise exception
      'VAZAMENTO ENTRE FRANQUIAS: vehicles=%, fuel=%, maint=%, stock=%, entries=%, withdrawals=%, reimbursements=%, assignments=%, rules=%',
      v_vehicles, v_fuel, v_maint, v_stock, v_entries, v_withdrawals,
      v_reimbursements, v_assignments, v_rules;
  end if;

  raise notice 'RLS OK: agente de Macau não enxerga nenhuma linha de Patos.';
end;
$$;

rollback;
