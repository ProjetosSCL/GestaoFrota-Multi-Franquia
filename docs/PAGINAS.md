# Páginas do Frontend — GestãoFrota Multi-Franquia

> Frontend gerado pelo **Lovable (React + Tailwind + shadcn/ui)** com integração nativa ao **Supabase**. Toda a lógica pesada (OCR de recibos, cálculo de vencimento de manutenção, alertas, relatórios de IA, webhook de WhatsApp) roda em **Supabase Edge Functions + pg_cron**; as páginas apenas consomem essas funções e aplicam RLS por franquia/papel.
>
> **Papéis (do PROCESSO):** `central_admin` (Administrador Central — vê as 8 franquias), `franchise_manager` (Gestor da Franquia — vê só a própria unidade), `agent` (Agente/Colaborador — motorista/operador), `purchasing` (Responsável por Compras/Reembolso).
>
> **Convenção global de estados:** salvo observação específica, toda página mostra um *skeleton loader* enquanto carrega, um *empty state* ilustrado com CTA quando não há dados, e um *banner/toast de erro* com botão "Tentar novamente" em caso de falha de rede ou RLS.

---

### /login

**Rota:** `/login`

**Propósito:** autenticar os mais de 50 colaboradores das 8 franquias para dar acesso ao sistema conforme seu papel.

**Seções da tela:**
- Logotipo e nome "GestãoFrota" centralizados.
- Formulário de login por **email + senha**.
- Botão "Entrar com link mágico" (magic link) — pensado para acesso rápido pelo celular do agente.
- Link "Esqueci minha senha".
- Rodapé com versão do sistema.

**Estados:**
- *Vazio:* formulário limpo pronto para preenchimento.
- *Carregando:* botão "Entrar" com spinner e campos desabilitados durante a autenticação.
- *Erro:* mensagem clara abaixo do formulário ("Email ou senha inválidos" / "Link mágico expirado, solicite outro").

**Permissões:** pública (não autenticada). Após login, o sistema redireciona para `/dashboard` de acordo com o `role` do `profiles`.

---

### /dashboard

**Rota:** `/dashboard`

**Propósito:** oferecer o painel inicial com KPIs e alertas, consolidado para o admin e restrito à unidade para gestor/agente.

**Seções da tela:**
- Cards de KPI: custo de combustível no período, custo de manutenção, nº de veículos ativos, nº de alertas abertos.
- Bloco "Manutenções próximas do vencimento" (veículos perto do limite de km/tempo).
- Bloco "Estoque abaixo do mínimo" (itens que precisam reposição).
- Mini-gráfico de custo por franquia (admin) ou por veículo (gestor/agente).
- Lista de últimos registros (abastecimentos/manutenções recentes).

**Estados:**
- *Vazio:* mensagem "Ainda não há registros nesta unidade" com atalhos para `/fuel/new` e `/vehicles`.
- *Carregando:* skeletons nos cards e gráficos.
- *Erro:* card de erro com "Tentar novamente".

**Permissões:** todos os papéis autenticados.
- `central_admin`: visão consolidada das **8 franquias** com seletor de franquia e gráfico comparativo entre unidades.
- `franchise_manager`: KPIs e alertas **apenas da própria unidade**.
- `agent`: visão enxuta focada nos **veículos sob sua responsabilidade** e seus lembretes de manutenção.
- `purchasing`: destaque para estoque baixo e solicitações de reembolso pendentes.

---

### /vehicles

**Rota:** `/vehicles`

**Propósito:** listar os veículos da frota com km atual e quem está de posse de cada um.

**Seções da tela:**
- Barra de busca/filtros (por placa, tipo carro/moto, franquia — para admin, agente responsável, status de manutenção).
- Tabela/cards de veículos: placa, modelo/ano, tipo, km atual, agente de posse, badge de "manutenção próxima" quando aplicável.
- Botão "Novo veículo" (admin/gestor).

**Estados:**
- *Vazio:* "Nenhum veículo cadastrado nesta franquia" com CTA "Cadastrar veículo" (admin/gestor).
- *Carregando:* skeleton de linhas da tabela.
- *Erro:* banner de erro com retry.

**Permissões:**
- `central_admin`: vê veículos de **todas as franquias** + filtro por franquia; pode cadastrar/editar.
- `franchise_manager`: vê e gerencia veículos **da própria unidade**.
- `agent`: vê veículos da unidade com destaque para os sob sua posse; sem botão de cadastro.
- `purchasing`: acesso de leitura (contexto para compras), sem edição.

---

### /vehicles/:id

**Rota:** `/vehicles/:id`

**Propósito:** exibir o detalhe completo de um veículo com histórico, regras e previsão da próxima manutenção.

**Seções da tela:**
- Cabeçalho: placa, modelo, tipo, km atual, agente de posse atual.
- Bloco "Próxima manutenção": regra(s) ativa(s), próxima troca por km e por tempo (o que vencer primeiro), com destaque visual se estiver próxima.
- Timeline "Histórico de manutenções" (serviço, custo, fornecedor, data, nota anexada).
- Lista "Abastecimentos" (valor, litros, km, data, recibo).
- Histórico de posse (vehicle_assignments) — quem esteve com o veículo e quando.
- Botões: "Atribuir agente" (→ `/vehicles/:id/assign`), "Registrar abastecimento", "Registrar manutenção".

**Estados:**
- *Vazio:* seções sem histórico mostram "Nenhum registro ainda" com CTA para o respectivo formulário.
- *Carregando:* skeleton por bloco.
- *Erro:* se o veículo não existir ou não pertencer à franquia do usuário (RLS), mostra "Veículo não encontrado ou sem acesso".

**Permissões:**
- `central_admin` / `franchise_manager`: detalhe completo + botões de atribuição e edição.
- `agent`: vê o detalhe e pode registrar abastecimento/manutenção/retirada; **sem** botão de atribuir agente.
- `purchasing`: leitura.

---

### /vehicles/:id/assign

**Rota:** `/vehicles/:id/assign`

**Propósito:** permitir ao gestor atribuir ou transferir a posse de um veículo a um agente (chama `assign-vehicle`).

**Seções da tela:**
- Identificação do veículo (placa/modelo) e agente atual de posse.
- Select de agente da franquia (lista filtrada de `profiles` com role `agent`).
- Campo de observação/data de início.
- Resumo "O que acontece": fecha a posse anterior e abre a nova.
- Botão "Confirmar atribuição".

**Estados:**
- *Vazio:* se não houver agentes ativos na franquia, mensagem "Cadastre colaboradores em /users antes de atribuir".
- *Carregando:* botão com spinner enquanto `assign-vehicle` executa.
- *Erro:* toast "Não foi possível atribuir o veículo" com retry.

**Permissões:** apenas `franchise_manager` (da própria unidade) e `central_admin`. `agent` e `purchasing` **não acessam** (redirecionados com aviso de permissão).

---

### /fuel/new

**Rota:** `/fuel/new`

**Propósito:** registrar um abastecimento com valor, km e foto do recibo, disparando o OCR da IA.

**Seções da tela:**
- Select de veículo (os sob posse do agente aparecem primeiro).
- Campo de upload/câmera da foto do recibo (otimizado para celular).
- Campos: valor, litros, quilometragem atual, data.
- Indicador "IA está lendo o recibo…" após o upload (status de `ocr-receipt`), com preenchimento automático dos campos extraídos para conferência.
- Botão "Salvar abastecimento" (chama `register_fuel_record`).

**Estados:**
- *Vazio:* formulário limpo; campos de IA só aparecem após anexar o recibo.
- *Carregando:* badge "Processando recibo…" enquanto OCR roda; botão salvar com spinner.
- *Erro:* se o OCR falhar, aviso "Não conseguimos ler o recibo — preencha manualmente" (não bloqueia o salvamento); erro de gravação mostra toast com retry.

**Permissões:** `agent`, `franchise_manager`, `central_admin` (dentro da franquia). `purchasing` não registra abastecimento.

---

### /maintenance/new

**Rota:** `/maintenance/new`

**Propósito:** registrar uma manutenção realizada com serviço, custo, fornecedor e nota fiscal.

**Seções da tela:**
- Select de veículo e select opcional da regra de manutenção associada (ex: "Troca de óleo").
- Campo de upload/câmera da nota fiscal (dispara `ocr-receipt`).
- Campos: descrição do serviço, custo, fornecedor, quilometragem, data.
- Campos auto-preenchidos pela IA para conferência.
- Botão "Salvar manutenção" (chama `register_maintenance_record`, que recalcula a próxima troca).

**Estados:**
- *Vazio:* formulário limpo.
- *Carregando:* "Lendo nota fiscal…" + spinner no salvar.
- *Erro:* OCR falho → preenchimento manual; falha de gravação → toast com retry.

**Permissões:** `agent`, `franchise_manager`, `central_admin` (dentro da franquia). `purchasing` não registra manutenção.

---

### /maintenance-rules

**Rota:** `/maintenance-rules`

**Propósito:** gerir as regras de manutenção por veículo (troca a cada X km OU Y meses, o que vencer primeiro).

**Seções da tela:**
- Filtro por veículo/franquia.
- Tabela de regras: veículo, rótulo (ex: "Troca de óleo"), intervalo por km, intervalo por meses, última execução, próxima prevista.
- Formulário/modal "Nova regra" com campos de intervalo por km e/ou por tempo.
- Botão editar/desativar regra.

**Estados:**
- *Vazio:* "Nenhuma regra cadastrada" com CTA "Criar primeira regra".
- *Carregando:* skeleton da tabela.
- *Erro:* banner com retry.

**Permissões:**
- `central_admin`: cria/edita regras de **toda a rede**.
- `franchise_manager`: cria/edita regras da **própria unidade**.
- `agent` / `purchasing`: sem acesso (ocultos no menu).

---

### /inventory

**Rota:** `/inventory`

**Propósito:** mostrar o estoque de peças da franquia por item, com nível atual, mínimo e validade/durabilidade.

**Seções da tela:**
- Filtro por categoria (pneu de carro, pneu de moto, óleo, kit de transmissão) e por franquia (admin).
- Tabela/cards: item, quantidade em mãos, quantidade mínima, badge "estoque baixo" quando abaixo do mínimo, próxima validade (de `inventory_entries.expires_at`).
- Atalhos "Dar entrada" (→ `/inventory/entry`) e "Registrar retirada" (→ `/inventory/withdraw`).

**Estados:**
- *Vazio:* "Nenhum item em estoque" com CTA "Dar entrada de compra".
- *Carregando:* skeleton de cards.
- *Erro:* banner com retry.

**Permissões:**
- `central_admin`: estoque de **todas as franquias** com seletor.
- `franchise_manager` / `purchasing`: estoque da **própria unidade** com ações de entrada e ajuste.
- `agent`: leitura do estoque da unidade + botão de retirada.

---

### /inventory/entry

**Rota:** `/inventory/entry`

**Propósito:** dar entrada de compra de itens no estoque, com quantidade, fornecedor e custo (chama `register_inventory_entry`).

**Seções da tela:**
- Select de item do catálogo (`inventory_item_types`).
- Campos: quantidade, custo unitário, fornecedor, data da compra.
- Vínculo opcional a uma solicitação de reembolso (`reimbursement_id`).
- Prévia "Validade calculada" a partir da durabilidade do fabricante.
- Botão "Registrar entrada" (soma ao estoque e calcula `expires_at`).

**Estados:**
- *Vazio:* se o catálogo estiver vazio, aviso "Nenhum item cadastrado — peça ao admin em /inventory/item-types".
- *Carregando:* spinner no botão.
- *Erro:* toast com retry.

**Permissões:** `purchasing`, `franchise_manager`, `central_admin` (dentro da franquia). `agent` sem acesso.

---

### /inventory/withdraw

**Rota:** `/inventory/withdraw`

**Propósito:** registrar a retirada de uma peça do estoque vinculada a um veículo, abatendo a quantidade.

**Seções da tela:**
- Select de item (mostra saldo disponível).
- Select de veículo ao qual a peça será aplicada.
- Campo de quantidade.
- Aviso de saldo insuficiente em tempo real.
- Botão "Registrar retirada" (chama `withdraw_inventory_item`, que valida saldo).

**Estados:**
- *Vazio:* se não houver saldo de nenhum item, mensagem "Sem itens disponíveis para retirada".
- *Carregando:* spinner no botão.
- *Erro:* se o saldo for insuficiente, bloqueio com mensagem "Quantidade indisponível"; falha genérica → toast com retry.

**Permissões:** `agent` e `franchise_manager` (dentro da franquia); `central_admin`. `purchasing` sem acesso a retirada (foco em entradas).

---

### /inventory/item-types

**Rota:** `/inventory/item-types`

**Propósito:** manter o catálogo padrão da rede (pneu de carro, pneu de moto, óleo, kit de transmissão) com durabilidade do fabricante.

**Seções da tela:**
- Tabela de itens: nome, categoria, durabilidade em meses, durabilidade em km.
- Formulário/modal "Novo item" com os campos de durabilidade (ex: "este item dura 3 meses").
- Botão editar item.

**Estados:**
- *Vazio:* "Nenhum item no catálogo" com CTA "Cadastrar primeiro item".
- *Carregando:* skeleton da tabela.
- *Erro:* banner com retry.

**Permissões:** **apenas `central_admin`** (catálogo é padrão da rede). Demais papéis não veem esta página no menu.

---

### /reimbursements

**Rota:** `/reimbursements`

**Propósito:** gerir as solicitações de dinheiro/reembolso que originam as compras de estoque, mantendo o fluxo já usado hoje em formulários.

**Seções da tela:**
- Filtro por status (aberta, aprovada, rejeitada, comprada) e por franquia (admin).
- Lista de solicitações: item, valor solicitado, justificativa, origem (manual ou disparada por alerta de estoque baixo), solicitante, status.
- Botão "Nova solicitação".
- Ações de aprovação/rejeição (conforme alçada).

**Estados:**
- *Vazio:* "Nenhuma solicitação de reembolso" com CTA "Criar solicitação".
- *Carregando:* skeleton da lista.
- *Erro:* banner com retry.

**Permissões:**
- `purchasing` / `franchise_manager`: criam solicitações.
- `franchise_manager` / `central_admin`: aprovam/rejeitam (alçada assumida no PROCESSO).
- `central_admin`: vê solicitações de todas as franquias.
- `agent`: sem acesso.

---

### /alerts

**Rota:** `/alerts`

**Propósito:** centralizar os alertas de manutenção próxima, estoque baixo e itens vencendo gerados automaticamente.

**Seções da tela:**
- Abas/filtros por tipo: manutenção a vencer, estoque baixo, item vencendo.
- Lista de alertas: mensagem, veículo/item relacionado, data, canal (app/WhatsApp/email), status (pendente/enviado/resolvido).
- Ação "Marcar como resolvido".
- Atalho para a ação relacionada (ex: abrir o veículo ou abrir solicitação de reposição).

**Estados:**
- *Vazio:* "Nenhum alerta no momento — tudo em dia 🎉".
- *Carregando:* skeleton da lista.
- *Erro:* banner com retry.

**Permissões:**
- `agent`: vê alertas direcionados a si (`target_profile_id`) — ex: manutenção dos seus veículos.
- `franchise_manager`: vê todos os alertas da **própria unidade**.
- `purchasing`: foco em alertas de estoque baixo/itens vencendo da unidade.
- `central_admin`: vê alertas de **todas as franquias**.

---

### /reports

**Rota:** `/reports`

**Propósito:** gerar relatórios e insights de custo de combustível e manutenção por franquia, veículo e período com apoio de IA (chama `generate-cost-report`).

**Seções da tela:**
- Filtros: período, franquia (admin), veículo, tipo de custo (combustível/manutenção).
- Gráficos de custo ao longo do tempo e comparativo entre franquias/veículos.
- Bloco "Insights da IA" com texto analítico gerado (tendências, outliers, recomendações).
- Botão "Gerar relatório" e "Exportar".

**Estados:**
- *Vazio:* "Selecione um período e clique em Gerar relatório".
- *Carregando:* indicador "IA analisando os custos…" enquanto a Edge Function roda.
- *Erro:* "Não foi possível gerar o relatório" com retry.

**Permissões:**
- `central_admin`: relatórios **consolidados das 8 franquias** e comparativos entre unidades.
- `franchise_manager`: relatórios da **própria unidade**.
- `agent` / `purchasing`: sem acesso (ou acesso limitado só à própria unidade, se habilitado pelo gestor).

---

### /franchises

**Rota:** `/franchises`

**Propósito:** gerir o cadastro das 8 franquias da rede.

**Seções da tela:**
- Tabela das unidades: nome, UF (CE/MG/PB/RN), cidade, status ativo/inativo.
- Formulário/modal "Nova franquia" e edição.
- Indicadores rápidos por unidade (nº de veículos, nº de colaboradores).

**Estados:**
- *Vazio:* improvável (8 franquias pré-cadastradas); se vazio, CTA "Cadastrar franquia".
- *Carregando:* skeleton da tabela.
- *Erro:* banner com retry.

**Permissões:** **apenas `central_admin`**. Demais papéis não veem esta página.

---

### /users

**Rota:** `/users`

**Propósito:** gerir colaboradores e permissões, vinculando cada usuário a uma franquia e a um papel.

**Seções da tela:**
- Filtro por franquia (admin) e por papel.
- Tabela de colaboradores: nome, email, telefone (E.164, para casar com o WhatsApp), franquia, papel, status.
- Formulário "Convidar/criar colaborador" com seleção de papel (`agent`, `franchise_manager`, `purchasing`, `central_admin`).
- Ações: editar papel, ativar/desativar.

**Estados:**
- *Vazio:* "Nenhum colaborador cadastrado" com CTA "Convidar colaborador".
- *Carregando:* skeleton da tabela.
- *Erro:* banner com retry.

**Permissões:**
- `central_admin`: gerencia colaboradores de **todas as franquias** e define gestores.
- `franchise_manager`: gerencia colaboradores da **própria unidade** (não pode criar `central_admin`).
- `agent` / `purchasing`: sem acesso.

---

### /settings

**Rota:** `/settings`

**Propósito:** permitir ao usuário editar seu perfil, telefone (para casar o remetente do WhatsApp) e preferências de notificação.

**Seções da tela:**
- Dados do perfil: nome completo, email (somente leitura), telefone em formato E.164.
- Preferências de notificação: canais de alerta (app, WhatsApp, email) ligados/desligados.
- Troca de senha.
- Identificação da franquia e papel atuais (somente leitura).

**Estados:**
- *Vazio:* não se aplica (sempre há perfil do usuário logado).
- *Carregando:* skeleton do formulário.
- *Erro:* toast ao salvar com retry; aviso se o telefone informado não estiver em formato válido para o WhatsApp.

**Permissões:** todos os papéis autenticados editam o **próprio** perfil. Nenhum papel edita o perfil de outro usuário por esta página (isso é feito em `/users`).
