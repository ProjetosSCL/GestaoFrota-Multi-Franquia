-- =====================================================================
-- Fleet SCL — seed inicial (Fase 1)
-- Rode DEPOIS de db/schemas.sql, no SQL Editor do Supabase.
-- É idempotente: pode ser executado mais de uma vez sem duplicar as unidades.
-- =====================================================================

-- 1. As 8 franquias da rede (nome, UF, cidade)
insert into franchises (name, state, city)
select v.name, v.state, v.city
from (values
  ('CE - Limoeiro do Norte', 'CE', 'Limoeiro do Norte'),
  ('CE - Trairi',            'CE', 'Trairi'),
  ('MG - Paracatu',          'MG', 'Paracatu'),
  ('PB - Patos',             'PB', 'Patos'),
  ('RN - Apodi',             'RN', 'Apodi'),
  ('RN - João Camara',       'RN', 'João Camara'),
  ('RN - Macau',             'RN', 'Macau'),
  ('RN - Parelhas',          'RN', 'Parelhas')
) as v(name, state, city)
where not exists (
  select 1 from franchises f where f.name = v.name
);

-- 2. Usuário central_admin de teste
--    Crie o usuário antes em Authentication > Users (email/senha ou "Send invite"),
--    depois troque o e-mail abaixo e rode este bloco. O trigger handle_new_user()
--    já cria o profile como 'agent'; aqui ele é promovido a central_admin (sem franquia).
do $$
declare
  v_admin_email text := 'admin@fleetscl.com.br'; -- <-- ALTERE para o e-mail do admin de teste
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_admin_email);

  if v_user_id is null then
    raise notice 'Nenhum usuário com o e-mail %. Crie-o em Authentication > Users e rode este bloco de novo.', v_admin_email;
    return;
  end if;

  update profiles
     set role = 'central_admin',
         franchise_id = null,
         is_active = true
   where id = v_user_id;

  raise notice 'Usuário % promovido a central_admin.', v_admin_email;
end;
$$;

-- Conferência rápida: deve retornar 8 linhas.
select name, state, city, is_active
from franchises
order by state, city;
