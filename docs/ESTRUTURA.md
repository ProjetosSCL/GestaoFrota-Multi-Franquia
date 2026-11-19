# Estrutura Técnica — GestãoFrota Multi-Franquia

> **Caminho de build escolhido: Lovable + Supabase.** As respostas do dossiê descrevem uma rede de 8 franquias com +50 colaboradores que hoje opera em "planilhas e WhatsApp, mas é muito falho" — ou seja, **não há time de TI** sinalizado. Para tirar o GestãoFrota do papel pelo caminho mais rápido e manter o sistema sem depender de desenvolvedores, o frontend será gerado pelo **Lovable (React + Tailwind + shadcn/ui)** com integração nativa ao **Supabase**. Toda a lógica server-side (OCR de notas, cálculo de vencimento de manutenção, alertas, webhook de WhatsApp, relatórios de IA) roda em **Supabase Edge Functions + pg_cron**, de modo que o Lovable só consome essas funções. Na dúvida, Lovable — e aqui o perfil leigo confirma a escolha.

---

## 1. Modelo de dados

### `franchises`
Propósito: representa cada uma das 8 unidades da rede (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau, RN - Parelhas).
- `id` uuid PK default `gen_random_uuid()`
- `name` text NOT NULL
- `state` text NOT NULL  _(UF: CE, MG, PB, RN)_
- `city` text NOT NULL
- `is_active` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_franchises_state` em (`state`).

### `profiles`
Propósito: perfil de cada colaborador logado, ligando o usuário de Auth a uma franquia e a um papel.
- `id` uuid PK (FK → `auth.users.id`)
- `franchise_id` uuid FK → `franchises.id` (NOT NULL exceto para admin central, que pode ser null)
- `full_name` text NOT NULL
- `role` text NOT NULL default `'agent'` _(enum lógico: `central_admin`, `franchise_manager`, `agent`, `purchasing`)_
- `phone_e164` text  _(telefone normalizado para casar com remetente do WhatsApp)_
- `is_active` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_profiles_franchise_id` em (`franchise_id`), `idx_profiles_role` em (`role`), `idx_profiles_phone_e164` em (`phone_e164`).

### `vehicles`
Propósito: cada veículo da frota, com franquia dona, tipo e km atual.
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `plate` text NOT NULL
- `vehicle_type` text NOT NULL _(`car` | `motorcycle`)_
- `model` text
- `year` int
- `current_odometer_km` numeric NOT NULL default 0 _(alimentado a cada abastecimento/registro)_
- `current_assignee_id` uuid FK → `profiles.id` _(quem está "de posse" agora)_
- `is_active` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_vehicles_franchise_id` em (`franchise_id`), `idx_vehicles_current_assignee_id` em (`current_assignee_id`), unique `uq_vehicles_plate` em (`plate`).

### `vehicle_assignments`
Propósito: histórico de "quem esteve de posse de qual veículo e quando" (rastreabilidade da regra de agente responsável).
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid FK → `vehicles.id` NOT NULL
- `agent_id` uuid FK → `profiles.id` NOT NULL
- `assigned_by` uuid FK → `profiles.id` NOT NULL
- `started_at` timestamptz NOT NULL default `now()`
- `ended_at` timestamptz _(null = posse atual)_
- Índices: `idx_assignments_vehicle_id` em (`vehicle_id`), `idx_assignments_agent_id` em (`agent_id`), `idx_assignments_open` em (`vehicle_id`) where `ended_at is null`.

### `maintenance_rules`
Propósito: parâmetros de manutenção por veículo (troca a cada X km OU a cada Y meses — "o que vencer primeiro").
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid FK → `vehicles.id` NOT NULL
- `rule_label` text NOT NULL _(ex: "Troca de óleo")_
- `interval_km` numeric _(null se só por tempo)_
- `interval_months` int _(null se só por km)_
- `last_done_at` timestamptz
- `last_done_odometer_km` numeric
- `next_due_at` timestamptz _(calculado)_
- `next_due_odometer_km` numeric _(calculado)_
- `is_active` boolean NOT NULL default true
- Índices: `idx_rules_vehicle_id` em (`vehicle_id`), `idx_rules_next_due_at` em (`next_due_at`), `idx_rules_next_due_km` em (`next_due_odometer_km`).

### `maintenance_records`
Propósito: histórico de manutenções realizadas (serviço, custo, fornecedor, nota fiscal).
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid FK → `vehicles.id` NOT NULL
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `rule_id` uuid FK → `maintenance_rules.id` _(null se manutenção avulsa)_
- `service_description` text NOT NULL
- `cost` numeric NOT NULL
- `supplier_name` text
- `odometer_km` numeric
- `performed_at` timestamptz NOT NULL default `now()`
- `invoice_storage_path` text _(foto/nota no Storage)_
- `ocr_status` text NOT NULL default `'none'` _(`none`|`pending`|`parsed`|`failed`)_
- `source` text NOT NULL default `'app'` _(`app`|`whatsapp`)_
- `created_by` uuid FK → `profiles.id` NOT NULL
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_maint_vehicle_id` em (`vehicle_id`), `idx_maint_franchise_id` em (`franchise_id`), `idx_maint_performed_at` em (`performed_at`).

### `fuel_records`
Propósito: registro de abastecimentos (valor, km, recibo lido pela IA).
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid FK → `vehicles.id` NOT NULL
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `cost` numeric NOT NULL
- `liters` numeric
- `odometer_km` numeric NOT NULL
- `fueled_at` timestamptz NOT NULL default `now()`
- `receipt_storage_path` text
- `ocr_status` text NOT NULL default `'none'`
- `source` text NOT NULL default `'app'` _(`app`|`whatsapp`)_
- `created_by` uuid FK → `profiles.id` NOT NULL
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_fuel_vehicle_id` em (`vehicle_id`), `idx_fuel_franchise_id` em (`franchise_id`), `idx_fuel_fueled_at` em (`fueled_at`).

### `inventory_item_types`
Propósito: catálogo padrão de itens de estoque da rede (pneu de carro, pneu de moto, óleo, kit de transmissão) com durabilidade do fabricante.
- `id` uuid PK default `gen_random_uuid()`
- `name` text NOT NULL
- `category` text _(ex: `tire`, `oil`, `transmission_kit`)_
- `durability_months` int _(ex: 3 meses pelo fabricante)_
- `durability_km` numeric
- `created_by` uuid FK → `profiles.id`
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_item_types_category` em (`category`).

### `inventory_stock`
Propósito: nível de estoque de cada item por franquia, com mínimo para disparo de reposição.
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `item_type_id` uuid FK → `inventory_item_types.id` NOT NULL
- `quantity_on_hand` numeric NOT NULL default 0
- `min_quantity` numeric NOT NULL default 0 _(gatilho de alerta de estoque baixo)_
- `updated_at` timestamptz NOT NULL default `now()`
- Índices: unique `uq_stock_franchise_item` em (`franchise_id`,`item_type_id`), `idx_stock_franchise_id` em (`franchise_id`).

### `inventory_entries`
Propósito: entradas de estoque (compra/reposição) com quantidade, fornecedor, custo e validade calculada.
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `item_type_id` uuid FK → `inventory_item_types.id` NOT NULL
- `quantity` numeric NOT NULL
- `unit_cost` numeric NOT NULL
- `supplier_name` text
- `purchased_at` timestamptz NOT NULL default `now()`
- `expires_at` timestamptz _(calculado por `durability_months`)_
- `reimbursement_id` uuid FK → `reimbursement_requests.id`
- `created_by` uuid FK → `profiles.id` NOT NULL
- Índices: `idx_entries_franchise_id` em (`franchise_id`), `idx_entries_item_type_id` em (`item_type_id`), `idx_entries_expires_at` em (`expires_at`).

### `inventory_withdrawals`
Propósito: retiradas de peça do estoque vinculadas a um veículo (abate quantidade).
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `item_type_id` uuid FK → `inventory_item_types.id` NOT NULL
- `vehicle_id` uuid FK → `vehicles.id` NOT NULL
- `quantity` numeric NOT NULL
- `withdrawn_at` timestamptz NOT NULL default `now()`
- `source` text NOT NULL default `'app'` _(`app`|`whatsapp`)_
- `created_by` uuid FK → `profiles.id` NOT NULL
- Índices: `idx_withdrawals_franchise_id` em (`franchise_id`), `idx_withdrawals_vehicle_id` em (`vehicle_id`), `idx_withdrawals_item_type_id` em (`item_type_id`).

### `reimbursement_requests`
Propósito: solicitações de dinheiro/reembolso que originam as compras de estoque (como já feito hoje via formulários).
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `item_type_id` uuid FK → `inventory_item_types.id`
- `requested_amount` numeric
- `justification` text
- `status` text NOT NULL default `'open'` _(`open`|`approved`|`rejected`|`purchased`)_
- `triggered_by_alert_id` uuid FK → `alerts.id`
- `requested_by` uuid FK → `profiles.id` NOT NULL
- `approved_by` uuid FK → `profiles.id`
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_reimb_franchise_id` em (`franchise_id`), `idx_reimb_status` em (`status`).

### `alerts`
Propósito: alertas gerados pelo sistema (manutenção próxima, estoque baixo, item vencendo).
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises.id` NOT NULL
- `alert_type` text NOT NULL _(`maintenance_due`|`stock_low`|`item_expiring`)_
- `vehicle_id` uuid FK → `vehicles.id`
- `item_type_id` uuid FK → `inventory_item_types.id`
- `target_profile_id` uuid FK → `profiles.id` _(agente/gestor destinatário)_
- `message` text NOT NULL
- `status` text NOT NULL default `'pending'` _(`pending`|`sent`|`resolved`)_
- `channel` text _(`app`|`whatsapp`|`email`)_
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_alerts_franchise_id` em (`franchise_id`), `idx_alerts_status` em (`status`), `idx_alerts_type` em (`alert_type`).

### `whatsapp_inbound`
Propósito: fila de mensagens recebidas via WhatsApp (foto de recibo) antes de virar registro.
- `id` uuid PK default `gen_random_uuid()`
- `from_phone_e164` text NOT NULL
- `matched_profile_id` uuid FK → `profiles.id`
- `media_storage_path` text
- `raw_payload` jsonb
- `parse_status` text NOT NULL default `'received'` _(`received`|`parsed`|`linked`|`failed`)_
- `linked_record_type` text _(`fuel`|`maintenance`|`withdrawal`)_
- `linked_record_id` uuid
- `created_at` timestamptz NOT NULL default `now()`
- Índices: `idx_wa_from_phone` em (`from_phone_e164`), `idx_wa_status` em (`parse_status`).

---

## 2. RLS e autenticação

**Autenticação:** Supabase Auth por **email + senha** (padrão para +50 colaboradores de 8 franquias) e **magic link** como opção de recuperação/entrada simples no celular. OAuth não é necessário no MVP. Cada usuário autenticado tem um registro em `profiles` com `franchise_id` e `role`. Funções auxiliares `SECURITY DEFINER`: `current_franchise_id()` e `current_role()` (leem o `profiles` do `auth.uid()`), usadas em todas as políticas.

Princípio central (regra do processo): **cada usuário só enxerga dados da sua franquia; apenas `central_admin` vê as 8**. RLS habilitado em todas as tabelas abaixo.

- **`franchises`** — SELECT: `central_admin` vê todas; demais veem só a própria (`id = current_franchise_id()`). INSERT/UPDATE/DELETE: só `central_admin`.
- **`profiles`** — SELECT: próprio registro, ou mesmo `franchise_id`, ou `central_admin` (tudo). INSERT/UPDATE: `central_admin` e `franchise_manager` (dentro da franquia); usuário pode UPDATE do próprio nome/telefone. DELETE: `central_admin`.
- **`vehicles`** — SELECT: mesma franquia ou `central_admin`. INSERT/UPDATE/DELETE: `central_admin` e `franchise_manager` da franquia.
- **`vehicle_assignments`** — SELECT: mesma franquia ou `central_admin`. INSERT/UPDATE: `franchise_manager`/`central_admin` (atribuição é ato de gestão).
- **`maintenance_rules`** — SELECT: mesma franquia ou `central_admin`. INSERT/UPDATE/DELETE: `central_admin` (regras da rede) e `franchise_manager`.
- **`maintenance_records`** — SELECT: mesma franquia ou `central_admin`. INSERT: `agent`/`franchise_manager`/`central_admin` da franquia (agente registra o que fez). UPDATE/DELETE: autor, `franchise_manager` ou `central_admin`.
- **`fuel_records`** — SELECT: mesma franquia ou `central_admin`. INSERT: `agent`/`franchise_manager`/`central_admin` da franquia. UPDATE/DELETE: autor ou gestor/admin.
- **`inventory_item_types`** — SELECT: todos autenticados (catálogo da rede). INSERT/UPDATE/DELETE: só `central_admin`.
- **`inventory_stock`** — SELECT: mesma franquia ou `central_admin`. INSERT/UPDATE: `franchise_manager`, `purchasing`, `central_admin` (mutado via RPC). DELETE: `central_admin`.
- **`inventory_entries`** — SELECT: mesma franquia ou `central_admin`. INSERT: `purchasing`/`franchise_manager`/`central_admin` da franquia. UPDATE/DELETE: gestor/admin.
- **`inventory_withdrawals`** — SELECT: mesma franquia ou `central_admin`. INSERT: `agent`/`franchise_manager` da franquia (retirada feita via RPC que valida saldo). UPDATE/DELETE: gestor/admin.
- **`reimbursement_requests`** — SELECT: mesma franquia ou `central_admin`. INSERT: `purchasing`/`franchise_manager`. UPDATE (aprovação): `franchise_manager` ou `central_admin` (alçada conforme suposição do processo). DELETE: `central_admin`.
- **`alerts`** — SELECT: `target_profile_id = auth.uid()` ou mesma franquia (gestor) ou `central_admin`. INSERT: apenas service role (Edge Functions/cron). UPDATE (marcar resolvido): destinatário, gestor ou admin.
- **`whatsapp_inbound`** — SELECT/INSERT/UPDATE: **apenas service role** (fluxo server-side). Nenhum acesso direto do frontend.
- **Storage** (buckets `receipts`, `invoices`): políticas por path `franchise_id/...`; leitura/escrita restrita a membros da mesma franquia; upload do agente permitido.

---

## 3. Functions/endpoints

### Edge Functions (Deno, kebab-case)
- **`ocr-receipt`** — recebe `receipt_storage_path`/`invoice_storage_path`, chama a API de IA multimodal para extrair valor, data, km, fornecedor e litros; grava no `fuel_records`/`maintenance_records` e atualiza `ocr_status`. Chamada: após upload no app, ou pelo fluxo de WhatsApp.
- **`whatsapp-webhook`** — recebe o webhook da Evolution API, casa `from_phone_e164` com `profiles.phone_e164`, salva mídia no Storage, insere em `whatsapp_inbound` e dispara `ocr-receipt`. Chamada: webhook de entrada do WhatsApp.
- **`whatsapp-link-record`** — a partir de um `whatsapp_inbound` parseado, cria o registro correto (`fuel`/`maintenance`/`withdrawal`) e vincula. Chamada: após `ocr-receipt` concluir sobre item vindo do WhatsApp.
- **`send-alert`** — envia o alerta pendente pelo canal (`whatsapp`|`email`|`app`) e marca `status='sent'`. Chamada: por cron e por triggers de alerta.
- **`generate-cost-report`** — usa IA para gerar relatórios/insights de custo de combustível e manutenção por franquia, veículo e período. Chamada: ação do usuário (admin/gestor) na página de relatórios.
- **`assign-vehicle`** — fecha `vehicle_assignments` aberto, abre novo e atualiza `vehicles.current_assignee_id`. Chamada: gestor atribui veículo a agente.

### Postgres RPCs / funções (snake_case)
- **`current_franchise_id()`** / **`current_role()`** — helpers `SECURITY DEFINER` para RLS.
- **`register_fuel_record(...)`** — insere abastecimento, atualiza `vehicles.current_odometer_km` e recalcula regras por km. Chamada: registro de abastecimento.
- **`register_maintenance_record(...)`** — insere manutenção, atualiza `maintenance_rules.last_done_*` e recalcula `next_due_at`/`next_due_odometer_km`. Chamada: registro de manutenção.
- **`withdraw_inventory_item(...)`** — valida saldo, insere `inventory_withdrawals` e abate `inventory_stock.quantity_on_hand`. Chamada: retirada de peça.
- **`register_inventory_entry(...)`** — insere `inventory_entries`, soma estoque e calcula `expires_at` pela durabilidade. Chamada: entrada de compra.
- **`recalculate_maintenance_due(vehicle_id)`** — recalcula vencimento por km/tempo ("o que vencer primeiro"). Chamada: internamente após abastecimento/manutenção.

### Cron Jobs (pg_cron)
- **`cron_check_maintenance_due`** (diário) — varre `maintenance_rules` e cria `alerts` tipo `maintenance_due` para veículos próximos do limite.
- **`cron_check_stock_low`** (diário) — compara `quantity_on_hand` com `min_quantity`, cria `alerts` `stock_low` e abre `reimbursement_requests`.
- **`cron_check_item_expiring`** (diário) — verifica `inventory_entries.expires_at` próximos e cria `alerts` `item_expiring`.
- **`cron_dispatch_alerts`** (a cada 15 min) — chama `send-alert` para alertas `pending`.

---

## 4. Páginas do frontend

- **`/login`** — autenticação. Login por email/senha e magic link.
- **`/dashboard`** — painel inicial por papel; admin vê consolidado das 8 franquias, gestor/agente veem a própria unidade (KPIs de custo, alertas abertos).
- **`/vehicles`** — lista de veículos da franquia (ou todas, para admin) com km atual e agente de posse.
- **`/vehicles/:id`** — detalhe do veículo: histórico de manutenções, regras, próxima troca, abastecimentos e botão de atribuir agente.
- **`/vehicles/:id/assign`** — gestor atribui/transfere a posse do veículo a um agente (chama `assign-vehicle`).
- **`/fuel/new`** — registrar abastecimento com valor, km e foto do recibo (dispara `ocr-receipt`).
- **`/maintenance/new`** — registrar manutenção com serviço, custo, fornecedor e nota fiscal.
- **`/maintenance-rules`** — gestão das regras de manutenção por km/tempo (admin/gestor).
- **`/inventory`** — estoque da franquia por item, com nível atual, mínimo e validade.
- **`/inventory/entry`** — dar entrada de compra de itens (quantidade, fornecedor, custo).
- **`/inventory/withdraw`** — registrar retirada de peça vinculada a um veículo.
- **`/inventory/item-types`** — catálogo de itens e durabilidade do fabricante (admin).
- **`/reimbursements`** — solicitações de dinheiro/reembolso e aprovação de compras.
- **`/alerts`** — central de alertas de manutenção, estoque baixo e itens vencendo.
- **`/reports`** — relatórios e insights de custo por franquia/veículo/período (chama `generate-cost-report`).
- **`/franchises`** — gestão das 8 franquias (apenas admin).
- **`/users`** — gestão de colaboradores e permissões (admin/gestor).
- **`/settings`** — perfil, telefone (para casar WhatsApp) e preferências de notificação.

---

## 5. Integrações externas

Todas chamadas via Supabase Edge Functions, nunca direto do frontend.

- **API de IA multimodal (Google Gemini 2.5 Pro ou GPT 5.4)** — OCR e extração estruturada de fotos de recibos de abastecimento e notas fiscais de manutenção (frente "ler fotos e notas fiscais" do processo). Multimodal nativo e contexto longo justificam a escolha; usada em `ocr-receipt`.
- **API de IA para texto (Claude Sonnet 4.6)** — geração dos relatórios e insights de custo por franquia/veículo/período em `generate-cost-report`; bom equilíbrio qualidade/custo para análise tabular recorrente.
- **Evolution API (WhatsApp)** — canal secundário de registro (foto do recibo) e de envio de alertas, conforme o pedido de "acrescentar WhatsApp também como segunda forma". Usada em `whatsapp-webhook` (entrada) e `send-alert` (saída).
- **Resend (email)** — envio de alertas por email como canal complementar (free tier cobre o volume de alertas de 8 franquias). Usada em `send-alert`.
- **Make (automação no-code)** — orquestração simples opcional entre os formulários de reembolso existentes e o `reimbursement_requests`, mantendo compatibilidade com o fluxo atual de "formulários de reembolso e solicitações de dinheiro".
