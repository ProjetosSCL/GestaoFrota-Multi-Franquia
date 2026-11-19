## Convenções

Este é o guia operacional para construir o **GestãoFrota Multi-Franquia** — sistema de gestão de frota, combustível, manutenções e estoque de peças para uma rede de **8 franquias** (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau, RN - Parelhas) e **+50 colaboradores**. Leia este arquivo antes de escrever qualquer linha e volte a ele sempre que tiver dúvida de "como fazer aqui".

**Nomenclatura (inegociável, segue `docs/DEPARA.md`):**
- Tabelas e colunas do banco: **inglês, `snake_case`** (`vehicles`, `maintenance_records`, `inventory_stock`, `vehicle_assignments`).
- RPCs do Postgres / triggers: **`snake_case`** (`current_franchise_id()`, `current_role()`).
- Edge Functions e rotas do frontend: **`kebab-case`** (`ocr-receipt`, `check-maintenance-due`, `/vehicles`, `/inventory`).
- Papéis de usuário (exatos, do PROCESSO): `central_admin`, `franchise_manager`, `agent`, `purchasing`. Não crie papéis novos.

**Stack (SEMPRE, não negociável):**
- **Backend: Supabase** — PostgreSQL + RLS, Auth (email/senha + magic link), Storage (fotos de recibos e notas fiscais), Edge Functions (Deno) para OCR/alertas/relatórios/webhook WhatsApp, Realtime e Cron Jobs (pg_cron) para as automações recorrentes.
- **Frontend: Lovable (React + Tailwind + shadcn/ui)** com integração nativa ao Supabase. **Caminho escolhido: Lovable** porque quem opera hoje usa planilhas e WhatsApp, não tem time técnico, e precisa do app no ar pelo caminho mais rápido. Não introduza Next.js/Vue/Angular. Não troque o banco por Firebase/Mongo/qualquer outro.
- **Automação:** pg_cron (dentro do Supabase) para os jobs de vencimento de manutenção, estoque baixo e expiração de item. WhatsApp via Evolution API em Edge Function. Nunca N8N nem Zapier.

**Multi-franquia é o coração do sistema:** quase toda tabela aponta para `franchises` e todo acesso passa por RLS usando `current_franchise_id()` e `current_role()`. `central_admin` vê as 8 unidades; os demais veem apenas a própria.

## Ordem de implementação recomendada

Siga as fases de `docs/PLANO.md` nesta sequência — cada etapa depende da anterior:

1. **Fundação (Fase 1):** Rode `db/schemas.sql` inteiro no Supabase — todas as tabelas (`franchises`, `profiles`, `vehicles`, `vehicle_assignments`, `maintenance_rules`, `maintenance_records`, `fuel_records`, `inventory_item_types`, `inventory_stock`, `inventory_entries`, `inventory_withdrawals`, `reimbursement_requests`, `alerts`). Habilite RLS em TODAS e crie as funções `current_franchise_id()` / `current_role()` que leem `profiles`. Seed das 8 franquias.
2. **Auth + layout base:** login email/senha + magic link; roteamento por papel; menu lateral e cabeçalho que todas as telas herdam. Teste que um `agent` de Macau não enxerga dados de Patos.
3. **Páginas de leitura/escrita do núcleo:** cadastro de veículos, atribuição de posse (`vehicle_assignments`), registro de abastecimento (`fuel_records`) e de manutenção (`maintenance_records`), conforme `docs/PAGINAS.md`.
4. **Estoque:** catálogo de tipos de item (`inventory_item_types` com duração do fabricante), entradas, retiradas e saldo (`inventory_stock`).
5. **Edge Functions + IA:** `ocr-receipt` (OCR de recibos/notas), cálculo de vencimento por km OU tempo ("o que vencer primeiro"), relatórios/insights de custo por franquia. Ver `docs/FUNCTIONS.md`.
6. **Cron Jobs + alertas:** `cron_check_maintenance_due`, `cron_check_stock_low`, `cron_check_item_expiry` gravando em `alerts` e disparando email/WhatsApp.
7. **WhatsApp como segunda via:** webhook (Evolution API) para enviar foto do recibo e processar via OCR.
8. **Polimento:** estados vazio/erro/loading, relatórios, responsividade mobile (agentes usam no celular).

## Como usar cada documento durante o desenvolvimento

- **`docs/PRD.md`** — Leia no início para entender o "porquê" e o escopo. Consulte quando bater dúvida se uma funcionalidade pertence ou não ao projeto.
- **`docs/PRS.md`** — Fonte dos requisitos funcionais (RF-01 a RF-...). Antes de implementar qualquer tela/function, confira qual RF ela atende (ex: RF-05 regra por km OU tempo, RF-08 OCR, RF-02 isolamento por franquia).
- **`db/schemas.sql`** — Fonte única da verdade do modelo de dados. **Nunca crie tabela ou coluna que não esteja aqui** sem antes atualizar este arquivo. Releia a definição da tabela antes de escrever queries contra ela.
- **`docs/PLANO.md`** — Seu roteiro de fases. Consulte no começo de cada etapa para saber o entregável e quais tabelas entram.
- **`docs/FUNCTIONS.md`** — Antes de criar qualquer Edge Function, RPC ou Cron Job, encontre a definição canônica aqui (nome, auth, input/output). Não invente endpoint fora desta lista; se faltar, marque como `[EXTENSÃO]` e documente.
- **`docs/PAGINAS.md`** — Antes de codar uma página, releia a seção dela: quais papéis acessam, quais functions consome, quais estados precisa. Respeite os papéis `central_admin`/`franchise_manager`/`agent`/`purchasing`.
- **`docs/DEPARA.md`** — **Antes de criar qualquer tabela, function ou página nova, confira aqui para não duplicar** e garantir que o nome bate com o resto do pacote. É a matriz de rastreabilidade — nada pode ficar órfão.

## Gates de qualidade

Antes de considerar qualquer etapa pronta, verifique:

- [ ] **RLS habilitado** em TODA tabela nova, com policy real por `current_franchise_id()`/`current_role()` — testada com usuário de outra franquia (um `agent` de Trairi NÃO pode ler dados de Apodi).
- [ ] **Nomenclatura confere com `docs/DEPARA.md`** (snake_case no banco, kebab-case em rotas/functions).
- [ ] **Nenhuma tabela/coluna fora de `db/schemas.sql`** foi criada silenciosamente.
- [ ] **Regra de negócio do PROCESSO aplicada de fato** — ex: vencimento de manutenção calcula "o que vencer primeiro" entre km e tempo; duração do item do fabricante gera alerta de expiração.
- [ ] **Estados vazio / carregando / erro** implementados em toda página (franquias sem veículos, OCR falhando, estoque zerado).
- [ ] **Papéis respeitados**: cada ação só aparece/funciona para quem tem permissão.
- [ ] **Mobile funciona**: agentes registram abastecimento/manutenção pelo celular.
- [ ] **Edge Function existe em `docs/FUNCTIONS.md`** antes de ser chamada pelo frontend.
- [ ] **Cron Jobs gravam em `alerts`** e as notificações (email/WhatsApp) saem de verdade.

## O que NÃO fazer

- ❌ **Não trocar o backend.** É Supabase — nada de Firebase, Mongo, PlanetScale ou banco paralelo.
- ❌ **Não trocar o caminho de build.** Frontend é Lovable (React); não introduza Next.js/Vue/Angular.
- ❌ **Não inventar tabela/coluna fora de `db/schemas.sql`.** Se precisar de um campo novo, atualize o schema e o `docs/DEPARA.md` primeiro.
- ❌ **Não pular RLS "por enquanto".** Com 8 franquias e +50 pessoas, vazar dados entre unidades é falha grave. RLS desde a primeira tabela.
- ❌ **Não criar papéis novos** nem misturar as permissões de `central_admin`, `franchise_manager`, `agent`, `purchasing`.
- ❌ **Não usar N8N nem Zapier.** Automação é pg_cron + Edge Functions (e Make só se for integração no-code simples).
- ❌ **Não colocar lógica pesada no frontend.** OCR de recibo, cálculo de vencimento, relatórios de IA e webhook de WhatsApp rodam em Edge Functions — a página só consome.
- ❌ **Não hardcodar as 8 franquias no código.** Elas vivem na tabela `franchises`; o front lê do banco.
- ❌ **Não assumir que todo dado chega pelo app.** WhatsApp é segunda via oficial de entrada (foto de recibo → OCR); trate dados incompletos/atrasados sem quebrar, já que hoje "nem sempre é feito por todos".
- ❌ **Não criar nomes de function/rota divergentes** dos de `docs/FUNCTIONS.md` e `docs/DEPARA.md`.