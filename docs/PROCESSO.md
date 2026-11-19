## 1. Visão geral

O **GestãoFrota Multi-Franquia** é o sistema de gestão de frota, manutenções e estoque de peças da rede, que opera em 8 franquias (CE - Limoeiro do Norte, CE - Trairi, MG - Paracatu, PB - Patos, RN - Apodi, RN - João Camara, RN - Macau e RN - Parelhas) e atende mais de 50 colaboradores. Hoje, como você indicou, esses controles são feitos em **planilhas e WhatsApp**, de forma falha e inconsistente — "nem sempre é feito por todos" — o que impede saber quem está com cada veículo, quanto se gasta com combustível e manutenção, e quando a próxima troca vence. O app centraliza o controle de cada veículo (quilometragem, agente responsável, histórico e previsão de próxima manutenção por km ou por tempo), o controle de estoque de peças (pneu de carro, pneu de moto, óleo, kit de transmissão) com noção de validade/durabilidade informada pelo fabricante, e o controle de custos por franquia. Como você pediu, a inteligência artificial atua em três frentes: **prever vencimentos e gerar alertas**, **ler fotos e notas fiscais de abastecimento/manutenção**, e **gerar relatórios e insights de custos** por franquia.

## 2. Papéis de usuário

- **Administrador Central (rede):** enxerga as 8 franquias, define regras de manutenção e durabilidade de itens, aprova compras de estoque e acompanha os relatórios consolidados de custos.
- **Gestor da Franquia:** gerencia a frota, o estoque e os colaboradores da sua própria unidade, aprova retiradas de peças e acompanha alertas da unidade.
- **Agente/Colaborador (motorista/operador):** fica de posse dos veículos e registra, pelo app ou por WhatsApp, abastecimentos, manutenções e retiradas de peças do estoque.
- **Responsável por Compras/Reembolso:** registra as solicitações de dinheiro e reembolsos que originam as compras de estoque e repõe os itens.

## 3. Processo passo a passo por papel

### Administrador Central
1. Acessa o sistema com login próprio e vê o painel consolidado das 8 franquias.
2. Cadastra ou revisa cada veículo da rede, informando a franquia dona, tipo (carro/moto) e os parâmetros de manutenção (ex: troca de óleo a cada X km ou a cada Y meses).
3. Cadastra os itens de estoque padrão da rede (pneu de carro, pneu de moto, óleo, kit de transmissão) e define a durabilidade de cada um conforme o fabricante (ex: "este item dura 3 meses").
4. Define quem é Gestor de cada franquia e as permissões dos agentes.
5. Recebe os alertas de manutenção/estoque gerados automaticamente e acompanha os relatórios de custo por franquia e por veículo gerados pela IA.
6. Aprova (ou delega a aprovação de) compras de estoque quando necessário.

### Gestor da Franquia
1. Faz login e vê apenas os veículos, agentes e estoque da sua unidade.
2. Atribui cada veículo a um agente responsável — o sistema passa a registrar "quem está de posse daquele veículo".
3. Acompanha o histórico das últimas manutenções de cada veículo e os avisos de "próximo de uma próxima manutenção".
4. Confere os registros de abastecimento e manutenção enviados pelos agentes (incluindo os que chegaram por foto/nota fiscal lida pela IA).
5. Monitora o nível de estoque da unidade e aprova retiradas de peças.
6. Recebe alertas quando um item está com estoque baixo ou próximo do vencimento de durabilidade e aciona a compra/reposição.

### Agente/Colaborador (motorista/operador)
1. Faz login no app e vê o(s) veículo(s) sob sua responsabilidade.
2. A cada abastecimento, registra o valor, a quilometragem atual e anexa a foto do recibo — a IA lê os dados da nota automaticamente. Alternativamente, envia a foto do recibo por WhatsApp e o sistema processa.
3. Ao fazer uma manutenção, registra o serviço, o custo, o fornecedor e anexa a nota fiscal (pelo app ou por WhatsApp).
4. Quando precisa de uma peça, registra a retirada do item do estoque (ex: um pneu de moto), vinculando-a ao veículo.
5. Mantém a quilometragem atualizada, o que alimenta a previsão de próxima troca por km.
6. Recebe no app/WhatsApp os lembretes de manutenção dos veículos sob sua responsabilidade.

### Responsável por Compras/Reembolso
1. Faz login e vê as solicitações de reposição de estoque geradas pelos alertas de estoque baixo.
2. Registra a solicitação de dinheiro/reembolso referente à compra, como já é feito hoje a partir dos formulários de reembolso.
3. Após a compra, dá entrada dos itens no estoque da franquia, informando quantidade, fornecedor, custo e data da compra.
4. O sistema recalcula o nível de estoque e a data prevista de validade/durabilidade de cada item.
5. Acompanha o custo acumulado de compras por franquia nos relatórios.

## 4. Regras de negócio

- Regra: cada usuário só enxerga dados da sua franquia (agente e gestor); apenas o Administrador Central vê as 8 franquias consolidadas.
- Regra: todo veículo deve ter sempre um agente responsável definido, para rastrear "quem está de posse" a qualquer momento.
- Regra: a próxima manutenção é calculada por km rodado OU por tempo (o que vencer primeiro), conforme o parâmetro cadastrado para o veículo.
- Regra: quando um veículo se aproxima do limite de km ou de tempo da manutenção, o sistema gera alerta automático para o agente e o gestor.
- Regra: cada item de estoque tem durabilidade informada pelo fabricante (ex: 3 meses); ao se aproximar do fim, o sistema avisa.
- Regra: quando o estoque de um item cai abaixo do mínimo, o sistema gera alerta de reposição e abre a solicitação ao Responsável por Compras.
- Regra: todo abastecimento e toda manutenção exigem valor, quilometragem (quando aplicável) e, preferencialmente, anexo de recibo/nota fiscal para a IA validar.
- Regra: retirada de peça do estoque deve estar vinculada a um veículo e abater a quantidade disponível.
- Regra: o registro pode ser feito pelo app OU por WhatsApp (via foto do recibo), sendo o app a forma principal e o WhatsApp a forma secundária.
- Regra: relatórios de custo de combustível e manutenção são segmentados por franquia, por veículo e por período.

## 5. Suposições assumidas

- SUPOSIÇÃO: o papel "Responsável por Compras/Reembolso" foi inferido a partir da menção de que as compras partem de "formulários de reembolsos e solicitações de dinheiro"; o usuário não detalhou se é uma pessoa dedicada ou o próprio gestor.
- SUPOSIÇÃO: adotamos a regra "o que vencer primeiro" entre km e tempo para disparo da manutenção, pois o usuário citou ambos os critérios mas não qual prevalece.
- SUPOSIÇÃO: assumimos que cada item de estoque tem um nível mínimo configurável para disparar o alerta de reposição; o usuário mencionou controle de estoque e alertas, mas não definiu o valor do mínimo.
- SUPOSIÇÃO: assumimos que os alertas chegam por app e WhatsApp (e opcionalmente email); o usuário confirmou WhatsApp como canal, mas não especificou todos os canais de notificação.
- SUPOSIÇÃO: assumimos que a aprovação final de compras pode ser do Gestor da Franquia ou do Administrador Central; o usuário não definiu o nível de alçada de aprovação.