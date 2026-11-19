## 1. Contexto

O **GestãoFrota Multi-Franquia** é o sistema de gestão de frota, manutenções e estoque de peças de uma rede com **8 franquias** (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau e RN - Parelhas) e **mais de 50 colaboradores**. Cada unidade opera veículos (carros e motos) que precisam de controle de combustível, manutenção preventiva e peças em estoque (pneu de carro, pneu de moto, óleo, kit de transmissão), além de saber "qual agente está de posse daquele veículo". Hoje esses controles vivem em **planilhas e WhatsApp**, de forma falha e inconsistente — "nem sempre é feito por todos". O app centraliza frota, manutenção, estoque e custos por franquia, usando IA para prever vencimentos, ler recibos/notas fiscais e gerar relatórios de custo.

## 2. Problema

A rede não consegue responder com confiança perguntas básicas de operação: **quem está com cada veículo agora**, **quanto cada franquia gasta com combustível e manutenção**, e **quando vence a próxima troca** (por km ou por tempo). Como o usuário descreveu, o registro atual em "planilhas e WhatsApp" é "muito falho ainda, nem sempre é feito por todos" — ou seja, os dados chegam incompletos, dispersos e sem rastreabilidade. Isso gera manutenções atrasadas (risco e custo maior), compras de peças sem visão de estoque e durabilidade ("tal item dura 3 meses pelo fabricante"), e ausência de uma visão consolidada das 8 unidades. Também não há gatilho automático de reposição quando um item como "pneu de moto" fica baixo, nem um fluxo claro ligando os "formulários de reembolsos e solicitações de dinheiro" às compras de estoque.

## 3. Objetivos

1. **Centralizar 100% dos veículos das 8 franquias** em um único sistema, com km atual, agente de posse e histórico de manutenções rastreável.
2. **Reduzir manutenções vencidas/atrasadas** gerando alertas automáticos antes do limite por km ou por tempo (o que vencer primeiro), com meta de ≥90% das manutenções realizadas antes do vencimento.
3. **Automatizar a entrada de dados** de abastecimento e manutenção via OCR de fotos de recibos/notas (pelo app ou WhatsApp), reduzindo o preenchimento manual que hoje "nem sempre é feito".
4. **Dar visibilidade de custo por franquia, veículo e período** com relatórios/insights gerados por IA.
5. **Garantir estoque saudável de peças**, disparando alerta de reposição e abrindo a solicitação de reembolso automaticamente quando o nível cai abaixo do mínimo.

## 4. Personas

**Carlos — Administrador Central (rede)**
- **Papel:** enxerga as 8 franquias, define regras de manutenção e durabilidade de itens, aprova compras e acompanha relatórios consolidados.
- **Dor:** não tem uma visão única e confiável das unidades; os números chegam de planilhas diferentes e desencontradas.
- **Objetivo:** comparar custo de combustível e manutenção entre franquias e cortar desperdício.
- **Citação:** "Somos oito franquias e temos mais de 50 colaboradores — preciso enxergar tudo num lugar só."

**Marina — Gestora da Franquia**
- **Papel:** gerencia frota, estoque e colaboradores da sua unidade; atribui veículos e aprova retiradas de peças.
- **Dor:** não sabe com certeza quem está com cada veículo nem quando a próxima manutenção vence.
- **Objetivo:** manter a frota da unidade em dia e o estoque abastecido sem surpresas.
- **Citação:** "Preciso saber qual agente está de posse daquele veículo e quando está próximo de uma próxima manutenção."

**João — Agente/Colaborador (motorista/operador)**
- **Papel:** fica de posse dos veículos e registra abastecimentos, manutenções e retiradas de peça.
- **Dor:** registrar tudo em planilha no meio do dia é trabalhoso, então acaba não fazendo.
- **Objetivo:** registrar rápido, de preferência mandando a foto do recibo.
- **Citação:** "É legal ter essas funcionalidades no app, mas podemos acrescentar WhatsApp também como segunda forma."

**Patrícia — Responsável por Compras/Reembolso**
- **Papel:** registra solicitações de dinheiro/reembolso e dá entrada dos itens comprados no estoque.
- **Dor:** as compras partem de formulários de reembolso soltos, sem ligação com o estoque real.
- **Objetivo:** comprar na hora certa e manter o estoque e a validade dos itens atualizados.
- **Citação:** "Isso é a partir de formulários de reembolsos e solicitações de dinheiro."

## 5. Requisitos funcionais

- **RF-01:** O sistema deve permitir que o Administrador Central faça login e visualize o painel consolidado das 8 franquias.
- **RF-02:** O sistema deve permitir que o Administrador Central cadastre e revise cada veículo da rede informando franquia dona, tipo (carro/moto), modelo, ano e km atual.
- **RF-03:** O sistema deve permitir que o Administrador Central/Gestor defina os parâmetros de manutenção por veículo (troca a cada X km ou a cada Y meses).
- **RF-04:** O sistema deve permitir que o Administrador Central cadastre os itens de estoque padrão (pneu de carro, pneu de moto, óleo, kit de transmissão) com a durabilidade informada pelo fabricante (ex: 3 meses).
- **RF-05:** O sistema deve permitir que o Administrador Central cadastre colaboradores, defina o Gestor de cada franquia e as permissões dos agentes.
- **RF-06:** O sistema deve permitir que o Gestor visualize apenas os veículos, agentes e estoque da sua própria franquia.
- **RF-07:** O sistema deve permitir que o Gestor atribua/transfira a posse de cada veículo a um agente responsável, registrando quem está de posse a qualquer momento.
- **RF-08:** O sistema deve permitir que o Gestor e o Agente consultem o histórico das últimas manutenções e a previsão da próxima manutenção de cada veículo.
- **RF-09:** O sistema deve permitir que o Agente registre um abastecimento informando valor, quilometragem atual e anexando a foto do recibo.
- **RF-10:** O sistema deve permitir que a IA leia automaticamente os dados (valor, data, km, litros, fornecedor) de fotos de recibos de abastecimento e notas fiscais de manutenção via OCR.
- **RF-11:** O sistema deve permitir que o Agente registre um abastecimento ou manutenção enviando a foto do recibo por WhatsApp como forma secundária, com processamento automático.
- **RF-12:** O sistema deve permitir que o Agente registre uma manutenção informando serviço, custo, fornecedor, quilometragem e nota fiscal.
- **RF-13:** O sistema deve permitir que o Agente registre a retirada de uma peça do estoque vinculada a um veículo, abatendo a quantidade disponível.
- **RF-14:** O sistema deve recalcular a quilometragem atual do veículo a cada abastecimento e atualizar a previsão da próxima troca por km.
- **RF-15:** O sistema deve gerar automaticamente alerta de manutenção quando um veículo se aproxima do limite de km ou de tempo (o que vencer primeiro), direcionado ao agente e ao gestor.
- **RF-16:** O sistema deve gerar automaticamente alerta de estoque baixo quando a quantidade de um item cai abaixo do mínimo configurado e abrir a solicitação ao Responsável por Compras.
- **RF-17:** O sistema deve gerar automaticamente alerta quando um item de estoque se aproxima do fim da durabilidade informada pelo fabricante.
- **RF-18:** O sistema deve permitir que o Responsable por Compras registre a solicitação de dinheiro/reembolso referente a uma compra de estoque.
- **RF-19:** O sistema deve permitir que o Responsável por Compras dê entrada de itens comprados no estoque (quantidade, fornecedor, custo, data), recalculando o nível e a validade/durabilidade de cada item.
- **RF-20:** O sistema deve permitir que o Gestor aprove retiradas de peças e que o Gestor ou Administrador Central aprove compras de estoque.
- **RF-21:** O sistema deve permitir que o Administrador e o Gestor gerem relatórios e insights de custo de combustível e manutenção segmentados por franquia, veículo e período, produzidos por IA.
- **RF-22:** O sistema deve enviar os alertas gerados pelos canais app, WhatsApp e email.
- **RF-23:** O sistema deve garantir que cada usuário só enxergue dados da sua franquia e que apenas o Administrador Central veja as 8 consolidadas.

## 6. Requisitos não-funcionais

- **Performance:** páginas de lista (veículos, estoque, alertas) devem carregar em até 2s para volumes de 8 franquias; OCR de recibo deve retornar em até ~15s de forma assíncrona, sem travar o app.
- **Disponibilidade:** sistema hospedado sobre Supabase (PostgreSQL gerenciado) e frontend Lovable, com meta de disponibilidade ≥99% em horário comercial das unidades.
- **Segurança e acesso:** autenticação via Supabase Auth (email/senha e magic link); isolamento de dados por franquia garantido por **RLS** em todas as tabelas, com papéis `central_admin`, `franchise_manager`, `agent` e `purchasing`; integrações externas (IA, WhatsApp, email) apenas via Edge Functions, nunca expostas no frontend.
- **Integridade de dados:** retirada de peça e entrada de estoque executadas via RPC transacional que valida saldo; cálculo de vencimento "o que vencer primeiro" centralizado no servidor para consistência.
- **LGPD/dados pessoais:** o sistema armazena dados de colaboradores (nome, telefone para casar WhatsApp, franquia, cargo). Acesso restrito por RLS, telefone usado exclusivamente para vincular mensagens e enviar alertas; não há coleta de dados de clientes finais. Fotos de recibos/notas ficam no Storage com políticas por franquia. Deve haver base legal de legítimo interesse/execução de contrato de trabalho e possibilidade de exclusão de colaborador (soft delete via `is_active`).

## 7. Métricas de sucesso

1. **≥90%** das manutenções realizadas antes do vencimento (por km ou tempo) após 3 meses de uso.
2. **≥80%** dos abastecimentos e manutenções registrados com anexo de recibo/nota processado por OCR (reduzindo o preenchimento manual falho de hoje).
3. **100% dos veículos** da rede com agente de posse definido e km atualizado nos últimos 30 dias.
4. **Zero rupturas de estoque** de itens críticos (pneu de moto, óleo) por mês, graças ao alerta automático de reposição.
5. **Relatório consolidado de custo por franquia** disponível em tempo real para o Administrador Central, substituindo a consolidação manual de planilhas.

## 8. Fora de escopo

- Integração com ERP financeiro completo ou contabilidade; o fluxo de reembolso cobre apenas a origem da compra de estoque, não a conciliação financeira.
- Roteirização, rastreamento GPS em tempo real ou telemetria embarcada dos veículos.
- Emissão de notas fiscais ou integração fiscal (o sistema apenas lê a nota via OCR, não emite).
- Compra automática/integração direta com fornecedores ou marketplaces de peças.
- App mobile nativo publicado nas lojas (iOS/Android); nesta versão o acesso é web responsivo gerado pelo Lovable + WhatsApp como canal secundário.
- Gestão de abastecimento via cartão/frota com débito automático em posto conveniado.
- Módulo de multas de trânsito, seguro e documentação veicular (licenciamento/IPVA), não citados pelo usuário.
