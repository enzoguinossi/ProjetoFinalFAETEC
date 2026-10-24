# Requisitos Funcionais — Projeto Nexus (Revisão 02/09)

> **Numeração:** o projeto tem **25 requisitos funcionais**, de `RF001` a `RF025`. O ID
> **`RF008` não existe** — a lacuna entre `RF007` e `RF009` é **preservada de propósito**
> (não renumerar, não preencher com um requisito novo). A numeração é estável para não
> quebrar a rastreabilidade já registrada em commits e no changelog.
>
> **Fora do escopo:** o `RF025` não será implementado — ver [`ESCOPO_FORA.md`](ESCOPO_FORA.md).

## Módulo 1: Gestão de Acessos e Usuários

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF001 | Gerenciar Usuários, Perfis e Permissões | O sistema deve permitir o cadastro, alteração, consulta e inativação de usuários. As permissões são fixas e pré-definidas (entidade.acao), organizadas em perfis-template. Um usuário pode ter permissões de múltiplos perfis aplicados e permissões individuais. O usuário Super Admin é criado no primeiro startup e possui flag super_admin que burla toda checagem de permissão. | Essencial |
| RF002 | Autenticação | O sistema deve exigir login e senha válidos para permitir o acesso do usuário às funcionalidades. | Essencial |
| RF003 | Trilha de Auditoria | O sistema deve registrar automaticamente toda ação dos usuários: quem fez, data/hora, entidade afetada e ID do registro. | Essencial |

## Módulo 2: Cadastros Base

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF004 | Gerenciar Destinatários | O sistema deve permitir o cadastro de 105 a 108 escolas e creches municipais. Destinatário estende Pessoa Jurídica (CNPJ opcional). Endereço em tabela separada com logradouro, número, complemento, bairro, cidade, CEP, latitude e longitude. Código da escola via código personalizado do tipo COD_ESCOLA. | Essencial |
| RF005 | Gerenciar Funcionários | O sistema deve permitir o cadastro de funcionários, que estendem Pessoa Física (nome, CPF opcional). Um funcionário pode ou não ser Usuário (ter login). Um funcionário pode ser marcado como Condutor através de um checkbox no formulário. | Essencial |
| RF006 | Gerenciar Fornecedores | O sistema deve permitir o cadastro de fornecedores, que estendem Pessoa Jurídica (CNPJ opcional). Endereço opcional em tabela separada. | Essencial |
| RF007 | Gerenciar Veículos | O sistema deve permitir o cadastro de veículos com placa, modelo e status (DISPONIVEL, INDISPONIVEL, EM_EXPEDICAO). | Essencial |
| RF009 | Mural de Mensagens do Dia | O sistema deve disponibilizar um mural na tela inicial para exibição de avisos e recados diários entre a equipe, com título, conteúdo, data de publicação, data de expiração opcional e autor vinculado. | Essencial |

## Módulo 3: Controle de Estoque e Catálogo de Produtos

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF010 | Gerenciar Catálogo de Produtos | O sistema deve permitir o cadastro de produtos com descrição, foto, flags Perecível e Composto. Códigos GTIN/EAN via código personalizado (tipos EAN12 e EAN13). Conversão de unidade padrão opcional vinculada à tabela conversao_unidade. | Essencial |
| RF011 | Leitura por Código de Barras | O sistema deve permitir a identificação de produtos por leitor de código de barras, consultando os códigos EAN12 e EAN13 cadastrados como código personalizado do produto. | Essencial |
| RF012 | Movimentação de Estoque | O sistema deve registrar entradas (via nota de entrada com conversão de unidades), saídas (via nota de saída com destinatário e itens), transferências e ajustes de inventário. Cada movimentação gera registro auditável. | Essencial |
| RF013 | Conversão de Unidades | Tabela standalone de conversão (não vinculada a produto). O usuário cria nomes como CX20, PCT10 ou UN. Ao dar entrada, seleciona a conversão e o sistema multiplica a quantidade. O fator pode ser editado no momento da entrada sem alterar o template. | Essencial |
| RF014 | Alertas de Validade | O sistema deve notificar automaticamente no mural de mensagens quando produtos perecíveis estiverem a 90, 60, 45 e 30 dias do vencimento, com base na data_validade do cadastro do produto. | Essencial |
| RF015 | Gestão de Inventário | O sistema deve permitir abertura de inventário com bloqueio de movimentação dos produtos sendo contados. Contagem cega opcional (controlada pela permissão `inventario.ver_contagem_cega`). Múltiplas contagens por item de diferentes funcionários. Aprovador vê planilha comparativa com média e contagens individuais e escolhe qual valor aplicar. Toda diferença precisa de aprovação manual. | Essencial |
| RF016 | Baixas por Consumo Interno e Avarias | O sistema deve permitir o registro de baixa de itens destinados ao uso do próprio galpão ou danificados, gerando notas de saida. | Essencial |

## Módulo 4: Gestão de Notas e Logística de Entregas

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF017a | Nota de Entrada | O sistema deve permitir o registro de entrada de mercadorias com ou sem chave de acesso NF-e vinculada. Fornecedor opcional. Itens com conversão de unidade. Ao confirmar, aumenta o campo quantidade_atual do estoque. Não cria lote automaticamente. | Essencial |
| RF017b | Nota de Saída | O sistema deve permitir que o operador registre a entrega (destinatário, urgência e itens) em uma nota de saída que reserva o estoque na criação. A nota é editável enquanto `ABERTA` e pode ser cancelada liberando a reserva. | Essencial |
| RF018 | Quadro Kanban de Entregas | O sistema deve gerenciar visualmente o fluxo das entregas pelos status: ABERTA, EM_PERCURSO, PENDENTE, BAIXA_TOTAL, BAIXA_PARCIAL, BAIXA_COM_CORTE e CANCELADA. | Importante - fora do escopo, ver [`ESCOPO_FORA.md`](ESCOPO_FORA.md) |
| RF019 | Assistente de Saída | O sistema deve **avisar** o usuário quando o saldo disponível (quantidade_atual - saldo_reservado) for insuficiente, mas **permitir que a nota prossiga**. | Essencial |
| RF020 | Anexo de Fotos | O sistema deve permitir o upload de fotos das mercadorias separadas, vinculadas à nota de saída. | Essencial |
| RF021 | Gestão de Pendências e Urgências | O sistema deve permitir que notas não entregues (PENDENTE) sejam adicionadas em outra expedição. Retiradas diretas de urgência no galpão devem ser registradas como nota de saída com flag `urgente`, dando baixa parcial na própria nota. | Essencial |
| RF022 | Percurso e Expedição | O sistema deve gerenciar percursos como templates reutilizáveis (ordem de visitas) e expedições como manifestos do dia (veículo, condutor e ordem). A expedição pode ser baseada em um percurso ou criada do zero, e deve ser editável. A expedição agrupa notas de saída com ordem de visita. | Essencial |

## Módulo 5: Relatórios, Consultas e Integrações

| ID | Título | Descrição | Prioridade |
|----|--------|-----------|------------|
| RF023 | Relatórios de Movimentação | O sistema deve gerar relatórios periódicos (diários, mensais e consolidados semestrais) com filtros por período, produto, escola, motorista e veículo. Deve incluir uma listagem simplificada de todos os produtos com descrição e foto. | Essencial |
| RF024 | Exportação de Dados | O sistema deve permitir a visualização e exportação de relatórios em formato de planilha para conferência. | Essencial |
| RF025 | Importação de NF-e (XML) | O sistema deve oferecer suporte ao pré-cadastro e entrada automatizada de produtos por meio da leitura do arquivo XML da Nota Fiscal Eletrônica. | Desejável — fora do escopo, ver [`ESCOPO_FORA.md`](ESCOPO_FORA.md) |