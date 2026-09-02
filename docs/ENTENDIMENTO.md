# Entendimento do Projeto — Nexus

> Sistema de Controle de Estoque e Logística de Remessas
> Projeto Final FAETEC — Turma Técnico em Informática 2026

---

## 1. Visão Geral

### 1.1 O Problema

O galpão da Secretaria Municipal de Educação (SME) de Teresópolis, gerido pelo Serviço de Material, controla a distribuição de materiais de higiene, limpeza, papelaria e didáticos para **105 a 108 escolas e creches municipais**.

Atualmente, o fluxo é manual:

1. **Jonathan** (operador do galpão) conta o estoque **na mão** (papel + Excel) e envia para a Secretaria
2. A **Secretaria** informa as escolas sobre os produtos disponíveis
3. As **escolas** fazem suas solicitações (pedidos) e enviam para a Secretaria
4. A **Secretaria** repassa os pedidos em **papel (físico)** para o Jonathan
5. Jonathan recebe um "bolo" de pedidos, separa os produtos manualmente e realiza as entregas
6. O acompanhamento é feito via **Trello** + **fotos no celular** + **planilhas avulsas**

### 1.2 A Solução

Um sistema web que centraliza:

- **Controle de Estoque** — substitui a contagem manual e planilhas Excel
- **Cadastro de Produtos** — com fotos, lotes, validade, composição
- **Gestão de Pedidos (Notas de Saída)** — transcrição dos pedidos em papel para o sistema
- **Reserva de Estoque** — ao criar uma nota, o sistema reserva os produtos no estoque
- **Remessas** — tentativas de entrega vinculadas a notas de saída
- **Rotas** — organização diária das entregas em ordem de visita (com suporte a templates)
- **Auditoria** — registro de toda ação feita no sistema
- **Relatórios** — periódicos (diário, mensal, semestral)

### 1.3 Perfis de Usuário

| Perfil | Pessoa | Acesso |
|--------|--------|--------|
| **Administrador / Chefe** | Felipe | Completo: config, usuários, auditoria, relatórios gerenciais |
| **Operador do Galpão** | Jonathan | Recebimento, conferência (leitor código de barras), montagem de remessas, kanban |
| **Auxiliar Administrativo** | "Menina da Baixa" | Baixa de notas, consumo interno, inventário, documentos fiscais |
| **Funcionários Cadastrados** | Demais colaboradores | Sem login no sistema (apenas cadastro para alocação em rotas) |

### 1.4 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | TypeScript + Node (API REST) |
| **Frontend** | TypeScript + React (Web) |
| **Banco de Dados** | MySQL |
| **Versionamento** | GitHub |
| **Compartilhado** | Pasta `shared/` com tipos e funções auxiliares |

---

## 2. Estrutura do Monorepo

```
projeto-final-faetec/
├── backend/           # API REST (TypeScript + Node)
├── frontend/          # Interface web (TypeScript + React)
├── shared/            # Tipos e funções compartilhadas
│   └── types/
│       ├── pessoal.ts
│       ├── produto.ts
│       ├── remessa.ts
│       ├── rota.ts
│       ├── acesso.ts
│       └── ...
├── docs/              # Documentação e diagramas
│   ├── ENTENDIMENTO.md
│   └── puml/
│       ├── classes.puml     # Diagrama de classes conceitual
│       └── DER.puml         # Diagrama Entidade-Relacionamento
├── package.json       # Monorepo root
└── tsconfig.json
```

---

## 3. Modelo de Dados

### 3.1 Convenções

- **IDs**: Auto-increment INT (`ID_entidade` como PK)
- **Soft Delete**: Toda entidade de cadastro possui campo `ativo: Boolean`
- **Hard Delete é proibido**: nada pode ser excluído fisicamente, apenas desativado
- **Nomenclatura DB**: `snake_case`
- **Nomenclatura TS**: `camelCase`

---

### 3.2 Bloco: Códigos Personalizados

Toda entidade que precisa ser acessada rapidamente no sistema pode ter **múltiplos códigos personalizados**, cada um com um **tipo** pré-definido. A unicidade é absoluta apenas dentro da própria tabela de códigos (pode repetir entre entidades diferentes).

```
tipo_codigo
├── ID_tipo_codigo   INT PK auto_increment
├── nome             VARCHAR NOT NULL UNIQUE
├── descricao        VARCHAR
└── ativo            BOOLEAN DEFAULT TRUE

Valores iniciais de nome:
  - DIGITACAO       → apelido livre para digitação rápida
  - EAN12           → código de barras de 12 dígitos
  - EAN13           → código de barras de 13 dígitos
  - COD_FORNECEDOR  → código que o fornecedor usa para o produto
  - COD_ESCOLA       → código da SME para cada escola
  - MATRICULA        → matrícula funcional do funcionário
```

Tabelas de códigos (uma por entidade que precisa):

```
produto_codigo        → ID_produto FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
destinatario_codigo   → ID_destinatario FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
fornecedor_codigo     → ID_fornecedor FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
funcionario_codigo    → ID_funcionario FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
condutor_codigo       → ID_condutor FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
veiculo_codigo        → ID_veiculo FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
```

---

### 3.3 Bloco: Pessoas (Física e Jurídica)

Duas tabelas base concretas (sem herança abstrata):

```
pessoa_fisica
├── ID_pessoa_fisica   INT PK auto_increment
├── nome               VARCHAR NOT NULL
├── cpf                VARCHAR UNIQUE NULL  ← opcional
└── ativo              BOOLEAN DEFAULT TRUE

pessoa_juridica
├── ID_pessoa_juridica  INT PK auto_increment
├── razao_social        VARCHAR NOT NULL
├── cnpj                VARCHAR UNIQUE NULL  ← opcional (prefeitura nem sempre fornece)
└── ativo               BOOLEAN DEFAULT TRUE
```

#### 3.3.1 Funcionário (1:1 com Pessoa Física)

```
funcionario
├── ID_funcionario      INT PK auto_increment
├── ID_pessoa_fisica    INT FK UNIQUE NOT NULL
├── cargo               VARCHAR
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- Todo funcionário É uma pessoa física
- Nem toda pessoa física é funcionário
- FK 1:1 garante que cada PF pode ter no máximo um funcionário

#### 3.3.2 Usuário (1:1 com Funcionário — opcional)

```
usuario
├── ID_usuario          INT PK auto_increment
├── ID_funcionario      INT FK UNIQUE NOT NULL  ← só pode ser funcionário
├── login               VARCHAR NOT NULL UNIQUE
├── senha_hash          VARCHAR NOT NULL
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- **Todo usuário DEVE ser um funcionário cadastrado**
- Nem todo funcionário é usuário (ex: motorista só aparece nas remessas, sem login)
- FK 1:1 para Funcionario — um funcionário pode ter no máximo um usuário

#### 3.3.3 Condutor (1:1 com Funcionário — opcional)

```
condutor
├── ID_condutor         INT PK auto_increment
├── ID_funcionario      INT FK UNIQUE NOT NULL  ← só pode ser funcionário
├── numero_cnh          VARCHAR
├── categoria_cnh       VARCHAR
├── validade_cnh        DATE
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- **Todo condutor DEVE ser um funcionário cadastrado**
- Um funcionário pode ou não ser condutor
- FK 1:1 para Funcionario

#### 3.3.4 Fornecedor (1:1 com Pessoa Jurídica)

```
fornecedor
├── ID_fornecedor          INT PK auto_increment
├── ID_pessoa_juridica     INT FK UNIQUE NOT NULL
├── contato                VARCHAR
├── ID_endereco            INT FK → endereco NULL  ← opcional
└── ativo                  BOOLEAN DEFAULT TRUE
```

#### 3.3.5 Destinatário (1:1 com Pessoa Jurídica)

```
destinatario
├── ID_destinatario        INT PK auto_increment
├── ID_pessoa_juridica     INT FK UNIQUE NOT NULL
├── tipo_destinatario      ENUM('ESCOLA','CRECHE')
├── ID_endereco            INT FK → endereco NOT NULL  ← obrigatório
└── ativo                  BOOLEAN DEFAULT TRUE
```

---

### 3.4 Bloco: Contato (Telefone e Email)

Tabelas separadas por entidade, pois cada telefone/email pertence exclusivamente a UMA entidade.

```
funcionario_telefone
├── ID_funcionario_telefone  INT PK
├── ID_funcionario           INT FK NOT NULL
├── numero                   VARCHAR NOT NULL UNIQUE  ← único na tabela
├── tipo                     ENUM('CELULAR','FIXO','COMERCIAL')
├── principal                BOOLEAN DEFAULT FALSE
└── ativo                    BOOLEAN DEFAULT TRUE

destinatario_telefone   → mesma estrutura, FK para ID_destinatario
fornecedor_telefone     → mesma estrutura, FK para ID_fornecedor
```

Email segue o mesmo padrão:

```
funcionario_email       → ID_funcionario FK, endereco UNIQUE, principal
destinatario_email      → ID_destinatario FK, endereco UNIQUE, principal
fornecedor_email        → ID_fornecedor FK, endereco UNIQUE, principal
```

---

### 3.5 Bloco: Endereço

Tabela separada, vinculada por FK a quem precisar.

```
endereco
├── ID_endereco         INT PK auto_increment
├── logradouro          VARCHAR NOT NULL
├── numero              VARCHAR
├── complemento         VARCHAR
├── bairro              VARCHAR
├── cidade              VARCHAR NOT NULL
├── cep                 VARCHAR
├── latitude            DECIMAL          ← para mapa futuro
└── longitude           DECIMAL          ← para mapa futuro
```

Quem usa:
- **Destinatário** → obrigatório (escola/creche precisa de endereço)
- **Fornecedor** → opcional (controle interno, estimar tempo de entrega)

---

### 3.6 Bloco: Produto

```
produto
├── ID_produto            INT PK auto_increment
├── descricao             VARCHAR NOT NULL
├── foto_url              VARCHAR          ← upload para servidor local
├── perecivel             BOOLEAN DEFAULT FALSE
├── composto              BOOLEAN DEFAULT FALSE  ← marcado se precisar desmontar
├── ID_conversao_padrao   INT FK → conversao_unidade NULL  ← auto-preenche entrada
└── ativo                 BOOLEAN DEFAULT TRUE
```

**Flags removidas:** fracionado, porGrade, localizacao_fisica, gtin (gtin agora é código personalizado)

**Foto:** O usuário faz upload para o servidor da aplicação → salva no file system local → guarda URL no DB.

#### 3.6.1 Conversão de Unidades

Tabela standalone (não vinculada a um produto específico):

```
conversao_unidade
├── ID_conversao       INT PK auto_increment
├── nome               VARCHAR NOT NULL UNIQUE  ← 'CX20', 'PCT10', 'UN', 'RESMA'
├── fator              DECIMAL NOT NULL          ← 20, 10, 1
├── descricao          VARCHAR
└── ativo              BOOLEAN DEFAULT TRUE
```

Regras:
- O nome é livre — o cliente cria conforme necessidade (ex: "CX20" = caixa com 20 unidades)
- O fator sempre **multiplica** a quantidade na entrada
- Ao criar um documento de entrada, o usuário pode selecionar qualquer conversão
- Se o produto tiver `ID_conversao_padrao`, esse valor é pré-selecionado (economiza cliques)
- O fator pode ser editado manualmente no momento da entrada **sem alterar o template**

#### 3.6.2 Produto Composto (BOM — Bill of Materials)

```
produto_insumo
├── ID_produto_insumo   INT PK auto_increment
├── ID_produto_pai      INT FK → produto    ← ex: "Kit Escolar"
├── ID_produto_filho    INT FK → produto    ← ex: "Borracha Individual"
├── quantidade          DECIMAL NOT NULL    ← ex: 20 (1 kit = 20 borrachas)
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- Os insumos (produtos-filho) **precisam estar cadastrados previamente**
- Um produto pai pode ter **múltiplos insumos** (ex: Kit Escolar = cola + lápis + borracha + caneta)
- Um produto filho pode estar em **vários produtos pai**
- A flag `composto` só é marcada se houver necessidade real de desmontar aquele produto
- **Fluxo de desmontagem:** ao selecionar "desmontar" no sistema:
  1. Dá baixa no estoque do produto pai (`quantidade_atual -= X`)
  2. Gera entrada no estoque de cada filho (`quantidade_atual += X * quantidade_insumo`)
  3. Registra movimentação do tipo específico (desmontagem)

---

### 3.7 Bloco: Lote e Estoque

```
lote_produto
├── ID_lote_produto     INT PK auto_increment
├── ID_produto          INT FK NOT NULL
├── codigo_lote         VARCHAR
├── quantidade_atual    DECIMAL NOT NULL          ← saldo físico real no galpão
├── saldo_reservado     DECIMAL NOT NULL DEFAULT 0 ← comprometido em notas abertas
├── quantidade_minima   DECIMAL                   ← alerta
├── quantidade_maxima   DECIMAL                   ← alerta
├── quantidade_critica  DECIMAL                   ← alerta severo
├── data_validade       DATE                      ← obrigatório se produto perecivel
├── data_entrada        DATE NOT NULL
└── ativo               BOOLEAN DEFAULT TRUE
```

**Cálculo importante (não armazenado, calculado em tempo real):**

```
saldo_disponivel = quantidade_atual - saldo_reservado
```

#### 3.7.1 Fluxo de Estoque

| Momento | Ação | Impacto |
|---------|------|---------|
| Entrada de mercadoria | Cria/atualiza `lote_produto` | `quantidade_atual += X` |
| Cria Nota Saída | Reserva | `saldo_reservado += X` |
| Cancelamento de Nota | Libera reserva | `saldo_reservado -= X` |
| Remessa finalizada (total/parcial) | Baixa definitiva | `quantidade_atual -= X` E `saldo_reservado -= X` |
| Remessa pendente | Reserva permanece | Aguarda nova tentativa |
| Desmontagem de composto | Baixa pai + entrada filhos | Vide 3.6.2 |
| Ajuste de inventário | Acerto manual | `quantidade_atual = novo_valor` |

---

### 3.8 Bloco: Movimentação de Estoque

```
movimentacao_estoque
├── ID_movimentacao       INT PK auto_increment
├── ID_lote_produto       INT FK NOT NULL
├── ID_usuario            INT FK NOT NULL
├── tipo                  ENUM(
                            'ENTRADA',
                            'SAIDA',
                            'RESERVA',
                            'LIBERACAO_RESERVA',
                            'AJUSTE_INVENTARIO',
                            'CONSUMO_INTERNO',
                            'AVARIA',
                            'DESMONTAGEM'
                          )
├── quantidade            DECIMAL NOT NULL
├── saldo_anterior        DECIMAL                 ← snapshot para auditoria
├── saldo_posterior       DECIMAL                 ← snapshot para auditoria
├── reserva_anterior      DECIMAL                 ← snapshot do saldo_reservado
├── reserva_posterior     DECIMAL                 ← snapshot do saldo_reservado
├── ID_nota_saida         INT FK NULL             ← se mov for referente a uma nota
├── ID_remessa            INT FK NULL             ← se mov for referente a remessa
├── data_hora             TIMESTAMP NOT NULL
└── observacao            TEXT
```

---

### 3.9 Bloco: Inventário

```
inventario
├── ID_inventario           INT PK auto_increment
├── data_inicio             DATE NOT NULL
├── data_fim                DATE
├── contagem_cega           BOOLEAN DEFAULT FALSE
├── status                  ENUM('ABERTO','EM_CONTAGEM','AGUARDANDO_APROVACAO','FINALIZADO')
├── ID_usuario_abertura     INT FK NOT NULL
├── ID_usuario_aprovacao    INT FK NULL
└── observacao              TEXT

item_inventario
├── ID_item_inventario      INT PK auto_increment
├── ID_inventario           INT FK NOT NULL
├── ID_lote_produto         INT FK NOT NULL
├── quantidade_sistema      DECIMAL NOT NULL   ← snapshot congelado na abertura
└── observacao              TEXT

contagem_inventario         ← cada funcionário conta
├── ID_contagem_inventario  INT PK auto_increment
├── ID_item_inventario      INT FK NOT NULL
├── ID_funcionario          INT FK → funcionario NOT NULL  ← quem contou
├── quantidade_contada      DECIMAL NOT NULL
├── data_contagem           TIMESTAMP
└── observacao              TEXT

ajuste_inventario           ← aprovação manual das diferenças
├── ID_ajuste_inventario    INT PK auto_increment
├── ID_inventario           INT FK NOT NULL
├── ID_lote_produto         INT FK NOT NULL
├── diferenca               DECIMAL NOT NULL
├── status                  ENUM('PENDENTE','APROVADO','REJEITADO')
├── ID_usuario_aprovacao    INT FK → usuario NULL
├── data_aprovacao          TIMESTAMP NULL
└── justificativa           TEXT
```

#### 3.9.1 Fluxo do Inventário

| Etapa | Ação no sistema | Impacto |
|-------|----------------|---------|
| **Abertura** | Usuário com permissão `inventario.abrir` cria inventário | status = EM_CONTAGEM. Snapshot de `quantidade_sistema` congelado. Movimentações dos produtos BLOQUEADAS |
| **Contagem cega** | Se marcado no início, usuários SEM permissão `estoque.ver_saldo` não enxergam `quantidade_sistema` | Influencia a contagem física sem viés |
| **Múltiplas contagens** | Vários funcionários contam o mesmo item | Cada contagem vira um registro em `contagem_inventario`. |
| **Finalizar contagem** | Usuário encerra a contagem | status = AGUARDANDO_APROVACAO. Sistema calcula média das contagens e dispara pendências de ajuste |
| **Revisão** | Aprovador vê planilha comparativa: `quantidade_sistema` + contagens individuais + média | Pode escolher uma contagem específica ou usar a média |
| **Aprovação** | Aprovador aprova ou rejeita cada diferença | Se aprovado: gera `movimentacao_estoque` tipo `AJUSTE_INVENTARIO` com snapshot `saldo_anterior/posterior`. Se rejeitado: mantém estoque, registro preservado |
| **Finalização** | Inventário é encerrado | status = FINALIZADO. Movimentações dos produtos DESBLOQUEADAS |

#### 3.9.2 Regras do Inventário

- **Bloqueio é por produto**, não geral — apenas os lotes associados aos `item_inventario` ficam congelados
- **Permissões granulares**: `inventario.abrir`, `inventario.aprovar_ajuste`, `estoque.ver_saldo` (controla contagem cega)
- **Jonathan e Felipe** têm permissões absolutas (podem abrir, contar, aprovar)
- **Diferença não gera ajuste automático** — toda diferença precisa de aprovação manual (RN005)
- **Média vs. escolha manual**: o sistema exibe média, mas o aprovador pode selecionar qualquer contagem individual como valor final

---

### 3.10 Bloco: Percurso e Rota

#### 3.10.1 Percurso (Template)

```
percurso
├── ID_percurso           INT PK auto_increment
├── nome                  VARCHAR NOT NULL     ← "Escolas da roça", "Longe→perto"
├── descricao             TEXT
└── ativo                 BOOLEAN DEFAULT TRUE

percurso_destinatario
├── ID_percurso           INT FK → percurso
├── ID_destinatario       INT FK → destinatario
├── ordem_visita          INT NOT NULL         ← posição no template
├── PRIMARY KEY (ID_percurso, ID_destinatario)
```

#### 3.10.2 Rota (Instância do Dia)

```
rota
├── ID_rota               INT PK auto_increment
├── data_criacao          TIMESTAMP NOT NULL
├── data_prevista         DATE                  ← qual dia vai rodar
├── ID_percurso           INT FK → percurso NULL  ← template usado como base (opcional)
├── observacao            TEXT
└── ativo                 BOOLEAN DEFAULT TRUE
```

Regras:
- Ao criar uma rota, o Jonathan pode selecionar um percurso pré-cadastrado
- A ordem pode ser editada livremente **sem alterar o template original**
- A rota não precisa de nome — é filtrável por data, destinatários, remessas

---

### 3.11 Bloco: Nota Saída e Remessa

#### 3.11.1 Nota Saída (Pedido Transcrito)

Representa o pedido que chega em **papel** da Secretaria e é transcrito para o sistema.

```
nota_saida
├── ID_nota_saida          INT PK auto_increment
├── ID_destinatario        INT FK NOT NULL      ← escola que solicitou
├── data_criacao           TIMESTAMP NOT NULL
├── status                 ENUM('ABERTA','EM_PREPARACAO','FINALIZADA','CANCELADA')
└── observacao             TEXT

item_nota_saida
├── ID_item_nota_saida     INT PK auto_increment
├── ID_nota_saida          INT FK NOT NULL
├── ID_lote_produto        INT FK NOT NULL      ← lote específico que será reservado
├── quantidade             DECIMAL NOT NULL
```

Regras:
- Ao criar `item_nota_saida`, o **estoque é reservado** (`saldo_reservado += quantidade`)
- Se a nota for cancelada, a **reserva é liberada** (`saldo_reservado -= quantidade`)
- Uma nota pode gerar **várias remessas** ao longo do tempo (se a primeira tentativa falhar)

#### 3.11.2 Remessa (Tentativa de Entrega)

```
remessa
├── ID_remessa             INT PK auto_increment
├── ID_nota_saida          INT FK NOT NULL
├── ID_destinatario        INT FK NOT NULL
├── data_criacao           TIMESTAMP NOT NULL
├── status                 ENUM(
                              'EM_PREPARACAO',
                              'PRONTO_PARA_ENTREGA',
                              'EM_PERCURSO',
                              'PENDENTE',
                              'FINALIZADO_TOTAL',
                              'FINALIZADO_PARCIAL'
                            )
├── ID_condutor            INT FK → condutor NULL
├── ID_veiculo             INT FK → veiculo NULL
├── urgente                BOOLEAN DEFAULT FALSE
└── observacao             TEXT

item_remessa
├── ID_item_remessa        INT PK auto_increment
├── ID_remessa             INT FK NOT NULL
├── ID_lote_produto        INT FK NOT NULL
├── quantidade_solicitada  DECIMAL NOT NULL
├── quantidade_separada    DECIMAL
├── quantidade_entregue    DECIMAL
```

#### 3.11.3 Rota × Remessa (N:N com ordem)

```
rota_remessa
├── ID_rota_remessa        INT PK auto_increment   ← PK independente!
├── ID_rota                INT FK → rota
├── ID_remessa             INT FK → remessa
├── ordem_visita           INT                      ← posição na rota naquele dia
├── data_adicao            TIMESTAMP
```

A PK independente permite que **a mesma remessa apareça em rotas diferentes** (ex: tentativa falhou no dia X, entra na rota do dia Y). A auditoria se mantém intacta pois cada entrada é um registro separado.

#### 3.11.4 Ciclo de Vida Completo

```
┌──────────────────────────────────────────────────────────┐
│  Cria Nota Saída → reserva estoque (saldo_reservado +=)  │
│         ↓                                                │
│  Cria Remessa → EM_PREPARACAO                            │
│         ↓                                                │
│  Adiciona na Rota do dia (rota_remessa + ordem_visita)   │
│         ↓                                                │
│  PRONTO_PARA_ENTREGA                                     │
│         ↓                                                │
│  EM_PERCURSO (saiu pra entrega)                          │
│         ↓                                                │
│  ┌─────┴─────┐                                          │
│  ▼            ▼                                          │
│  Sucesso     Falha                                       │
│  ↓            ↓                                          │
│  FINALIZADO   PENDENTE                                   │
│  (baixa real  (reserva mantida, pode                     │
│   do estoque)  criar nova remessa)                       │
│                                                          │
│  Sub-status: TOTAL / PARCIAL / CORTE                     │
└──────────────────────────────────────────────────────────┘
```

---

### 3.12 Bloco: Documentos Fiscais (Entrada)

Gerencia o recebimento de mercadorias de fornecedores (com ou sem nota fiscal).

```
documento_fiscal
├── ID_documento_fiscal    INT PK auto_increment
├── ID_fornecedor          INT FK → fornecedor NULL
├── tipo                   ENUM('NOTA_ENTRADA','NOTA_SAIDA')
├── numero                 VARCHAR
├── data_emissao           DATE
├── data_recebimento       DATE
├── arquivo_url            VARCHAR              ← XML ou PDF anexado
├── observacao             TEXT
└── ativo                  BOOLEAN DEFAULT TRUE

item_documento
├── ID_item_documento      INT PK auto_increment
├── ID_documento_fiscal    INT FK NOT NULL
├── ID_produto             INT FK NOT NULL
├── ID_conversao           INT FK → conversao_unidade NULL ← qual unidade usou na entrada
├── quantidade             DECIMAL NOT NULL
├── quantidade_convertida  DECIMAL NOT NULL     ← qtd * fator_conversao
└── observacao             TEXT
```

Regras:
- A entrada pode ser feita **com ou sem** documento fiscal vinculado
- A conversão de unidade é aplicada no momento da entrada
- Ao confirmar a entrada, o sistema:
  1. Cria/atualiza `lote_produto` com `quantidade_atual += quantidade_convertida`
  2. Cria `movimentacao_estoque` tipo `ENTRADA`

---

### 3.13 Bloco: Veículo

```
veiculo
├── ID_veiculo             INT PK auto_increment
├── placa                  VARCHAR NOT NULL UNIQUE
├── modelo                 VARCHAR
├── capacidade             DECIMAL
├── status                 ENUM('DISPONIVEL','INDISPONIVEL','EM_ROTA')
└── ativo                  BOOLEAN DEFAULT TRUE
```

---

### 3.14 Bloco: Anexos

```
anexo
├── ID_anexo               INT PK auto_increment
├── nome_arquivo           VARCHAR NOT NULL
├── url                    VARCHAR NOT NULL
├── tipo_mime              VARCHAR
├── data_upload            TIMESTAMP
├── ID_remessa             INT FK → remessa NULL
├── ID_documento_fiscal    INT FK → documento_fiscal NULL
└── ativo                  BOOLEAN DEFAULT TRUE
```

---

### 3.15 Bloco: Acessos (Perfil, Permissão, Auditoria)

```
perfil
├── ID_perfil              INT PK auto_increment
├── nome                   VARCHAR NOT NULL UNIQUE
├── descricao              TEXT
└── ativo                  BOOLEAN DEFAULT TRUE

permissao
├── ID_permissao           INT PK auto_increment
├── nome                   VARCHAR NOT NULL UNIQUE
├── descricao              TEXT
└── ativo                  BOOLEAN DEFAULT TRUE

usuario_perfil
├── ID_usuario             INT FK
├── ID_perfil              INT FK
├── PRIMARY KEY (ID_usuario, ID_perfil)

perfil_permissao
├── ID_perfil              INT FK
├── ID_permissao           INT FK
├── PRIMARY KEY (ID_perfil, ID_permissao)
```

---

### 3.16 Bloco: Auditoria

```
registro_auditoria
├── ID_registro_auditoria  INT PK auto_increment
├── ID_usuario             INT FK NOT NULL
├── data_hora              TIMESTAMP NOT NULL
├── acao                   VARCHAR NOT NULL   ← 'CRIAR', 'ALTERAR', 'EXCLUIR', 'DESATIVAR'
├── entidade               VARCHAR NOT NULL   ← 'Produto', 'Remessa', etc.
├── ID_entidade_afetada    INT                ← ID do registro afetado
├── dados_anteriores       JSON               ← snapshot antes da alteração
└── dados_novos            JSON               ← snapshot depois da alteração
```

Regra crítica:
- **Registros de entrada confirmados e baixas finalizadas NÃO podem ser excluídos** (RN004)
- Devem ser estornados via lançamento de **ajuste com justificativa**

---

### 3.17 Bloco: Mural de Mensagens

```
mensagem_mural
├── ID_mensagem_mural      INT PK auto_increment
├── ID_usuario             INT FK NOT NULL    ← quem publicou
├── titulo                 VARCHAR
├── conteudo               TEXT NOT NULL
├── data_publicacao        TIMESTAMP NOT NULL
├── data_expiracao         TIMESTAMP NULL
└── ativo                  BOOLEAN DEFAULT TRUE
```

---

### 3.18 Bloco: Relatórios (Conceitual)

Não é uma tabela — é uma funcionalidade de consulta. Os relatórios previstos:

| Relatório | Filtros |
|-----------|---------|
| Movimentação de Estoque | Período, produto, tipo de movimentação |
| Expedições por Período | Data, rota, destinatário, condutor |
| Entregas por Instituição | Destinatário, período, status |
| Produtos Próximos ao Vencimento | Dias para vencer, lote |
| Níveis de Estoque (mínimo/crítico) | Produto, localização |
| Auditoria | Usuário, período, entidade, ação |
| Consolidado Semestral | Movimentações agregadas (6 em 6 meses) |

---

## 4. Regras de Negócio (Consolidadas)

| ID | Regra | Prioridade |
|----|-------|-----------|
| RN001 | **Bloqueio por Falta de Estoque:** Uma remessa não pode ser liberada com status "Saiu para Entrega" se o produto não possuir `saldo_disponivel` suficiente | Essencial |
| RN002 | **Saída Prioritária FIFO/PEPS:** Ao alocar produtos perecíveis a uma remessa, selecionar obrigatoriamente o lote com data de validade mais próxima | Essencial |
| RN003 | **Pendência em Entrega Parcial:** Baixa parcial gera registro automático de pendência vinculado ao destinatário | Essencial |
| RN004 | **Imutabilidade de Histórico:** Entradas confirmadas e baixas finalizadas não podem ser excluídas — apenas estornadas via ajuste com justificativa | Essencial |
| RN005 | **Aprovação de Ajuste de Inventário:** Diferenças detectadas em inventário não geram ajuste automático — toda alteração no saldo precisa de aprovação manual de usuário com permissão `inventario.aprovar_ajuste` | Essencial |

---

## 5. Requisitos Não Funcionais (Consolidados)

| ID | Requisito | Categoria | Prioridade |
|----|-----------|-----------|------------|
| RNF001 | **Arquitetura Desktop Web:** Aplicação web conectada a SGBD MySQL | Arquitetura | Essencial |
| RNF002 | **Desempenho:** Busca por código de barras ou Kanban < 2 segundos em rede local | Desempenho | Essencial |
| RNF003 | **Usabilidade:** Interface simples e intuitiva para operadores de almoxarifado | Usabilidade | Essencial |
| RNF004 | **Segurança/Perfis:** Acesso filtrado dinamicamente conforme perfil autenticado | Segurança | Essencial |
| RNF005 | **Backup/Integridade:** Consistência referencial + rotinas de backup | Confiabilidade | Essencial |