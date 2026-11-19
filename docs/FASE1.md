# Fase 1 — Fundação · status da implementação

> Escopo do `docs/PLANO.md` (Fase 1): banco completo com RLS no Supabase, login por
> email/senha + magic link, layout base com menu lateral/cabeçalho e navegação por papel,
> seed das 8 franquias e um `central_admin` de teste.
>
> Nomes técnicos (tabelas, RPCs, rotas, papéis) seguem `docs/ESTRUTURA.md` / `docs/DEPARA.md`.
> O nome de produto exibido no app é **Fleet SCL**.

## 1. O que está pronto no repositório

| Item | Arquivo(s) | Situação |
|---|---|---|
| Schema completo (14 tabelas, índices, FKs, `updated_at`) | `db/schemas.sql` | pronto |
| RLS em todas as tabelas + helpers `current_franchise_id()` / `current_role()` | `db/schemas.sql` | pronto |
| Bloqueio de usuário com `is_active = false` nas policies | `db/schemas.sql` (helpers) | pronto |
| Criação automática de `profiles` no signup (`handle_new_user()`) | `db/schemas.sql` | pronto |
| Seed das 8 franquias + promoção do admin de teste | `db/seed.sql` | pronto |
| Conferência de tabelas/RLS/policies/trigger/seed | `db/verify.sql` | pronto |
| Teste de isolamento Macau × Patos | `db/tests/rls-isolation.sql` | pronto |
| App React + Vite + Tailwind + shadcn/ui | `package.json`, `src/` | pronto |
| `/login` (senha, magic link, recuperação, estados de erro/carregando) | `src/pages/Login.tsx` | pronto |
| `/dashboard` shell com KPIs por papel e estados vazio/carregando/erro | `src/pages/Dashboard.tsx` | pronto |
| Layout base: menu lateral, cabeçalho, versão mobile (Sheet), menu do usuário | `src/layouts/AppLayout.tsx` | pronto |
| Navegação e rotas condicionadas por papel | `src/lib/roles.ts`, `src/App.tsx` | pronto |
| Guardas de sessão/perfil/403 | `src/components/route-guards.tsx` | pronto |
| Tela de configuração quando faltam as credenciais | `src/pages/SetupRequired.tsx` | pronto |
| Módulos das fases seguintes com rota/papel reservados | `src/pages/ComingSoon.tsx` | placeholder |

## 2. Como subir (ordem exata)

### 2.1 Supabase

1. Crie/conecte o projeto no Supabase (ou pelo botão **Connect Supabase** do Lovable).
2. No **SQL Editor**, execute `db/schemas.sql` inteiro.
3. Execute `db/seed.sql` (idempotente) e confira as 8 franquias.
4. Rode `db/verify.sql`: todas as linhas devem sair **OK**.
5. Crie os usuários em **Authentication → Users**:
   - `central_admin` de teste (email/senha ou invite);
   - um `agent` de **RN - Macau**;
   - um `franchise_manager`, se quiser testar a navegação de gestor.
   No cadastro, preencha **User Metadata** com
   `{"full_name": "Nome Completo", "franchise_id": "<uuid da franquia>"}` —
   o `handle_new_user()` usa esses campos (o papel nasce sempre como `agent`).
6. Rode o bloco final de `db/seed.sql` trocando o e-mail para promover o admin de teste
   a `central_admin`. Para o gestor/agente, ajuste depois:
   ```sql
   update profiles
      set role = 'franchise_manager', franchise_id = (select id from franchises where name = 'RN - Macau')
    where id = (select id from auth.users where email = 'gestor@exemplo.com');
   ```
7. **Authentication → URL Configuration**:
   - *Site URL*: a URL do app (preview do Lovable ou domínio final);
   - *Redirect URLs*: `https://SEU-APP/dashboard` e `https://SEU-APP/login?mode=recovery`
     (adicione também `http://localhost:3000/**` para desenvolvimento).
8. **Authentication → Providers → Email**: habilitado; magic link usa o mesmo provider.
   Mantenha a confirmação de email conforme a política da rede.

### 2.2 App

```bash
npm install
cp .env.example .env.local   # preencha URL e anon key do projeto
npm run dev
```

Sem `.env.local`, o app abre a tela de configuração em vez de quebrar.

## 3. Como validar (gates da Fase 1)

1. `db/verify.sql` → 14 tabelas com RLS ativo, policies em todas, helpers `SECURITY DEFINER`,
   trigger `on_auth_user_created`, 8 franquias.
2. `db/tests/rls-isolation.sql` → o agente de Macau lê **zero** linhas de Patos
   (o script termina com `ROLLBACK`).
3. No app:
   - `/dashboard` sem sessão redireciona para `/login`;
   - login por senha, magic link e recuperação renderizam e mostram erro claro;
   - usuário `is_active = false` é desconectado com aviso;
   - menu lateral muda por papel;
   - agente em `/franchises` cai em `/unauthorized`.
4. `npm run build` sem erros (TypeScript + Vite).

## 4. O que foi verificado nesta entrega

- `npm run build` (tsc + vite) concluído sem erros.
- Navegação real no browser: `/login` (senha, magic link, recuperação, link expirado),
  guarda de sessão, dashboard com dados de exemplo, menu de administrador × agente,
  bloco de permissão (403) e logout.
- Estados de carregando/vazio/erro implementados no login e no dashboard.
- **Ensaio completo do banco em Postgres local (PGlite), 18/18 verificações OK:**
  `schemas.sql` executa inteiro; seed cria 8 franquias e é idempotente; o trigger
  `handle_new_user()` cria 4 profiles (role `agent`, franquia vinda do metadata,
  franquia inexistente vira `null`); seed promove o `central_admin`; `db/verify.sql`
  retorna tudo `OK`; `db/tests/rls-isolation.sql` passa; usuário inativo enxerga 0
  veículos; agente de Macau vê só a frota/combustível/alertas dele; `central_admin`
  vê os 2 veículos, 2 alertas e as 8 franquias.

**Ainda depende do seu ambiente Supabase:** executar `db/schemas.sql`, `db/seed.sql`,
rodar os dois scripts de verificação e criar os usuários reais. As credenciais não estão
neste repositório.

### Ordem de execução do `db/schemas.sql`

O script **precisa** rodar na ordem em que está: tabelas → helpers de RLS → policies.
Funções `language sql` têm o corpo validado na criação (`check_function_bodies`), então
`current_franchise_id()` / `"current_role"()` não podem ser criadas antes de `profiles`.
Do mesmo jeito, as policies resolvem os helpers ao serem criadas, por isso vêm depois.
Se editar o arquivo, mantenha essa ordem. O nome `current_role` é palavra reservada do
Postgres e **sempre** deve aparecer entre aspas: `"current_role"()`.

## 5. Observações para as próximas fases

- `alerts_select` (schema atual) deixa `purchasing` sem ver alertas; `docs/PAGINAS.md` prevê
  alertas de estoque para esse papel. Não alterei a policy — é uma decisão de produto para a Fase 2.
- Buckets `receipts` / `invoices` e suas policies de Storage entram junto com o upload da Fase 2.
- `db/schemas.sql` não é idempotente (usa `create table`); rode em projeto novo. Em banco já
  existente, aplique apenas o bloco de `handle_new_user()` e a troca dos helpers.
- O bloco `docs/PLANO.md` continua sendo o roteiro; os checkboxes ficam para quando a execução
  no Supabase e os usuários de teste estiverem confirmados.
