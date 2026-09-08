# Entendimento do Projeto — Nexus

> Sistema de Controle de Estoque e Logística de Remessas
> Projeto Final FAETEC — Turma Técnico em Informática 2026

---

## 1. Visão Geral

### 1.1 O Problema

O galpão logístico controla a distribuição de materiais de higiene, limpeza, papelaria e didáticos para **105 a 108 escolas e creches municipais**.

Atualmente, o fluxo é manual:

1. **Jonathan** (operador do galpão) conta o estoque **na mão** (papel + Excel) e envia para a administração
2. A **administração** informa as escolas sobre os produtos disponíveis
3. As **escolas** fazem suas solicitações (pedidos) e enviam para a administração
4. A **administração** repassa os pedidos em **papel (físico)** para o Jonathan
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

| Perfil | Pessoa | Acesso | Permissões |
|--------|--------|--------|------------|
| **Super Admin** | Felipe | Completo: config, usuários, auditoria, relatórios gerenciais | Flag `super_admin` — burla toda checagem |
| **Operador do Galpão** | Jonathan | Recebimento, conferência (leitor código de barras), montagem de remessas, kanban | Perfil "Operador" aplicado + individuais |
| **Auxiliar Administrativo** | "Menina da Baixa" | Baixa de notas, consumo interno, inventário, documentos fiscais | Perfil "Auxiliar" aplicado + individuais |

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
  - COD_ESCOLA       → código da escola/creche
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
├── cnpj                VARCHAR UNIQUE NULL  ← opcional (nem sempre fornecido)
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
├── foto_url              VARCHAR
├── perecivel             BOOLEAN DEFAULT FALSE
├── composto              BOOLEAN DEFAULT FALSE
├── data_validade         DATE NULL                 ← controlado manualmente, menor validade
├── ID_conversao_padrao   INT FK NULL
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

### 3.7 Bloco: Estoque

```
estoque (saldo real — controle de quantidade)
├── ID_estoque            INT PK auto_increment
├── ID_produto            INT FK NOT NULL
├── quantidade_atual      DECIMAL NOT NULL          ← saldo físico real no galpão
├── saldo_reservado       DECIMAL NOT NULL DEFAULT 0 ← comprometido em notas abertas
├── data_entrada          DATE NOT NULL
└── ativo                 BOOLEAN DEFAULT TRUE
```

**Cálculo importante (não armazenado, calculado em tempo real):**

```
saldo_disponivel = quantidade_atual - saldo_reservado
```

Regras:
- Produtos perecíveis possuem `data_validade` no cadastro do produto (menor validade disponível)
- Quando faltam 90, 60, 45 e 30 dias para o vencimento, o sistema cria automaticamente uma `mensagem_mural` de alerta
- A data de validade é controlada manualmente pelo Jonathan — ele atualiza conforme necessário
- Produtos não perecíveis têm o campo desabilitado

#### 3.7.1 Fluxo de Estoque

| Momento | Ação | Impacto |
|---------|------|---------|
| Entrada de mercadoria | Cria/atualiza `estoque` | `quantidade_atual += X` |
| Cria Nota Saída | Reserva | `saldo_reservado += X` |
| Cancelamento de Nota | Libera reserva | `saldo_reservado -= X` |
| Remessa finalizada (total/parcial) | Baixa definitiva | `quantidade_atual -= X` E `saldo_reservado -= X` |
| Remessa pendente | Reserva permanece | Aguarda nova tentativa |
| Desmontagem de composto | Baixa pai + entrada filhos | Vide 3.6.2 |
| Ajuste de inventário | Acerto manual | `quantidade_atual = novo_valor` |

---

### 3.8 Bloco: Movimentação de Estoque

Registro de auditoria de toda alteração no saldo do estoque. **Não possui tipo próprio** — o tipo é inferido pelas FKs e pelo tipo da nota origem.

```
movimentacao_estoque
├── ID_movimentacao       INT PK auto_increment
├── ID_estoque            INT FK NOT NULL
├── ID_usuario            INT FK NOT NULL
├── quantidade            DECIMAL NOT NULL         ← positivo = entrada, negativo = saída
├── saldo_anterior        DECIMAL                  ← snapshot do quantidade_atual antes
├── saldo_posterior       DECIMAL                  ← snapshot do quantidade_atual depois
├── reserva_anterior      DECIMAL                  ← snapshot do saldo_reservado antes
├── reserva_posterior     DECIMAL                  ← snapshot do saldo_reservado depois
├── ID_nota_entrada       INT FK NULL              ← veio de uma nota de entrada
├── ID_nota_saida         INT FK NULL              ← veio de uma nota de saída
├── ID_remessa            INT FK NULL              ← veio de uma remessa
├── data_hora             TIMESTAMP NOT NULL
└── observacao            TEXT
```

**Como o tipo é inferido na consulta:**

| FKs preenchidas | Tipo inferido |
|----------------|---------------|
| `ID_nota_entrada` + nota_entrada.tipo = 'ENTRADA' | Entrada de mercadoria |
| `ID_nota_entrada` + nota_entrada.tipo = 'DESMONTAGEM' | Entrada de insumos |
| `ID_nota_saida` + nota_saida.tipo = 'SAIDA' + `ID_remessa` | Saída por entrega |
| `ID_nota_saida` + nota_saida.tipo = 'SAIDA' + sem `ID_remessa` com qtd > 0 | Reserva |
| `ID_nota_saida` + nota_saida.tipo = 'SAIDA' + sem `ID_remessa` com qtd < 0 | Liberação de reserva |
| `ID_nota_saida` + nota_saida.tipo = 'CONSUMO_INTERNO' | Baixa por consumo |
| `ID_nota_saida` + nota_saida.tipo = 'AVARIA' | Baixa por avaria |
| `ID_nota_saida` + nota_saida.tipo = 'DESMONTAGEM' | Baixa do produto composto |
| Nenhuma (apenas dados anteriores/posteriores diferentes) | Ajuste de inventário |

#### 3.8.1 Correção de Notas (Regra de Editabilidade)

Notas de entrada e saída **podem ser editadas** após confirmadas, mas toda edição gera rastro automático no `registro_auditoria` e uma `movimentacao_estoque` corretiva.

**Fluxo de correção de Nota Entrada:**
```
Usuário edita item_nota_entrada.quantidade de 10 para 15
  ↓
1. registro_auditoria: { entidade: 'ItemNotaEntrada',
     dados_anteriores: {quantidade: 10},
     dados_novos: {quantidade: 15} }
  ↓
2. movimentacao_estoque: { tipo: CORRECAO_ENTRADA,
     ID_nota_entrada, ID_estoque,
     quantidade: +5,
     saldo_anterior: 10, saldo_posterior: 15 }
  ↓
3. estoque.quantidade_atual += 5
```

**Fluxo de correção de Nota Saída:**
```
Usuário edita item_nota_saida.qtd_esperada de 20 para 15
  ↓
1. registro_auditoria captura antes/depois
  ↓
2. movimentacao_estoque: { tipo: CORRECAO_SAIDA,
     ID_nota_saida, ID_estoque,
     quantidade: -5,
     saldo_reservado_anterior: 20, saldo_reservado_posterior: 15 }
  ↓
3. estoque.saldo_reservado -= 5
```

Regras:
- `registro_auditoria` sempre captura snapshots antes/depois em JSON
- `movimentacao_estoque` calcula a diferença e aplica ao saldo automaticamente
- Se o item editado já teve parte entregue, a correção só afeta o saldo disponível (`qtd_esperada - qtd_entregue`)
- Itens com `qtd_entregue > 0` não podem ter `qtd_esperada` reduzida para menos do que já foi entregue

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
├── ID_estoque            INT FK NOT NULL
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
├── ID_estoque            INT FK NOT NULL
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

### 3.11 Bloco: Pedido, Nota Saída, Remessa e Coleta

#### 3.11.0 Pedido da Escola (Solicitação)

Representa o pedido que chega em **papel** da administração e é registrado no sistema. Ainda não reserva estoque — é apenas a solicitação.

```
pedido_escola
├── ID_pedido_escola        INT PK auto_increment
├── ID_destinatario         INT FK NOT NULL
├── data_criacao            TIMESTAMP NOT NULL
├── status                  ENUM('PENDENTE','CONFIRMADO','RECUSADO')
├── observacao              TEXT
└── ativo                   BOOLEAN DEFAULT TRUE

item_pedido_escola
├── ID_item_pedido_escola   INT PK auto_increment
├── ID_pedido_escola        INT FK NOT NULL
├── ID_produto              INT FK NOT NULL
├── quantidade              DECIMAL NOT NULL
└── observacao              TEXT
```

Regras:
- O pedido é apenas a solicitação — **não reserva estoque**
- Ao confirmar, o sistema **valida o estoque** (avisa se não tiver saldo, mas permite seguir)
- Ao confirmar, gera automaticamente uma `nota_saida` com os mesmos itens
- Um pedido RECUSADO não gera nota

#### 3.11.1 Nota Saída (Compromisso Oficial)

Representa o compromisso de entrega. Ao ser criada, **reserva o estoque**.

```
nota_saida
├── ID_nota_saida           INT PK auto_increment
├── ID_pedido_escola        INT FK NULL
├── ID_destinatario         INT FK NOT NULL
├── data_criacao            TIMESTAMP NOT NULL
├── tipo                    ENUM('SAIDA','DESMONTAGEM','CONSUMO_INTERNO','AVARIA')
├── status                  ENUM(
                              'ABERTA',
                              'EM_ANDAMENTO',
                              'BAIXA_TOTAL',
                              'BAIXA_PARCIAL',
                              'BAIXA_COM_CORTE',
                              'CANCELADA'
                            )
├── observacao              TEXT
└── ativo                   BOOLEAN DEFAULT TRUE

item_nota_saida
├── ID_item_nota_saida      INT PK auto_increment
├── ID_nota_saida           INT FK NOT NULL
├── ID_estoque              INT FK NOT NULL
├── qtd_esperada            DECIMAL NOT NULL
├── qtd_entregue            DECIMAL NOT NULL DEFAULT 0
└── observacao              TEXT
```

Regras:
- Ao criar `item_nota_saida`, o **estoque é reservado** (`saldo_reservado += qtd_esperada`)
- `qtd_entregue` é atualizado automaticamente conforme remessas e coletas são finalizadas
- Se a nota for cancelada, a **reserva é liberada** (`saldo_reservado -= qtd_esperada`)
- A nota pode gerar **várias remessas** e/ou **coletas**
- Status: ABERTA (criada), EM_ANDAMENTO (entregas em curso), BAIXA_TOTAL (tudo entregue), BAIXA_PARCIAL (parte entregue, resto vai), BAIXA_COM_CORTE (parte entregue, resto não vai), CANCELADA (nada entregue)

#### 3.11.2 Remessa (Entrega via Rota)

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
├── ID_estoque            INT FK NOT NULL
├── quantidade_solicitada  DECIMAL NOT NULL
├── quantidade_separada    DECIMAL
├── quantidade_entregue    DECIMAL
```

Regras:
- Quando FINALIZADO_PARCIAL, sistema cria automaticamente nova remessa PENDENTE para itens restantes (split)
- Remessa PENDENTE pode ser realocada em outra rota

#### 3.11.3 Coleta (Retirada Direta na Escola)

Representa retirada presencial por urgência — sem rota, sem condutor, sem veículo.

```
coleta
├── ID_coleta               INT PK auto_increment
├── ID_nota_saida           INT FK NOT NULL
├── ID_destinatario         INT FK NOT NULL
├── data_criacao            TIMESTAMP NOT NULL
└── observacao              TEXT

item_coleta
├── ID_item_coleta          INT PK auto_increment
├── ID_coleta               INT FK NOT NULL
├── ID_estoque              INT FK NOT NULL
├── quantidade              DECIMAL NOT NULL
```

Regras:
- Chegou e pegou — sem agendamento, sem status
- Ao registrar, `item_nota_saida.qtd_entregue` é atualizado e o estoque dá baixa

#### 3.11.4 Rota × Remessa (N:N com ordem)

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
│  ┌─────┴──────────┐                                     │
│  ▼                 ▼                                     │
│  Sucesso          Falha                                  │
│  ↓                 ↓                                     │
│  FINALIZADO_TOTAL PENDENTE                               │
│  (baixa real do   (reserva mantida, pode                 │
│   estoque)         criar nova remessa)                   │
│                                                          │
│  Entrega Parcial:                                         │
│  ┌──────────────────────────────────┐                    │
│  │  Remessa com 10 itens           │                    │
│  │  ↓                               │                    │
│  │  Entrega 6 itens                │                    │
│  │  ↓                               │                    │
│  │  SPLIT:                          │                    │
│  │  ├── Remessa A (6 itens) →      │                    │
│  │  │   FINALIZADO_PARCIAL          │                    │
│  │  │   (baixa no estoque)          │                    │
│  │  └── Remessa B (4 itens) →      │                    │
│  │      PENDENTE (nova remessa,     │                    │
│  │      mesma nota_saida, pode      │                    │
│  │      entrar em outra rota)       │                    │
│  └──────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

---

### 3.12 Bloco: Nota de Entrada

Gerencia o recebimento de mercadorias de fornecedores (com ou sem nota fiscal vinculada).

```
nota_entrada
├── ID_nota_entrada       INT PK auto_increment
├── ID_fornecedor         INT FK → fornecedor NULL  ← opcional
├── data_criacao          TIMESTAMP NOT NULL
├── tipo                  ENUM('ENTRADA','DESMONTAGEM')
├── data_recebimento      DATE
├── observacao            TEXT
└── ativo                 BOOLEAN DEFAULT TRUE

nota_entrada_chave_acesso   ← opcional, 0 ou mais chaves NF-e
├── ID_nota_entrada       INT FK NOT NULL
├── chave_acesso          VARCHAR(44) UNIQUE NOT NULL
└── PRIMARY KEY (ID_nota_entrada, chave_acesso)

item_nota_entrada
├── ID_item_nota_entrada  INT PK auto_increment
├── ID_nota_entrada       INT FK NOT NULL
├── ID_produto            INT FK NOT NULL
├── ID_conversao          INT FK → conversao_unidade NULL
├── quantidade            DECIMAL NOT NULL         ← qtd recebida (ex: 10 caixas)
├── quantidade_convertida DECIMAL NOT NULL         ← qtd * fator (ex: 10 * 20 = 200)
└── observacao            TEXT
```

Regras:
- A entrada pode ser feita **com ou sem** chave de acesso de NF-e
- A chave de acesso, quando informada, deve ser uma chave válida de NF-e (44 caracteres)
- A conversão de unidade é aplicada no momento da entrada
- Fornecedor é opcional — produtos de limpeza que chegam sem documento podem ter entrada sem fornecedor
- Ao confirmar a entrada, o sistema:
  1. Cria/atualiza `estoque` com `quantidade_atual += quantidade_convertida`
  2. Cria `movimentacao_estoque` tipo `ENTRADA`
- `data_validade` (quando aplicável) é atualizada manualmente no cadastro do produto pelo Jonathan

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

### 3.15 Bloco: Perfil e Permissões

#### 3.15.1 Permissões (Seed Fixo)

As permissões são **fixas e pré-definidas** no sistema — o administrador não pode criar novas. Cada permissão segue a nomenclatura `entidade.acao` (ex: `produto.criar`, `estoque.ver_saldo`).

```
permissao
├── ID_permissao           INT PK auto_increment
├── nome                   VARCHAR NOT NULL UNIQUE   ← ex: "produto.criar"
├── descricao              TEXT
└── ativo                  BOOLEAN DEFAULT TRUE
```

Permissões do MVP:

| Entidade | Ações CRUD |
|----------|-----------|
| `usuario` | criar, alterar, consultar, desativar |
| `funcionario` | criar, alterar, consultar, desativar |
| `destinatario` | criar, alterar, consultar, desativar |
| `fornecedor` | criar, alterar, consultar, desativar |
| `condutor` | criar, alterar, consultar, desativar |
| `veiculo` | criar, alterar, consultar, desativar |
| `produto` | criar, alterar, consultar, desativar |
| `estoque` | entrada, saida, ver_saldo |
| `nota_entrada` | criar, alterar, consultar, cancelar |
| `nota_saida` | criar, alterar, consultar, cancelar |
| `remessa` | criar, alterar_status, finalizar |
| `inventario` | abrir, contar, aprovar_ajuste, ver_contagem_cega |
| `relatorio` | gerar |
| `perfil` | criar, alterar, consultar, desativar |
| `mural` | criar, alterar, excluir |

#### 3.15.2 Perfil (Template)

Perfil é um **template** de permissões. Pode ser aplicado a um usuário para copiar as permissões do perfil para o usuário. **Não mantém vínculo** entre perfil e usuário após a aplicação.

```
perfil
├── ID_perfil              INT PK auto_increment
├── nome                   VARCHAR NOT NULL UNIQUE
├── descricao              TEXT
└── ativo                  BOOLEAN DEFAULT TRUE

perfil_permissao           ← N:N template → permissões
├── ID_perfil              INT FK
├── ID_permissao           INT FK
└── PRIMARY KEY (ID_perfil, ID_permissao)
```

Regras:
- Perfis podem ser **criados, alterados e excluídos** livremente pelo admin
- Alterar um perfil **não afeta** usuários que já tiveram o perfil aplicado anteriormente
- **Não há auditoria** de alterações em perfis

#### 3.15.3 Super Admin

O Super Admin é um usuário especial, não um perfil.

- Criado no **primeiro startup** do sistema — o sistema solicita a criação do funcionário e do usuário admin
- Possui a flag `super_admin` no registro de `usuario`, invisível na interface
- **Burla toda checagem de permissão** automaticamente — qualquer middleware de verificação deixa passar
- Não aparece no menu de configuração de permissões
- Pode haver **apenas um** usuário Super Admin

```
usuario (atualizado)
├── ID_usuario             INT PK auto_increment
├── ID_funcionario         INT FK UNIQUE NOT NULL
├── login                  VARCHAR NOT NULL UNIQUE
├── senha_hash             VARCHAR NOT NULL
├── super_admin            BOOLEAN DEFAULT FALSE   ← flag invisível, burla permissões
├── ultimo_acesso          TIMESTAMP NULL
└── ativo                  BOOLEAN DEFAULT TRUE
```

#### 3.15.4 Permissões do Usuário Individual

Cada usuário pode ter permissões individuais (concedidas diretamente ou copiadas de um perfil-template).

```
usuario_permissao
├── ID_usuario             INT FK
├── ID_permissao           INT FK
├── PRIMARY KEY (ID_usuario, ID_permissao)
```

#### 3.15.5 Fluxo de Aplicação de Template

```
Admin seleciona perfil "Operador" → clica "Aplicar a João"
  ↓
Sistema copia TODAS as permissões do perfil para usuario_permissao do João
  ↓
Se João já tinha permissões anteriores, elas são SUBSTITUÍDAS
✅ João agora tem exatamente as permissões do perfil "Operador"
🔧 Admin pode adicionar/remover permissões individuais depois
```

Regras:
- Aplicar um perfil **substitui completamente** as permissões atuais do usuário
- Após aplicar o perfil, o admin pode **adicionar ou remover** permissões individuais manualmente
- Toda alteração em `usuario_permissao` (conceder/remover) é registrada em `registro_auditoria`

#### 3.15.6 Entidades sem Proteção de Permissão

As seguintes entidades **não exigem permissão** para acesso, pois são dados operacionais ou de suporte:

- `conversao_unidade` — livre
- `tipo_codigo` — livre
- `rota`, `percurso` — livre
- `endereco` — vinculado à entidade que o possui
- `telefone`, `email` — vinculado à entidade que os possui

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
| RN002 | **Alerta de Validade:** O sistema deve notificar automaticamente no mural de mensagens quando produtos perecíveis estiverem a 90, 60, 45 e 30 dias do vencimento, com base na `data_validade` do cadastro do produto | Essencial |
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