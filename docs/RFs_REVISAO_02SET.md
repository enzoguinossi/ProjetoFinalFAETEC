# Requisitos Funcionais — Projeto Nexus (Revisão 02/09)

## Módulo 1: Gestão de Acessos e Usuários

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF001 | Gerenciar Usuários, Perfis e Permissões | O sistema deve permitir o cadastro, alteração, consulta e inativação de usuários. As permissões devem ser granulares (cada ação do sistema é uma permissão individual), organizadas em perfis dinâmicos. Um usuário pode pertencer a múltiplos perfis. Todo usuário deve ser um funcionário cadastrado previamente. | Essencial |
| RF002 | Autenticação | O sistema deve exigir login e senha válidos (armazenados em hash) para permitir o acesso do usuário às funcionalidades. | Essencial |
| RF003 | Trilha de Auditoria | O sistema deve registrar automaticamente toda ação dos usuários: quem fez, data/hora, entidade afetada, ID do registro e snapshot dos dados anteriores e novos em formato JSON. | Essencial |

## Módulo 2: Cadastros Base

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF004 | Gerenciar Destinatários | O sistema deve permitir o cadastro de 105 a 108 escolas e creches municipais. Destinatário estende Pessoa Jurídica (CNPJ opcional). Endereço em tabela separada com logradouro, número, complemento, bairro, cidade, CEP, latitude e longitude. Código da escola via código personalizado do tipo COD_ESCOLA. | Essencial |
| RF005 | Gerenciar Funcionários | O sistema deve permitir o cadastro de funcionários, que estendem Pessoa Física (nome, CPF opcional). Um funcionário pode ou não ser Usuário (ter login). Um funcionário pode ou não ser Condutor (ter CNH). | Essencial |
| RF006 | Gerenciar Fornecedores | O sistema deve permitir o cadastro de fornecedores, que estendem Pessoa Jurídica (CNPJ opcional). Endereço opcional em tabela separada. | Essencial |
| RF007 | Gerenciar Condutores | O sistema deve permitir o cadastro de condutores, que estendem Funcionário em relação 1:1. Campos: número CNH, categoria CNH (A, B, C, D, E), validade CNH. | Essencial |
| RF008 | Gerenciar Veículos | O sistema deve permitir o cadastro de veículos com placa, modelo, capacidade e status (DISPONIVEL, INDISPONIVEL, EM_ROTA). | Essencial |
| RF009 | Mural de Mensagens do Dia | O sistema deve disponibilizar um mural na tela inicial para exibição de avisos e recados diários entre a equipe, com título, conteúdo, data de publicação, data de expiração opcional e autor vinculado. | Desejável |

## Módulo 3: Controle de Estoque e Catálogo de Produtos

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF010 | Gerenciar Catálogo de Produtos | O sistema deve permitir o cadastro de produtos com descrição, foto (upload para servidor local), flags Perecível e Composto. Códigos GTIN/EAN via código personalizado (tipos EAN12 e EAN13). Conversão de unidade padrão opcional vinculada à tabela conversao_unidade. | Essencial |
| RF011 | Leitura por Código de Barras | O sistema deve permitir a identificação de produtos por leitor de código de barras, consultando os códigos EAN12 e EAN13 cadastrados como código personalizado do produto. | Essencial |
| RF012 | Movimentação de Estoque | O sistema deve registrar entradas (via nota de entrada com conversão de unidades), saídas (via nota de saída e remessa), transferências e ajustes de inventário. Cada movimentação gera registro auditável com snapshot de saldo anterior e posterior. | Essencial |
| RF013 | Conversão de Unidades | Tabela standalone de conversão (não vinculada a produto). O usuário cria nomes como CX20, PCT10 ou UN. Ao dar entrada, seleciona a conversão e o sistema multiplica a quantidade. O fator pode ser editado no momento da entrada sem alterar o template. | Importante |
| RF014 | Alertas de Validade | O sistema deve emitir alertas para produtos com lote próximo ao vencimento baseado na tabela de lotes (sugestão FIFO). | Essencial |
| RF015 | Gestão de Inventário | O sistema deve permitir abertura de inventário com bloqueio de movimentação dos produtos sendo contados. Contagem cega opcional (usuários sem permissão não veem saldo do sistema). Múltiplas contagens por item de diferentes funcionários. Aprovador vê planilha comparativa com média e contagens individuais e escolhe qual valor aplicar. Toda diferença precisa de aprovação manual. | Essencial |
| RF016 | Baixas por Consumo Interno e Avarias | O sistema deve permitir o registro de baixa de itens destinados ao uso do próprio galpão ou danificados, gerando notas de saida. | Importante |

## Módulo 4: Gestão de Notas e Logística de Remessas

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF017a | Nota de Entrada | O sistema deve permitir o registro de entrada de mercadorias com ou sem chave de acesso NF-e vinculada. Fornecedor opcional. Itens com conversão de unidade. Ao confirmar, aumenta o campo quantidade_atual do estoque. Não cria lote automaticamente. | Essencial |
| RF017b | Nota de Saída | O sistema deve permitir que o operador transcreva pedidos recebidos em papel para o sistema, gerando uma nota de saída que reserva o estoque. Ao criar, saldo_reservado é incrementado. | Essencial |
| RF018 | Quadro Kanban de Remessas | O sistema deve gerenciar visualmente o fluxo das entregas pelos status: EM_PREPARACAO, PRONTO_PARA_ENTREGA, EM_PERCURSO, PENDENTE, FINALIZADO_TOTAL e FINALIZADO_PARCIAL. | Essencial |
| RF019 | Assistente de Remessa e Priorização | O sistema deve sugerir lotes com data de validade mais próxima ao compor uma remessa (baseado na tabela lote, que é apenas sugestão sem reserva). Deve validar saldo disponível antes de liberar a remessa. | Essencial |
| RF020 | Anexo de Fotos | O sistema deve permitir o upload de fotos das mercadorias separadas, vinculadas à remessa. | Essencial |
| RF021 | Gestão de Pendências e Urgências | O sistema deve permitir que remessas não entregues (PENDENTE) sejam adicionadas em uma nova rota. Retiradas diretas de urgência no galpão devem ser registradas como remessa com flag de urgente. Dando uma baixa parcial na remessa. | Essencial |
| RF022 | Percurso e Rota | O sistema deve gerenciar percursos como templates reutilizáveis (ordem de visitas) e rotas como instâncias do dia. A rota pode ser baseada em um percurso ou criada do zero, e deve ser editável. A rota agrupa remessas com ordem de visita. | Importante |

## Módulo 5: Relatórios, Consultas e Integrações

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF023 | Relatórios de Movimentação | O sistema deve gerar relatórios periódicos (diários, mensais e consolidados semestrais) com filtros por período, produto, escola, motorista e veículo. | Essencial |
| RF024 | Exportação de Dados | O sistema deve permitir a visualização e exportação de relatórios em formato de planilha para conferência. | Importante |
| RF025 | Importação de NF-e (XML) | O sistema deve oferecer suporte ao pré-cadastro e entrada automatizada de produtos por meio da leitura do arquivo XML da Nota Fiscal Eletrônica. | Desejável |