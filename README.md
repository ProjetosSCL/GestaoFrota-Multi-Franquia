# GestãoFrota Multi-Franquia — README

> Pacote de documentação canônico do **GestãoFrota Multi-Franquia**. Este é o **primeiro arquivo** que você (ou a IDE — Lovable ou Claude Code) deve ler antes de tocar em qualquer linha de código ou criar qualquer tabela. Ele orquestra todos os demais documentos do pacote.

---

## Sobre o projeto

O **GestãoFrota Multi-Franquia** é o sistema que centraliza a gestão de frota, combustível, manutenções e estoque de peças de uma rede com **8 franquias** (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau e RN - Parelhas) e **mais de 50 colaboradores**. Hoje esses controles vivem em **planilhas e WhatsApp** — algo que o próprio usuário descreveu como "muito falho, nem sempre é feito por todos". O GestãoFrota Multi-Franquia resolve isso dando a cada unidade um sistema único para cadastrar veículos (carros e motos), saber **qual agente está de posse de cada veículo**, registrar abastecimentos e manutenções (com custo, fornecedor e nota fiscal), controlar o **estoque de peças** (pneu de carro, pneu de moto, óleo, kit de transmissão) com noção de **vida útil por km OU por tempo** ("o item dura 3 meses pelo fabricante"), e usar **IA** para prever vencimentos de manutenção, ler recibos/notas por OCR e gerar relatórios de custo por franquia. O backend é **Supabase** (PostgreSQL com RLS por franquia, Auth, Storage, Edge Functions e Cron Jobs) e o app roda no celular dos agentes, com **WhatsApp como segunda forma de registro** (enviar foto do recibo e o sistema processa).

---

## Antes de tudo

> ⚠️ **LEIA O `SKILL.md` ANTES DE ESCREVER QUALQUER CÓDIGO.**
>
> O `SKILL.md` é o **guia operacional** de como construir este sistema específico — ele explica a ordem de construção, as convenções de nomenclatura, como aplicar o RLS por franquia via `current_franchise_id()` / `current_role()`, como estruturar as Edge Functions (OCR, alertas, relatórios), como ligar o webhook do WhatsApp e quais decisões já estão fechadas. **Não improvise**: cada tabela, function e página já tem nome e responsabilidade definidos nos documentos. Pular o `SKILL.md` leva a retrabalho e a nomes divergentes da `ESTRUTURA.md`.

---

## Mapa de arquivos

| Arquivo | O que contém | Quando consultar |
|---|---|---|
| **`SKILL.md`** | Guia operacional: ordem de construção, convenções, regras de RLS, padrões das Edge Functions, decisões já fechadas. | **PRIMEIRO, sempre.** Antes de qualquer código. |
| **`docs/PROCESSO.md`** | O processo de negócio real das 8 franquias: fluxos de abastecimento, manutenção, retirada de estoque, reembolso, papéis e permissões. | Para entender *por que* cada regra existe, antes de modelar qualquer tela ou function. |
| **`docs/ESTRUTURA.md`** | Fonte canônica de **nomes**: tabelas, RPCs, Edge Functions e rotas. Nada pode divergir dela. | Sempre que for nomear uma tabela, função, endpoint ou página. |
| **`docs/PRD.md`** | Visão de produto: contexto, objetivos, personas (admin central, gestor, agente, compras), escopo e não-escopo. | No início, para alinhar o *o quê* e o *para quem*. |
| **`docs/PRS.md`** | Requisitos de sistema (RF-01 a RF-nn): autenticação multi-franquia, isolamento por franquia, manutenção por km/tempo, OCR, estoque, alertas. | Para saber exatamente *o que* cada parte deve fazer. |
| **`db/schemas.sql`** | Schema completo do Postgres: todas as tabelas, relacionamentos, funções auxiliares e **RLS por franquia**. | Ao configurar o banco — é o **primeiro SQL a rodar** no Supabase. |
| **`docs/PLANO.md`** | Plano de desenvolvimento por fases (Fundação → Frota → Estoque → IA/Automação), com entregáveis e tabelas envolvidas. | Para saber *em que ordem* construir e o que entregar em cada fase. |
| **`docs/FUNCTIONS.md`** | Toda function/endpoint do backend: Edge Functions (Deno), RPCs/triggers Postgres e Cron Jobs (OCR, alertas de vencimento, estoque baixo, relatórios, webhook WhatsApp). | Ao implementar qualquer lógica server-side ou automação. |
| **`docs/PAGINAS.md`** | Todas as páginas do frontend (React + Tailwind + shadcn/ui via Lovable), por papel, e quais functions cada uma consome. | Ao construir a interface e ligar o front às funções. |
| **`docs/DEPARA.md`** | Matriz de rastreabilidade: Tabela → Functions → Páginas. Garante que nada ficou órfão. | Para validar a cobertura e conferir ligações antes de fechar cada fase. |

---

## Primeiros passos no Lovable

> **Por que Lovable?** O GestãoFrota Multi-Franquia será operado por uma rede de franquias **sem time técnico dedicado** (hoje tudo é planilha e WhatsApp). O Lovable é o caminho mais rápido do zero ao app no ar, gera **React + Tailwind + shadcn/ui** com integração nativa ao Supabase e deploy com preview — ideal para que gestores e agentes comecem a usar rápido, mesmo em telas de celular. O backend pesado (OCR, alertas, relatórios de IA, webhook de WhatsApp) fica todo em Edge Functions do Supabase.

1. **Crie o projeto no Lovable** com o nome `GestaoFrota-Multi-Franquia`.
2. **Ative/conecte o Supabase** pelo painel de integrações do Lovable (botão nativo "Connect Supabase"). Autorize o projeto Supabase da sua organização (ou crie um novo). Isso habilita Auth, banco, Storage e Edge Functions.
3. **Rode o schema**: abra o **SQL Editor** do Supabase e execute o conteúdo completo de **`db/schemas.sql`**. Confirme que todas as tabelas (`franchises`, `profiles`, `vehicles`, `vehicle_assignments`, `maintenance_rules`, `maintenance_records`, `fuel_records`, `inventory_item_types`, `inventory_stock`, `inventory_entries`, `inventory_withdrawals`, `reimbursement_requests`, `alerts`) e as funções `current_franchise_id()` / `current_role()` foram criadas, e que **o RLS está ativo** em cada tabela.
4. **Cadastre as 8 franquias** como seed inicial na tabela `franchises` (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau, RN - Parelhas).
5. **Cole o prompt inicial** no Lovable referenciando os documentos, por exemplo:
   > "Leia `SKILL.md` primeiro, depois `docs/PRD.md`, `docs/PRS.md`, `docs/ESTRUTURA.md`, `docs/PAGINAS.md` e `docs/FUNCTIONS.md`. O Supabase já está conectado e `db/schemas.sql` já foi aplicado. Construa a **Fase 1 (Fundação)** do `docs/PLANO.md`: login por email/senha e magic link, layout base (menu lateral, cabeçalho, roteamento por papel `central_admin` / `franchise_manager` / `agent` / `purchasing`) e o isolamento por franquia usando o RLS já existente. Não crie nomes novos — use exatamente os de `docs/ESTRUTURA.md`."
6. **Siga o `docs/PLANO.md` fase a fase**, validando cada entrega contra o `docs/DEPARA.md` antes de avançar.

---

## Primeiros passos no Claude Code

> **Quando usar este caminho:** se a rede tiver (ou contratar) um time de TI que saiba codar, o **Claude Code + Supabase** dá mais flexibilidade e controle do código ao longo do tempo. O backend continua sendo **Supabase**; o time escolhe a stack de frontend sobre ele.

1. **Inicialize o repositório** do `GestaoFrota-Multi-Franquia` e coloque este pacote de documentação na raiz (`SKILL.md`, `docs/`, `db/`).
2. **Instale e configure o Supabase CLI**:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <SEU_PROJECT_REF>
   ```
3. **Configure as credenciais** num `.env` (fora do versionamento): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, além das chaves das integrações descritas em `docs/FUNCTIONS.md` (API de IA para OCR/relatórios, Resend para email, Evolution API para WhatsApp).
4. **Aplique o schema**:
   ```bash
   supabase db execute --file db/schemas.sql
   ```
   Confirme as tabelas, as funções `current_franchise_id()` / `current_role()` e o **RLS ativo** em todas as tabelas. Faça o seed das 8 franquias em `franchises`.
5. **Aponte o Claude Code para ler o `SKILL.md` primeiro**:
   > "Antes de qualquer coisa, leia `SKILL.md` por completo. Em seguida leia `docs/ESTRUTURA.md` (nomes canônicos), `docs/FUNCTIONS.md` e `docs/PLANO.md`. Depois implemente a **Fase 1 (Fundação)**. Não invente nomes de tabela, function ou rota — use exatamente os da `ESTRUTURA.md`, e valide a cobertura pelo `docs/DEPARA.md`."
6. **Desenvolva as Edge Functions (Deno)** e os **Cron Jobs (pg_cron)** conforme `docs/FUNCTIONS.md` — OCR de recibos, alertas de manutenção por km/tempo, alerta de estoque baixo, expiração de itens, relatórios de custo por franquia e o webhook de WhatsApp. Faça o deploy com `supabase functions deploy` e agende os crons no banco.
