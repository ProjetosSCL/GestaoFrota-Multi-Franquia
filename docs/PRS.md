## 1. Requisitos de sistema

> Mapa de RFs inferidos do PROCESSO/ESTRUTURA do **GestãoFrota Multi-Franquia**:
> **RF-01** Autenticação multi-franquia com papéis/permissões · **RF-02** Isolamento de dados por franquia (admin central vê as 8) · **RF-03** Cadastro/gestão de veículos · **RF-04** Atribuição e histórico de posse do veículo · **RF-05** Regras de manutenção por km OU tempo ("o que vencer primeiro") · **RF-06** Registro de manutenções (serviço, custo, fornecedor, nota) · **RF-07** Registro de abastecimentos (valor, km, recibo) · **RF-08** OCR de fotos/notas via IA · **RF-09** Catálogo de itens com durabilidade do fabricante · **RF-10** Estoque por franquia com mínimo e entradas/retiradas · **RF-11** Retirada de peça vinculada a veículo abatendo saldo · **RF-12** Solicitações de reembolso/compra · **RF-13** Alertas automáticos (manutenção próxima, estoque baixo, item vencendo) · **RF-14** Registro via WhatsApp (foto do recibo) como canal secundário · **RF-15** Relatórios/insights de custo por franquia/veículo/período via IA.

**RS-01:** O login deve autenticar via Supabase Auth (email+senha e magic link) e, após autenticar, exigir um registro correspondente em `profiles` com `franchise_id` e `role`; usuário sem perfil ativo (`is_active=false`) deve ter acesso negado.
Rastreia: RF-01

**RS-02:** Toda consulta a `vehicles`, `fuel_records`, `maintenance_records`, `inventory_*`, `reimbursement_requests` e `alerts` deve retornar apenas linhas com `franchise_id = current_franchise_id()`, exceto quando `current_role() = 'central_admin'`, que retorna todas as 8 franquias.
Rastreia: RF-02

**RS-03:** O cadastro de veículo deve rejeitar `plate` duplicada (constraint unique `uq_vehicles_plate`) e exigir `franchise_id` e `vehicle_type ∈ {car, motorcycle}`; INSERT/UPDATE permitido apenas a `franchise_manager` da franquia ou `central_admin`.
Rastreia: RF-03

**RS-04:** A Edge Function `assign-vehicle` deve, em transação, fechar o `vehicle_assignments` aberto (`ended_at = now()`), abrir um novo com `agent_id` informado e atualizar `vehicles.current_assignee_id`, garantindo no máximo um assignment aberto por veículo.
Rastreia: RF-04

**RS-05:** A RPC `recalculate_maintenance_due(vehicle_id)` deve calcular `next_due_at` (por `interval_months`) e `next_due_odometer_km` (por `interval_km`) e o alerta deve disparar quando **qualquer um** dos dois limites for atingido primeiro; regras com ambos os intervalos nulos devem ser rejeitadas na gravação.
Rastreia: RF-05

**RS-06:** A RPC `register_maintenance_record` deve rejeitar `cost` nulo/negativo e `service_description` vazio, e ao persistir deve atualizar `maintenance_rules.last_done_at`/`last_done_odometer_km` e chamar `recalculate_maintenance_due`.
Rastreia: RF-06

**RS-07:** A RPC `register_fuel_record` deve exigir `cost > 0` e `odometer_km`, rejeitar `odometer_km` menor que `vehicles.current_odometer_km` atual e, ao persistir, atualizar o odômetro do veículo e recalcular as regras por km.
Rastreia: RF-07

**RS-08:** A Edge Function `ocr-receipt` deve chamar a API de IA multimodal para extrair valor, data, km, fornecedor e litros do arquivo em Storage, gravar os campos no registro alvo e setar `ocr_status ∈ {parsed, failed}`; em falha deve manter o registro editável manualmente e não travar o fluxo.
Rastreia: RF-08

**RS-09:** O cadastro em `inventory_item_types` deve permitir INSERT/UPDATE apenas a `central_admin` e aceitar `durability_months` e/ou `durability_km` para expressar a durabilidade do fabricante (ex.: 3 meses).
Rastreia: RF-09

**RS-10:** A RPC `register_inventory_entry` deve somar `quantity` ao `inventory_stock.quantity_on_hand` da dupla (`franchise_id`,`item_type_id`) e calcular `expires_at = purchased_at + durability_months`; `inventory_stock` deve respeitar a unique `uq_stock_franchise_item`.
Rastreia: RF-10

**RS-11:** A RPC `withdraw_inventory_item` deve rejeitar retirada quando `quantity > quantity_on_hand`, exigir `vehicle_id` válido da mesma franquia e, ao confirmar, abater o saldo e inserir `inventory_withdrawals`.
Rastreia: RF-11

**RS-12:** A criação de `reimbursement_requests` deve permitir INSERT a `purchasing`/`franchise_manager`, iniciar com `status='open'` e permitir transição para `approved`/`rejected`/`purchased` apenas por `franchise_manager` ou `central_admin`.
Rastreia: RF-12

**RS-13:** Os cron jobs `cron_check_maintenance_due`, `cron_check_stock_low` e `cron_check_item_expiring` devem rodar diariamente e inserir `alerts` com `alert_type` correto e `target_profile_id` definido, sem duplicar alerta ainda `pending`/`sent` para o mesmo gatilho; `cron_check_stock_low` deve abrir `reimbursement_requests` vinculada.
Rastreia: RF-13

**RS-14:** A Edge Function `whatsapp-webhook` deve casar `from_phone_e164` com `profiles.phone_e164`, salvar a mídia no Storage, inserir em `whatsapp_inbound` (`parse_status='received'`) e acionar `ocr-receipt`; mensagens de telefone não cadastrado devem ser registradas com `matched_profile_id=null` e não gerar registro.
Rastreia: RF-14

**RS-15:** A Edge Function `generate-cost-report` deve aceitar filtros de franquia, veículo e período, respeitar o escopo do solicitante (gestor só a própria franquia) e retornar insights de custo de combustível e manutenção usando IA sobre os dados agregados.
Rastreia: RF-15

**RS-16:** A Edge Function `send-alert` deve enviar o alerta pelo `channel` (`whatsapp` via Evolution, `email` via Resend, ou `app`) e marcar `status='sent'`; `cron_dispatch_alerts` deve executá-la a cada 15 min apenas sobre alertas `pending`.
Rastreia: RF-13

**RS-17:** As tabelas `whatsapp_inbound` e INSERT em `alerts` devem ser acessíveis **apenas via service role** (Edge Functions/cron); qualquer tentativa de acesso direto pelo frontend deve ser bloqueada por RLS.
Rastreia: RF-13, RF-14

## 2. Arquitetura

Sistema em três camadas, com toda lógica sensível no backend Supabase e o frontend consumindo apenas Edge Functions e RPCs.

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND — Lovable (React + Tailwind + shadcn/ui)           │
│  /login /dashboard /vehicles /fuel /maintenance /inventory   │
│  /reimbursements /alerts /reports /franchises /users         │
│  (app no celular do agente + painel do gestor/admin)         │
└───────────────┬─────────────────────────────────────────────┘
                │ supabase-js (Auth JWT, RLS aplicado)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND — SUPABASE                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL+RLS│  │ Auth(email/   │  │ Storage          │  │
│  │ 14 tabelas    │  │ magic link)   │  │ receipts/invoices│  │
│  └───────┬───────┘  └───────────────┘  └──────────────────┘  │
│  ┌───────▼─────────────────────────────────────────────────┐ │
│  │ RPCs: register_fuel/maintenance, withdraw_inventory,     │ │
│  │ register_inventory_entry, recalculate_maintenance_due    │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Edge Functions (Deno): ocr-receipt, whatsapp-webhook,    │ │
│  │ whatsapp-link-record, send-alert, generate-cost-report,  │ │
│  │ assign-vehicle                                           │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ pg_cron: maintenance_due, stock_low, item_expiring,      │ │
│  │ dispatch_alerts                                          │ │
│  └───────┬──────────────┬───────────────┬───────────────────┘ │
└──────────┼──────────────┼───────────────┼─────────────────────┘
           ▼              ▼               ▼
   ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐
   │ IA Gemini2.5 │ │ Evolution   │ │ Resend (email) + │
   │ Pro/Sonnet4.6│ │ API WhatsApp│ │ Make (reembolsos)│
   │ OCR+relatório│ │ in/out      │ │                  │
   └──────────────┘ └─────────────┘ └──────────────────┘
```

**Fluxo-chave (abastecimento via WhatsApp):** agente envia foto → `whatsapp-webhook` casa telefone, salva mídia, insere em `whatsapp_inbound` → `ocr-receipt` extrai dados → `whatsapp-link-record` cria `fuel_records` → `register_fuel_record` atualiza odômetro e recalcula manutenção → cron detecta vencimento próximo e `send-alert` notifica.

## 3. Stack tecnológica

**Backend — Supabase (não negociável):** PostgreSQL gerenciado com RLS em todas as 14 tabelas; Auth (email+senha e magic link); Storage para recibos e notas fiscais (`receipts`, `invoices`); Edge Functions (Deno) para OCR, webhook de WhatsApp, envio de alertas e relatórios de IA; Realtime para refletir alertas e níveis de estoque no painel sem refresh; pg_cron para as varreduras diárias de manutenção/estoque/validade e o despacho de alertas a cada 15 min.

**Frontend — Lovable + Supabase (caminho escolhido).** O dossiê descreve uma rede de 8 franquias com +50 colaboradores cujos controles hoje vivem em **"planilhas e WhatsApp, mas é muito falho... nem sempre é feito por todos"**, sem qualquer sinalização de time de TI. Para esse perfil **leigo/sem time técnico**, Lovable é o caminho mais rápido do zero ao app no ar e mantém o sistema sem depender de desenvolvedores: gera **React + Tailwind + shadcn/ui** com integração nativa ao Supabase e deploy com preview. O Lovable monta as páginas e consome exclusivamente as RPCs e Edge Functions — nenhuma regra de negócio vive no frontend. Na dúvida, Lovable; aqui o perfil confirma a escolha.

**Modelos de IA:**
- **OCR de recibos/notas** → **Google Gemini 2.5 Pro** (multimodal nativo, contexto longo, ~US$1.25/Mtok in) em `ocr-receipt` — melhor custo para leitura de imagem em alto volume de registros das 8 unidades.
- **Relatórios/insights de custo** → **Claude Sonnet 4.6** (~US$3/Mtok in, US$15/Mtok out) em `generate-cost-report` — equilíbrio qualidade/custo para análise tabular recorrente.

**Integrações (via Edge Functions):** Evolution API (WhatsApp in/out, Cloud ~R$50/mês), Resend (email de alertas, Free 100/dia cobre o volume), Make (ponte opcional dos formulários de reembolso existentes para `reimbursement_requests`).

**Custo mensal estimado (início):** Lovable Pro R$95 + Supabase Pro R$125 + Evolution Cloud ~R$50 + Resend Free + IA sob uso (dezenas de dólares conforme volume de OCR/relatórios) ≈ **R$270/mês** fixo + uso de IA.

## 4. Segurança

**Autenticação:** Supabase Auth com email+senha (padrão para +50 colaboradores) e magic link para entrada simples no celular. Todo usuário tem registro em `profiles` com `franchise_id` e `role ∈ {central_admin, franchise_manager, agent, purchasing}`. Helpers `SECURITY DEFINER` `current_franchise_id()` e `current_role()` alimentam todas as políticas.

**RLS por tabela (habilitado em todas):**
- `franchises` / `inventory_item_types`: SELECT amplo (catálogo da rede); mutação só `central_admin`.
- `vehicles`, `maintenance_rules`, `vehicle_assignments`: SELECT por franquia/admin; mutação por `franchise_manager`/`central_admin`.
- `fuel_records`, `maintenance_records`: SELECT por franquia/admin; INSERT por `agent`/gestor/admin da franquia; UPDATE/DELETE por autor ou gestor/admin.
- `inventory_stock`, `inventory_entries`, `inventory_withdrawals`: SELECT por franquia/admin; mutação via RPC que valida saldo/escopo.
- `reimbursement_requests`: INSERT por `purchasing`/gestor; aprovação só gestor/admin.
- `alerts`: SELECT por destinatário/gestor/admin; **INSERT só service role**.
- `whatsapp_inbound`: **SELECT/INSERT/UPDATE só service role** — frontend sem acesso.
- **Storage** (`receipts`, `invoices`): políticas por path `franchise_id/...`, leitura/escrita restrita a membros da mesma franquia.

**Dados sensíveis / LGPD:** os dados pessoais tratados são nome, telefone (`phone_e164`, para casar WhatsApp) e vínculo de franquia — minimização aplicada (não armazenamos documentos pessoais). Fotos de recibos/notas ficam em buckets privados com acesso por path de franquia. Base de legitimidade = execução de gestão operacional da rede; exclusão de colaborador faz `is_active=false` preservando o histórico de custos (integridade). O `raw_payload` de WhatsApp deve ter retenção limitada (expurgo via cron após processamento).

**Segredos e API keys:** chaves de Gemini, Claude, Evolution API e Resend ficam **exclusivamente em variáveis de ambiente das Edge Functions** (Supabase secrets), nunca no código do Lovable nem no cliente. O frontend só usa a `anon key` (protegida por RLS); a `service_role key` jamais é exposta ao navegador. Webhook do WhatsApp deve validar assinatura/token antes de processar.

## 5. Performance

**Carga esperada (ancorada no dossiê):** 8 franquias, +50 colaboradores, dezenas de veículos. O volume diário realista é de **dezenas a poucas centenas de registros** (abastecimentos, manutenções, retiradas) — carga baixa para Postgres. O gargalo não é concorrência de escrita, mas as chamadas de IA (OCR) e os jobs de varredura.

**Índices críticos (já previstos na ESTRUTURA):**
- `idx_rules_next_due_at` e `idx_rules_next_due_km` → varredura rápida de manutenção vencendo (`cron_check_maintenance_due`).
- `idx_stock_franchise_id` + unique `uq_stock_franchise_item` → checagem de estoque baixo e upsert de saldo sem full scan.
- `idx_entries_expires_at` → `cron_check_item_expiring` filtra validades próximas direto no índice.
- `idx_alerts_status` → `cron_dispatch_alerts` pega só os `pending`.
- `idx_profiles_phone_e164` → casamento O(log n) do remetente do WhatsApp.
- `idx_fuel_fueled_at` / `idx_maint_performed_at` → relatórios de custo por período.

**Limites conhecidos e mitigações:**
- **Timeout de Edge Function (~60s):** `ocr-receipt` processa **uma mídia por invocação** (dispensa lote); relatórios pesados em `generate-cost-report` devem pré-agregar via SQL e enviar à IA apenas o resumo tabular, não linhas cruas, evitando estouro de contexto e de tempo.
- **Tamanho de payload / upload:** fotos de recibo vão direto ao Storage (signed upload), e só o `storage_path` trafega às funções — nunca a imagem no corpo JSON.
- **Free tier do Supabase** (500MB, 500K edge invocations) basta para o piloto; com o uso real de OCR e crons a cada 15 min, recomenda-se **Supabase Pro (R$125/mês)** para folga de invocações e storage de notas.
- **Realtime** usado só no painel de alertas/estoque (poucos canais), sem risco de saturação.
- **Idempotência:** crons de alerta não duplicam alerta `pending`/`sent` para o mesmo gatilho (RS-13), evitando spam de WhatsApp/email aos agentes.
