# FUNCTIONS — GestãoFrota Multi-Franquia

> Documentação canônica de todas as functions/endpoints do backend **Supabase** (Edge Functions em Deno + Postgres RPCs/triggers + Cron Jobs via pg_cron) do **GestãoFrota Multi-Franquia**. Os nomes seguem exatamente a `docs/ESTRUTURA.md`. Quando uma regra de negócio do `docs/PROCESSO.md` exigiu uma function não detalhada na ESTRUTURA, ela foi adicionada e está marcada com **[EXTENSÃO]**.
>
> Convenções de autenticação:
> - **Usuário logado**: exige JWT válido do Supabase Auth; RLS + `current_franchise_id()`/`current_role()` aplicam o escopo da franquia.
> - **Admin/Gestor**: exige `role` em (`central_admin`, `franchise_manager`) conforme a operação.
> - **Webhook**: chamada externa autenticada por segredo/HMAC no header, sem JWT de usuário.
> - **Service role**: executada por cron/Edge Function com a chave `service_role` (bypass de RLS), nunca pelo frontend.

---

## Edge Functions

As Edge Functions rodam em Deno, são invocadas via HTTPS (`/functions/v1/<nome>`) e concentram toda a lógica server-side, OCR, webhooks e integrações externas. Nenhuma chave de IA/WhatsApp é exposta ao frontend.

### `ocr-receipt`
- **Propósito:** ler a foto do recibo de abastecimento ou a nota fiscal de manutenção via IA multimodal e preencher os campos estruturados do registro.
- **Input (body):**
  ```json
  {
    "record_type": "fuel | maintenance",
    "record_id": "uuid (opcional — registro já criado aguardando OCR)",
    "storage_path": "receipts/<franchise_id>/... ou invoices/<franchise_id>/...",
    "whatsapp_inbound_id": "uuid (opcional — quando originado de WhatsApp)"
  }
  ```
- **Output:**
  ```json
  {
    "ok": true,
    "parsed": { "cost": 312.50, "liters": 42.1, "odometer_km": 85210, "performed_at": "2026-...", "supplier_name": "Posto X" },
    "ocr_status": "parsed | failed"
  }
  ```
- **Regras/validações:**
  - Baixa a mídia do Storage pelo `storage_path`; valida que o path pertence à franquia do registro.
  - Chama a API de IA multimodal (**Gemini 2.5 Pro** ou **GPT 5.4**) para extrair `cost`, `liters`, `odometer_km`, data e `supplier_name`.
  - Atualiza o registro alvo em `fuel_records`/`maintenance_records` e seta `ocr_status='parsed'`; em erro de extração, `ocr_status='failed'` (o registro permanece para edição manual).
  - Para abastecimentos, aciona `register_fuel_record`/recálculo de km quando o `odometer_km` é lido pela primeira vez.
  - Nunca sobrescreve valores que o usuário já informou manualmente (preenche apenas campos vazios).
- **Autenticação:** usuário logado (chamada pelo app após upload) **ou** service role (quando chamada internamente pelo fluxo de WhatsApp).

### `whatsapp-webhook`
- **Propósito:** receber mensagens de entrada da Evolution API (foto de recibo/nota), identificar o colaborador e enfileirar para processamento.
- **Input (body):** payload bruto da Evolution API (`jsonb`), contendo `from` (telefone), `message`, URL/base64 da mídia.
- **Output:**
  ```json
  { "ok": true, "whatsapp_inbound_id": "uuid", "matched_profile_id": "uuid | null" }
  ```
- **Regras/validações:**
  - Normaliza o remetente para E.164 e casa com `profiles.phone_e164` → `matched_profile_id`. Se não casar, grava mesmo assim com `parse_status='received'` e `matched_profile_id=null` (gestor resolve depois).
  - Salva a mídia no bucket `receipts`/`invoices` sob o path da franquia do profile casado.
  - Insere em `whatsapp_inbound` com `raw_payload` e `parse_status='received'`.
  - Dispara `ocr-receipt` (service role) para a mídia recebida.
  - Idempotência: ignora reprocessamento de `message_id` já registrado.
- **Autenticação:** webhook (segredo/HMAC no header verificado contra variável de ambiente). Sem JWT de usuário.

### `whatsapp-link-record`
- **Propósito:** transformar um item de `whatsapp_inbound` já parseado no registro definitivo (`fuel`, `maintenance` ou `withdrawal`) e vinculá-lo.
- **Input (body):**
  ```json
  { "whatsapp_inbound_id": "uuid", "record_type": "fuel | maintenance | withdrawal", "vehicle_id": "uuid", "overrides": { "...campos opcionais..." } }
  ```
- **Output:**
  ```json
  { "ok": true, "linked_record_type": "fuel", "linked_record_id": "uuid" }
  ```
- **Regras/validações:**
  - Só opera sobre `whatsapp_inbound` com `parse_status='parsed'` e `matched_profile_id` não nulo.
  - Determina a franquia e o autor pelo `matched_profile_id`; o registro herda `source='whatsapp'`.
  - Chama a RPC correta: `register_fuel_record`, `register_maintenance_record` ou `withdraw_inventory_item`.
  - Atualiza `whatsapp_inbound.parse_status='linked'`, `linked_record_type` e `linked_record_id`.
  - Em falta de dados obrigatórios (ex.: `vehicle_id` ou `odometer_km` para abastecimento), marca `parse_status='failed'` e não cria registro parcial.
- **Autenticação:** service role (chamada interna após `ocr-receipt`) ou usuário logado gestor confirmando manualmente a vinculação.

### `send-alert`
- **Propósito:** enviar um alerta pendente pelo canal correto (WhatsApp, email ou in-app) e marcar como enviado.
- **Input (body):**
  ```json
  { "alert_id": "uuid" }
  ```
  *(ou sem body, quando invocada em lote pelo cron — processa todos `status='pending'`).*
- **Output:**
  ```json
  { "ok": true, "sent": 3, "failed": 0 }
  ```
- **Regras/validações:**
  - Lê `alerts` com `status='pending'`; escolhe canal por `alerts.channel` (`whatsapp` via Evolution API, `email` via Resend, `app` apenas marca para a central in-app).
  - Resolve o destinatário via `target_profile_id` (telefone/email em `profiles`).
  - Em sucesso seta `status='sent'`; em falha de envio registra erro e mantém `pending` para retry no próximo ciclo.
  - Não reenvia alertas já `sent`/`resolved`.
- **Autenticação:** service role (cron `cron_dispatch_alerts` e triggers de alerta). Não exposta ao frontend.

### `generate-cost-report`
- **Propósito:** gerar relatórios e insights de custo (combustível + manutenção + compras de estoque) por franquia, veículo e período usando IA.
- **Input (body):**
  ```json
  { "scope": "network | franchise | vehicle", "franchise_id": "uuid (opcional)", "vehicle_id": "uuid (opcional)", "period_start": "date", "period_end": "date" }
  ```
- **Output:**
  ```json
  { "ok": true, "summary": "texto com insights", "metrics": { "fuel_total": 0, "maintenance_total": 0, "inventory_total": 0, "cost_per_km": 0 }, "breakdown": [ ... ] }
  ```
- **Regras/validações:**
  - Valida o escopo pelo papel do solicitante: `franchise_manager`/`agent` só podem pedir `franchise`/`vehicle` da própria franquia; `scope='network'` só para `central_admin`.
  - Agrega `fuel_records`, `maintenance_records` e `inventory_entries` no período; calcula totais e `cost_per_km`.
  - Envia os dados agregados ao modelo de texto (**Claude Sonnet 4.6**) para gerar `summary` com insights e comparativos entre franquias.
- **Autenticação:** usuário logado (admin/gestor). RLS limita os dados de origem ao escopo permitido.

### `assign-vehicle`
- **Propósito:** atribuir/transferir a posse de um veículo a um agente, mantendo o histórico de "quem está de posse".
- **Input (body):**
  ```json
  { "vehicle_id": "uuid", "agent_id": "uuid" }
  ```
- **Output:**
  ```json
  { "ok": true, "assignment_id": "uuid", "previous_assignment_closed": true }
  ```
- **Regras/validações:**
  - Só `franchise_manager` da franquia do veículo ou `central_admin` pode atribuir (atribuição é ato de gestão).
  - `vehicle_id` e `agent_id` devem pertencer à mesma franquia.
  - Fecha o `vehicle_assignments` aberto (`ended_at = now()`), abre um novo (`assigned_by = auth.uid()`) e atualiza `vehicles.current_assignee_id`.
  - Garante a regra de negócio "todo veículo deve ter sempre um agente responsável": impede fechar a posse sem definir um novo agente.
- **Autenticação:** usuário logado (admin/gestor).

---

## Postgres Functions (RPC/triggers)

Funções em `snake_case`. RPCs são chamadas pelo client via `supabase.rpc(...)` (respeitando RLS); triggers disparam em eventos de tabela; funções de cron rodam via `pg_cron`.

### `current_franchise_id()`
- **Tipo:** função auxiliar `SECURITY DEFINER` (usada em políticas RLS; não chamada diretamente pelo client).
- **Propósito:** retornar o `franchise_id` do `auth.uid()` atual a partir de `profiles`.
- **Input:** nenhum. **Output:** `uuid` (ou `null` para `central_admin` sem franquia fixa).
- **Regras:** leitura de `profiles` do usuário autenticado; base para a regra "cada usuário só vê dados da sua franquia".
- **Quando dispara:** avaliada dentro das políticas RLS em cada SELECT/INSERT/UPDATE/DELETE.

### `current_role()`
- **Tipo:** função auxiliar `SECURITY DEFINER`.
- **Propósito:** retornar o `role` do usuário atual (`central_admin`|`franchise_manager`|`agent`|`purchasing`).
- **Input:** nenhum. **Output:** `text`.
- **Regras:** leitura de `profiles`; base para checagens de alçada nas políticas e RPCs.
- **Quando dispara:** avaliada dentro das políticas RLS e no início das RPCs que validam papel.
- **⚠️ Nome reservado:** `current_role` é palavra reservada do Postgres. A função **sempre**
  deve ser escrita entre aspas — `"current_role"()` — em definições, policies e SQL manual.
  Sem as aspas o script falha com `syntax error at or near "current_role"`.

### `register_fuel_record(...)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** registrar um abastecimento, atualizar o hodômetro do veículo e recalcular regras de manutenção por km.
- **Input:** `p_vehicle_id uuid`, `p_cost numeric`, `p_liters numeric`, `p_odometer_km numeric`, `p_fueled_at timestamptz`, `p_receipt_storage_path text`, `p_source text default 'app'`.
- **Output:** `uuid` (id do `fuel_records` criado).
- **Regras:**
  - Exige `cost` e `odometer_km` (regra: todo abastecimento exige valor e quilometragem).
  - Valida que o veículo pertence à franquia do autor; grava `franchise_id` e `created_by` automaticamente.
  - Rejeita `odometer_km` menor que `vehicles.current_odometer_km` (hodômetro não retrocede).
  - Atualiza `vehicles.current_odometer_km` e chama `recalculate_maintenance_due(p_vehicle_id)`.
- **Quando dispara:** RPC via tela `/fuel/new` ou pelo fluxo de WhatsApp (`whatsapp-link-record`).

### `register_maintenance_record(...)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** registrar uma manutenção realizada e atualizar a regra de manutenção correspondente.
- **Input:** `p_vehicle_id uuid`, `p_rule_id uuid` (nullable para avulsa), `p_service_description text`, `p_cost numeric`, `p_supplier_name text`, `p_odometer_km numeric`, `p_performed_at timestamptz`, `p_invoice_storage_path text`, `p_source text default 'app'`.
- **Output:** `uuid` (id do `maintenance_records` criado).
- **Regras:**
  - Exige `service_description` e `cost`.
  - Valida veículo × franquia do autor; grava `franchise_id`/`created_by`.
  - Quando `p_rule_id` informado, atualiza `maintenance_rules.last_done_at = performed_at` e `last_done_odometer_km = odometer_km`, depois chama `recalculate_maintenance_due`.
  - Resolve alertas abertos de `maintenance_due` do veículo/regra quando a manutenção é cumprida.
- **Quando dispara:** RPC via tela `/maintenance/new` ou via `whatsapp-link-record`.

### `withdraw_inventory_item(...)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** registrar retirada de peça do estoque vinculada a um veículo e abater o saldo.
- **Input:** `p_item_type_id uuid`, `p_vehicle_id uuid`, `p_quantity numeric`, `p_source text default 'app'`.
- **Output:** `uuid` (id do `inventory_withdrawals` criado).
- **Regras:**
  - Regra: retirada deve estar vinculada a um veículo e abater a quantidade disponível.
  - Valida saldo em `inventory_stock.quantity_on_hand` da franquia; rejeita se `quantity > saldo`.
  - Insere `inventory_withdrawals` e decrementa `inventory_stock.quantity_on_hand` atomicamente (mesma transação).
  - Deriva `franchise_id` do profile; valida que o veículo é da mesma franquia.
  - Reavalia estoque baixo (se cruzar `min_quantity`, deixa o cron `cron_check_stock_low` gerar alerta no próximo ciclo; opcionalmente aciona checagem imediata).
- **Quando dispara:** RPC via tela `/inventory/withdraw` ou via `whatsapp-link-record`.

### `register_inventory_entry(...)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** dar entrada de compra de itens, somar ao estoque e calcular a validade/durabilidade.
- **Input:** `p_item_type_id uuid`, `p_quantity numeric`, `p_unit_cost numeric`, `p_supplier_name text`, `p_purchased_at timestamptz`, `p_reimbursement_id uuid` (nullable).
- **Output:** `uuid` (id do `inventory_entries` criado).
- **Regras:**
  - Calcula `expires_at = purchased_at + durability_months` lido de `inventory_item_types` (regra de validade pelo fabricante, ex.: 3 meses).
  - Insere `inventory_entries` e incrementa `inventory_stock.quantity_on_hand` (cria a linha de estoque se ainda não existir para a franquia/item).
  - Quando `p_reimbursement_id` informado, marca `reimbursement_requests.status='purchased'`.
  - Deriva `franchise_id`/`created_by` do profile; exige papel `purchasing`/`franchise_manager`/`central_admin`.
- **Quando dispara:** RPC via tela `/inventory/entry`.

### `recalculate_maintenance_due(vehicle_id)`
- **Tipo:** função interna (chamada por outras RPCs; também pode ser chamada pelo cron).
- **Propósito:** recalcular o vencimento de manutenção por km e por tempo, aplicando "o que vencer primeiro".
- **Input:** `p_vehicle_id uuid`. **Output:** `void`.
- **Regras:**
  - Para cada `maintenance_rules` ativa do veículo: `next_due_odometer_km = last_done_odometer_km + interval_km` (se `interval_km` definido) e `next_due_at = last_done_at + interval_months` (se `interval_months` definido).
  - Mantém ambos os campos; o disparo do alerta considera o que vencer primeiro (km ou data).
- **Quando dispara:** internamente após `register_fuel_record` e `register_maintenance_record`; e pelo `cron_check_maintenance_due`.

### `set_updated_at()` **[EXTENSÃO]**
- **Tipo:** trigger de tabela (`BEFORE UPDATE`).
- **Propósito:** manter `updated_at = now()` em tabelas que têm esse campo (ex.: `inventory_stock`).
- **Input/Output:** padrão de trigger (`NEW`/`OLD`).
- **Regras:** apenas atualiza o timestamp; não altera dados de negócio.
- **Quando dispara:** `BEFORE UPDATE` de `inventory_stock` (e demais tabelas com `updated_at`). *Extensão adicionada para consistência de auditoria, não detalhada na ESTRUTURA.*

### `handle_new_user()` **[EXTENSÃO]**
- **Tipo:** trigger de tabela (`AFTER INSERT` em `auth.users`), `SECURITY DEFINER`.
- **Propósito:** criar automaticamente o registro em `profiles` quando um colaborador é criado no Supabase Auth.
- **Input/Output:** `NEW` de `auth.users`.
- **Regras:** cria `profiles` com `role='agent'` default e `franchise_id` vindo do metadata do convite; admin/gestor ajustam depois em `/users`. Sustenta a regra de que todo usuário logado tem profile com franquia/papel.
- **Quando dispara:** `AFTER INSERT` em `auth.users`. *Extensão para automatizar o provisionamento de perfil, implícita na RLS da ESTRUTURA.*

---

### Cron Jobs (pg_cron)

### `cron_check_maintenance_due`
- **Tipo:** função de cron (pg_cron) — **frequência: diária**.
- **Propósito:** detectar veículos próximos do limite de km OU de tempo e gerar alertas de manutenção.
- **Input/Output:** sem parâmetros; produz linhas em `alerts`.
- **Regras:**
  - Varre `maintenance_rules` ativas; compara `next_due_odometer_km` com `vehicles.current_odometer_km` e `next_due_at` com `now()` dentro de uma janela de antecedência.
  - Aplica "o que vencer primeiro"; evita duplicar alerta já `pending`/`sent` para a mesma regra.
  - Cria `alerts` tipo `maintenance_due` endereçado ao `current_assignee_id` (agente) e ao gestor da franquia, com `channel` padrão (`whatsapp`/`app`).
- **Quando dispara:** agendamento diário via pg_cron.

### `cron_check_stock_low`
- **Tipo:** função de cron (pg_cron) — **frequência: diária**.
- **Propósito:** detectar estoque abaixo do mínimo e abrir alerta + solicitação de reposição.
- **Input/Output:** sem parâmetros; produz linhas em `alerts` e `reimbursement_requests`.
- **Regras:**
  - Compara `inventory_stock.quantity_on_hand` com `min_quantity` por franquia/item.
  - Cria `alerts` tipo `stock_low` e abre `reimbursement_requests` (`status='open'`) vinculada via `triggered_by_alert_id`, endereçada ao responsável por compras/gestor.
  - Evita duplicar solicitação `open` já existente para o mesmo item/franquia.
- **Quando dispara:** agendamento diário via pg_cron.

### `cron_check_item_expiring`
- **Tipo:** função de cron (pg_cron) — **frequência: diária**.
- **Propósito:** avisar quando itens em estoque se aproximam do fim da durabilidade do fabricante.
- **Input/Output:** sem parâmetros; produz linhas em `alerts`.
- **Regras:**
  - Verifica `inventory_entries.expires_at` dentro de uma janela de antecedência.
  - Cria `alerts` tipo `item_expiring` para o gestor/responsável da franquia; não duplica alerta já aberto para a mesma entrada.
- **Quando dispara:** agendamento diário via pg_cron.

### `cron_dispatch_alerts`
- **Tipo:** função de cron (pg_cron) — **frequência: a cada 15 minutos**.
- **Propósito:** despachar os alertas pendentes pelos canais configurados.
- **Input/Output:** sem parâmetros; invoca a Edge Function `send-alert`.
- **Regras:**
  - Seleciona `alerts` com `status='pending'` e chama `send-alert` (service role).
  - Serve de camada de retry para alertas que falharam o envio anterior.
- **Quando dispara:** agendamento a cada 15 min via pg_cron.

---

> **Resumo de cobertura:** todas as 6 Edge Functions (`ocr-receipt`, `whatsapp-webhook`, `whatsapp-link-record`, `send-alert`, `generate-cost-report`, `assign-vehicle`), as RPCs/helpers (`current_franchise_id`, `current_role`, `register_fuel_record`, `register_maintenance_record`, `withdraw_inventory_item`, `register_inventory_entry`, `recalculate_maintenance_due`) e os 4 Cron Jobs da ESTRUTURA estão documentados. Foram adicionadas como **[EXTENSÃO]** as triggers `set_updated_at()` e `handle_new_user()`, necessárias respectivamente para auditoria de `updated_at` e para o provisionamento automático de `profiles` exigido pela RLS.
