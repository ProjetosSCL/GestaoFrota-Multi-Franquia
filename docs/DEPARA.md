# DE-PARA — GestãoFrota Multi-Franquia

> Matriz de rastreabilidade do pacote. Nomes de tabela em `snake_case`, RPCs do Postgres em `snake_case`, Edge Functions e rotas em `kebab-case`. Nenhum nome diverge da `ESTRUTURA.md` — este documento serve para quem for codar conferir que nenhuma tabela, function ou página ficou órfã.

---

## 1. Tabela (DB) → Functions/Endpoints → Páginas

| Tabela | Functions/Endpoints que a tocam | Páginas que a usam | Observação |
|---|---|---|---|
| `franchises` | `current_franchise_id()`, `cron_check_maintenance_due`, `cron_check_stock_low`, `cron_check_item_expiring`, `generate-cost-report` | `/franchises`, `/dashboard`, `/users`, `/reports` | Base multi-tenant das 8 unidades. SELECT amplo só para `central_admin`; demais só a própria via `current_franchise_id()`. CRUD apenas admin. |
| `profiles` | `current_franchise_id()`, `current_role()`, `assign-vehicle`, `whatsapp-webhook` (casa `phone_e164`), `send-alert` (destinatário) | `/login`, `/users`, `/settings`, `/dashboard`, `/vehicles/:id/assign` | Liga `auth.users` a franquia e papel. `phone_e164` é o que casa o remetente do WhatsApp em `whatsapp-webhook`. |
| `vehicles` | `assign-vehicle`, `register_fuel_record(...)`, `register_maintenance_record(...)`, `withdraw_inventory_item(...)`, `recalculate_maintenance_due(vehicle_id)`, `cron_check_maintenance_due`, `generate-cost-report` | `/vehicles`, `/vehicles/:id`, `/vehicles/:id/assign`, `/fuel/new`, `/maintenance/new`, `/inventory/withdraw`, `/dashboard` | `current_odometer_km` é atualizado por abastecimento; `current_assignee_id` espelha a posse atual mantida por `assign-vehicle`. |
| `vehicle_assignments` | `assign-vehicle` | `/vehicles/:id`, `/vehicles/:id/assign` | Histórico de posse (regra "quem está de posse"). `assign-vehicle` fecha o aberto e abre novo; INSERT só gestor/admin. |
| `maintenance_rules` | `register_maintenance_record(...)`, `recalculate_maintenance_due(vehicle_id)`, `cron_check_maintenance_due` | `/maintenance-rules`, `/vehicles/:id`, `/maintenance/new` | Parâmetros km/tempo. `next_due_at`/`next_due_odometer_km` são recalculados após manutenção e abastecimento. |
| `maintenance_records` | `register_maintenance_record(...)`, `ocr-receipt`, `whatsapp-link-record`, `generate-cost-report` | `/maintenance/new`, `/vehicles/:id`, `/reports` | Histórico de manutenções com nota fiscal. `ocr_status` atualizado por `ocr-receipt`; `source` distingue `app`/`whatsapp`. |
| `fuel_records` | `register_fuel_record(...)`, `ocr-receipt`, `whatsapp-link-record`, `generate-cost-report` | `/fuel/new`, `/vehicles/:id`, `/reports` | Abastecimentos com recibo. `register_fuel_record` também atualiza `vehicles.current_odometer_km` e dispara recálculo de regras. |
| `inventory_item_types` | `register_inventory_entry(...)`, `cron_check_stock_low`, `cron_check_item_expiring` | `/inventory/item-types`, `/inventory`, `/inventory/entry`, `/inventory/withdraw`, `/reimbursements` | Catálogo da rede com `durability_months`/`durability_km`. SELECT para todos; CRUD só `central_admin`. |
| `inventory_stock` | `withdraw_inventory_item(...)`, `register_inventory_entry(...)`, `cron_check_stock_low` | `/inventory`, `/inventory/withdraw`, `/inventory/entry` | Saldo por franquia. Mutado só via RPC (nunca UPDATE direto do front). `min_quantity` é o gatilho de `stock_low`. |
| `inventory_entries` | `register_inventory_entry(...)`, `cron_check_item_expiring`, `generate-cost-report` | `/inventory/entry`, `/inventory`, `/reports`, `/reimbursements` | Entradas de compra; `expires_at` calculado pela durabilidade. `reimbursement_id` liga a compra à solicitação de origem. |
| `inventory_withdrawals` | `withdraw_inventory_item(...)` | `/inventory/withdraw`, `/vehicles/:id` | Retirada vinculada a `vehicle_id`; a RPC valida saldo e abate `inventory_stock`. `source` distingue `app`/`whatsapp`. |
| `reimbursement_requests` | `cron_check_stock_low` (abre a solicitação), Make (sync com formulários existentes) | `/reimbursements`, `/inventory/entry` | Origem das compras ("formulários de reembolso"). `triggered_by_alert_id` liga ao alerta de estoque baixo; aprovação por gestor/admin. |
| `alerts` | `cron_check_maintenance_due`, `cron_check_stock_low`, `cron_check_item_expiring`, `cron_dispatch_alerts`, `send-alert` | `/alerts`, `/dashboard` | INSERT só via service role (crons). `send-alert` marca `status='sent'`; destinatário/gestor marca `resolved` em `/alerts`. |
| `whatsapp_inbound` | `whatsapp-webhook` (insere), `ocr-receipt` (parseia), `whatsapp-link-record` (vincula) | — (nenhuma; fluxo 100% server-side) | Fila de entrada do WhatsApp. SELECT/INSERT/UPDATE apenas service role; sem acesso do frontend. |

---

## 2. Function/Endpoint → Tabelas → Páginas (caminho inverso)

| Function/Endpoint | Tabelas que toca | Página(s) que chama | Observação |
|---|---|---|---|
| `ocr-receipt` (Edge) | `fuel_records`, `maintenance_records`, `whatsapp_inbound` | `/fuel/new`, `/maintenance/new` (+ disparo via `whatsapp-webhook`) | Chama IA multimodal (Gemini 2.5 Pro ou GPT 5.4) para extrair valor/data/km/fornecedor/litros e atualiza `ocr_status`. |
| `whatsapp-webhook` (Edge) | `whatsapp_inbound`, `profiles` | — (webhook da Evolution API) | Casa `from_phone_e164` com `profiles.phone_e164`, salva mídia no Storage e dispara `ocr-receipt`. |
| `whatsapp-link-record` (Edge) | `whatsapp_inbound`, `fuel_records`, `maintenance_records`, `inventory_withdrawals` | — (encadeada após `ocr-receipt`) | Cria o registro correto (`fuel`/`maintenance`/`withdrawal`) a partir do inbound parseado e preenche `linked_record_*`. |
| `send-alert` (Edge) | `alerts`, `profiles` | — (acionada por `cron_dispatch_alerts`) | Envia por `whatsapp` (Evolution), `email` (Resend) ou `app` e marca `status='sent'`. |
| `generate-cost-report` (Edge) | `fuel_records`, `maintenance_records`, `inventory_entries`, `vehicles`, `franchises` | `/reports` | Usa Claude Sonnet 4.6 para relatórios/insights de custo por franquia/veículo/período. |
| `assign-vehicle` (Edge) | `vehicle_assignments`, `vehicles`, `profiles` | `/vehicles/:id/assign` | Fecha assignment aberto, abre novo e atualiza `vehicles.current_assignee_id`. Só gestor/admin. |
| `current_franchise_id()` (RPC) | `profiles`, `franchises` | — (interna, usada em RLS de todas as tabelas) | Helper `SECURITY DEFINER` que lê a franquia do `auth.uid()`. |
| `current_role()` (RPC) | `profiles` | — (interna, usada em RLS de todas as tabelas) | Helper `SECURITY DEFINER` que lê o papel do `auth.uid()`. |
| `register_fuel_record(...)` (RPC) | `fuel_records`, `vehicles`, `maintenance_rules` | `/fuel/new` | Insere abastecimento, atualiza `current_odometer_km` e chama `recalculate_maintenance_due`. |
| `register_maintenance_record(...)` (RPC) | `maintenance_records`, `maintenance_rules` | `/maintenance/new` | Insere manutenção, atualiza `last_done_*` e recalcula `next_due_at`/`next_due_odometer_km`. |
| `withdraw_inventory_item(...)` (RPC) | `inventory_withdrawals`, `inventory_stock`, `vehicles` | `/inventory/withdraw` | Valida saldo, insere retirada e abate `quantity_on_hand`; vincula a `vehicle_id`. |
| `register_inventory_entry(...)` (RPC) | `inventory_entries`, `inventory_stock`, `inventory_item_types` | `/inventory/entry` | Insere entrada, soma estoque e calcula `expires_at` pela `durability_months`. |
| `recalculate_maintenance_due(vehicle_id)` (RPC) | `maintenance_rules`, `vehicles` | — (interna, chamada por `register_fuel_record`/`register_maintenance_record`) | Recalcula vencimento por km OU tempo ("o que vencer primeiro"). |
| `cron_check_maintenance_due` (Cron, diário) | `maintenance_rules`, `vehicles`, `franchises`, `alerts` | — (agendado pg_cron) | Cria `alerts` tipo `maintenance_due` para veículos próximos do limite. |
| `cron_check_stock_low` (Cron, diário) | `inventory_stock`, `inventory_item_types`, `franchises`, `alerts`, `reimbursement_requests` | — (agendado pg_cron) | Compara saldo com `min_quantity`, cria `alerts` `stock_low` e abre `reimbursement_requests`. |
| `cron_check_item_expiring` (Cron, diário) | `inventory_entries`, `inventory_item_types`, `alerts` | — (agendado pg_cron) | Verifica `expires_at` próximos e cria `alerts` `item_expiring`. |
| `cron_dispatch_alerts` (Cron, 15 min) | `alerts` | — (agendado pg_cron) | Chama `send-alert` para todos os `alerts` com `status='pending'`. |

---

### Verificação de cobertura
- **14 tabelas** da ESTRUTURA mapeadas na Tabela 1 (`franchises`, `profiles`, `vehicles`, `vehicle_assignments`, `maintenance_rules`, `maintenance_records`, `fuel_records`, `inventory_item_types`, `inventory_stock`, `inventory_entries`, `inventory_withdrawals`, `reimbursement_requests`, `alerts`, `whatsapp_inbound`).
- **6 Edge Functions + 6 RPCs + 4 Cron Jobs** mapeados na Tabela 2.
- `whatsapp_inbound` é a única tabela sem página (fluxo exclusivamente server-side) — comportamento intencional conforme RLS (apenas service role).
- `reimbursement_requests` não é tocada por Edge Function/RPC dedicada (criada por `cron_check_stock_low` e sincronizada via Make) — intencional, mantendo compatibilidade com os formulários de reembolso atuais.
