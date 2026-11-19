## Fase 1 — Fundação

**Entregável:** O esqueleto do GestãoFrota Multi-Franquia no ar — banco de dados completo com todas as tabelas e RLS rodando no Supabase, login funcionando por email/senha e magic link, e o layout base (menu lateral, cabeçalho, roteamento por papel) que todas as telas vão herdar.

**Tabelas envolvidas:** todas as de `db/schemas.sql` (`franchises`, `profiles`, `vehicles`, `vehicle_assignments`, `maintenance_rules`, `maintenance_records`, `fuel_records`, `inventory_item_types`, `inventory_stock`, `inventory_entries`, `inventory_withdrawals`, `reimbursement_requests`, `alerts`, `whatsapp_inbound`) + funções `current_franchise_id()` e `current_role()`.

**Páginas envolvidas:** `/login`, `/dashboard` (shell), layout base com navegação por papel.

**Functions envolvidas:** helpers `SECURITY DEFINER` `current_franchise_id()` e `current_role()`.

**Checklist:**
- [ ] Criar o projeto no Lovable conectado ao Supabase
- [ ] Rodar `db/schemas.sql` no Supabase (todas as tabelas, índices e FKs)
- [ ] Aplicar RLS por franquia + helpers `current_franchise_id()`/`current_role()`
- [ ] Configurar Supabase Auth (email/senha + magic link) e criação automática de `profiles`
- [ ] Montar layout base (menu lateral, cabeçalho) com navegação condicional por papel
- [ ] Cadastrar as 8 franquias e um usuário `central_admin` de teste

## Fase 2 — Construção

**Entregável:** Todas as funcionalidades reais do processo funcionando — cadastro e atribuição de veículos, registro de abastecimento e manutenção com OCR, controle de estoque (entrada/retirada/reembolso), alertas automáticos e o canal WhatsApp como segunda forma de registro, mais os relatórios de custo por IA.

**Tabelas envolvidas:** `vehicles`, `vehicle_assignments`, `maintenance_rules`, `maintenance_records`, `fuel_records`, `inventory_item_types`, `inventory_stock`, `inventory_entries`, `inventory_withdrawals`, `reimbursement_requests`, `alerts`, `whatsapp_inbound`.

**Páginas envolvidas:** `/vehicles`, `/vehicles/:id`, `/vehicles/:id/assign`, `/fuel/new`, `/maintenance/new`, `/maintenance-rules`, `/inventory`, `/inventory/entry`, `/inventory/withdraw`, `/inventory/item-types`, `/reimbursements`, `/alerts`, `/reports`, `/franchises`, `/users`, `/settings`.

**Functions envolvidas:** RPCs `register_fuel_record`, `register_maintenance_record`, `withdraw_inventory_item`, `register_inventory_entry`, `recalculate_maintenance_due`; Edge Functions `assign-vehicle`, `ocr-receipt`, `whatsapp-webhook`, `whatsapp-link-record`, `send-alert`, `generate-cost-report`; Cron `cron_check_maintenance_due`, `cron_check_stock_low`, `cron_check_item_expiring`, `cron_dispatch_alerts`.

**Checklist:**
- [ ] Veículos: lista, detalhe e atribuição de agente (`vehicles`, `vehicle_assignments`, `assign-vehicle`)
- [ ] Abastecimento e manutenção com upload de recibo + OCR (`register_fuel_record`, `register_maintenance_record`, `ocr-receipt`, `maintenance_rules`)
- [ ] Estoque: catálogo, entrada, retirada vinculada a veículo e reembolsos (`inventory_*`, `reimbursement_requests`)
- [ ] Alertas automáticos por cron (manutenção/estoque/validade) + envio `send-alert`
- [ ] Canal WhatsApp de entrada de recibos (`whatsapp-webhook`, `whatsapp-link-record`, `whatsapp_inbound`)
- [ ] Relatórios de custo por IA e gestão de franquias/usuários (`generate-cost-report`, `/franchises`, `/users`)

## Fase 3 — Polimento e lançamento

**Entregável:** O GestãoFrota pronto para os +50 colaboradores das 8 franquias usarem no dia a dia — telas com estados de vazio/erro/carregando, tudo funcionando bem no celular (onde os agentes vão registrar abastecimentos), automações finais ativas e o app publicado.

**Tabelas envolvidas:** revisão de RLS e índices de todas; foco em `alerts`, `fuel_records`, `maintenance_records` (volume operacional).

**Páginas envolvidas:** todas — foco em responsividade mobile de `/fuel/new`, `/maintenance/new`, `/inventory/withdraw` e `/alerts`.

**Functions envolvidas:** `cron_dispatch_alerts`, `send-alert` (produção), validação final das Edge Functions.

**Checklist:**
- [ ] Adicionar estados de vazio, erro e carregando em todas as páginas
- [ ] Ajustar responsividade mobile das telas de registro (agente usa no celular)
- [ ] Testar fluxo ponta a ponta por papel (admin, gestor, agente, compras)
- [ ] Ativar e validar os cron jobs em produção (alertas disparando de verdade)
- [ ] Revisar RLS: confirmar que cada franquia só vê os próprios dados
- [ ] Publicar o app e cadastrar os colaboradores reais das 8 franquias