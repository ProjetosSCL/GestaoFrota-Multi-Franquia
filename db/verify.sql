-- =====================================================================
-- Fleet SCL — verificação da Fase 1 (rode no SQL Editor do Supabase)
-- Retorna uma linha por checagem. Tudo deve sair OK antes de abrir o app.
-- =====================================================================

-- 1) Tabelas existem e estão com RLS habilitado
select
  'tabela: ' || t.name as verificacao,
  case
    when to_regclass('public.' || t.name) is null then 'FALHOU'
    when not (select relrowsecurity from pg_class where oid = to_regclass('public.' || t.name)) then 'FALHOU'
    else 'OK'
  end as status,
  case
    when to_regclass('public.' || t.name) is null then 'tabela ausente'
    when not (select relrowsecurity from pg_class where oid = to_regclass('public.' || t.name)) then 'RLS DESABILITADO'
    else 'RLS ativo'
  end as detalhe
from (values
  ('franchises'),
  ('profiles'),
  ('vehicles'),
  ('vehicle_assignments'),
  ('maintenance_rules'),
  ('maintenance_records'),
  ('fuel_records'),
  ('inventory_item_types'),
  ('inventory_stock'),
  ('inventory_entries'),
  ('inventory_withdrawals'),
  ('reimbursement_requests'),
  ('alerts'),
  ('whatsapp_inbound')
) as t(name)

union all

-- 2) Toda tabela esperada tem pelo menos uma policy
select
  'policies: ' || t.name,
  case when count(p.policyname) > 0 then 'OK' else 'FALHOU' end,
  count(p.policyname)::text || ' policy(ies)'
from (values
  ('franchises'),
  ('profiles'),
  ('vehicles'),
  ('vehicle_assignments'),
  ('maintenance_rules'),
  ('maintenance_records'),
  ('fuel_records'),
  ('inventory_item_types'),
  ('inventory_stock'),
  ('inventory_entries'),
  ('inventory_withdrawals'),
  ('reimbursement_requests'),
  ('alerts'),
  ('whatsapp_inbound')
) as t(name)
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.name
group by t.name

union all

-- 3) Helpers de RLS existem e são SECURITY DEFINER
select
  'função current_franchise_id()',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_franchise_id' and p.prosecdef
  ) then 'OK' else 'FALHOU' end,
  'SECURITY DEFINER, retorno uuid'

union all

select
  'função current_role()',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_role' and p.prosecdef
  ) then 'OK' else 'FALHOU' end,
  'SECURITY DEFINER, retorno text'

union all

-- 4) Provisionamento automático de profile
select
  'trigger on_auth_user_created',
  case when exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal
  ) then 'OK' else 'FALHOU' end,
  'AFTER INSERT em auth.users → handle_new_user()'

union all

-- 5) Seed das 8 franquias
select
  'seed: 8 franquias',
  case when count(*) = 8 then 'OK' else 'FALHOU' end,
  count(*)::text || ' franquia(s) cadastrada(s)'
from franchises;
