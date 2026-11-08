# Entendimento do Projeto — Nexus

> Sistema de Controle de Estoque e Logística de Entregas
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
- **Cadastro de Produtos** — com fotos, validade e composição
- **Pedidos e Notas de Saída** — transcrição dos pedidos em papel; o pedido aprovado é importado na Saída e gera uma nota
- **Reserva de Estoque** — ao criar uma nota de saída com itens, o sistema reserva os produtos no estoque
- **Entregas** — notas de saída com destinatário, itens e status de entrega
- **Expedições** — organização diária das entregas em ordem de visita (com suporte a templates)
- **Auditoria** — registro de toda ação feita no sistema
- **Relatórios** — periódicos (diário, mensal, semestral)

### 1.3 Perfis de Usuário

| Perfil | Pessoa | Acesso | Permissões |
|--------|--------|--------|------------|
| **Super Admin** | Felipe | Completo: config, usuários, auditoria, relatórios gerenciais | Flag `super_admin` — burla toda checagem |
| **Operador do Galpão** | Jonathan | Recebimento, conferência (leitor código de barras), montagem de saídas, kanban | Perfil "Operador" aplicado + individuais |
| **Auxiliar Administrativo** | "Menina da Baixa" | Baixa de notas, consumo interno, inventário, documentos fiscais | Perfil "Auxiliar" aplicado + individuais |

### 1.4 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Stack** | Next.js 16 (App Router) — Full Stack |
| **ORM** | Prisma 7 |
| **Banco de Dados** | MySQL/MariaDB (driver `@prisma/adapter-mariadb`) |
| **Autenticação** | Feita na mão (bcrypt + JWT via biblioteca `jose`, HS256) |
| **Versionamento** | GitHub |


---

## 2. Estrutura do Projeto

```
projetofinalfaetec/
├── src/
│   ├── app/               # App Router: páginas, layouts e Server Actions (um diretório por módulo)
│   ├── components/        # Componentes React reutilizáveis
│   ├── dao/               # Data Access Objects (Prisma queries)
│   ├── services/          # Lógica de negócio
│   ├── lib/               # Utilitários e helpers
│   ├── types/             # Interfaces e tipos TypeScript
│   └── proxy.ts           # Proteção das rotas privadas (sessão)
├── prisma/
│   ├── schema.prisma      # Modelo de dados (51 entidades)
│   └── seed.ts            # Seed de referência
├── prisma.config.ts       # Configuração do Prisma 7
├── docs/                  # Documentação (ver docs/README.md)
│   ├── dominio/           # ENTENDIMENTO, REGRAS_NEGOCIO, REQUISITOS_*, IMPLEMENTACAO
│   ├── processo/          # VERSIONAMENTO, JIRA, WORKFLOW
│   └── diagramas/         # classes.puml, DER.puml, fluxo_atual.puml, fluxosAtuais/
├── tests/                 # Testes automatizados (Vitest)
├── scripts/               # Scripts de apoio ao workflow
├── tools/                 # Ferramental (exportação para o Figma)
├── public/                # Arquivos estáticos
├── next.config.ts         # Configuração do Next.js
├── package.json
└── tsconfig.json
```

> O projeto **não versiona migrations**: o schema é aplicado ao banco com `prisma db push`
> (`npm run db:push` / `npm run db:setup`), não com `prisma migrate`.

---

## 3. Modelo de Dados

### 3.1 Convenções

- **IDs**: Auto-increment INT (`ID_entidade` como PK)
- **Soft Delete**: Toda entidade de cadastro possui campo `ativo: Boolean`
- **Hard Delete é proibido**: nada pode ser excluído fisicamente, apenas desativado
- **Nomenclatura DB**: `snake_case`
- **Nomenclatura TS**: `camelCase`
- **Tipos numéricos**: quantidades, saldos, fatores de conversão e coordenadas são `Float`
  no schema Prisma (`DOUBLE` no MySQL); este documento os escreve como `FLOAT`

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
  - COD_ESCOLA       → código da escola/creche/CMEI/CMEIA
  - MATRICULA        → matrícula funcional do funcionário
```

Tabelas de códigos (uma por entidade que precisa):

```
produto_codigo        → ID_produto FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
destinatario_codigo   → ID_destinatario FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
fornecedor_codigo     → ID_fornecedor FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
funcionario_codigo    → ID_funcionario FK, ID_tipo_codigo FK, codigo VARCHAR UNIQUE
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
├── condutor            BOOLEAN DEFAULT FALSE   ← flag: o funcionário pode dirigir
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- Todo funcionário É uma pessoa física
- Nem toda pessoa física é funcionário
- FK 1:1 garante que cada PF pode ter no máximo um funcionário
- **Ser condutor é uma flag do próprio funcionário** (`funcionario.condutor`) — não existe
  tabela `condutor`, nem dados de CNH no modelo. A expedição aponta para o funcionário
  condutor pela FK obrigatória `expedicao.ID_funcionario_condutor → funcionario`
- **Foto:** o funcionário tem **uma foto no cadastro**, guardada como `anexo` com
  `ID_funcionario` (dono único) — não há coluna de foto em `funcionario`. A foto é opcional,
  aparece no formulário e na visualização e segue as regras de §3.14

#### 3.3.2 Usuário (1:1 com Funcionário — opcional)

```
usuario
├── ID_usuario          INT PK auto_increment
├── ID_funcionario      INT FK UNIQUE NOT NULL  ← só pode ser funcionário
├── login               VARCHAR NOT NULL UNIQUE
├── senha_hash          VARCHAR NULL              ← nulo até o primeiro acesso definir a senha
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- **Todo usuário DEVE ser um funcionário cadastrado**
- Nem todo funcionário é usuário (ex: motorista só aparece nas expedições, sem login)
- FK 1:1 para Funcionario — um funcionário pode ter no máximo um usuário
- `senha_hash` é **nullable**: o usuário é criado sem senha e o campo só é preenchido no
  fluxo de definição de senha (primeiro acesso ou redefinição). Enquanto for nulo, o login
  é recusado e o sistema encaminha o usuário para definir a senha

#### 3.3.3 Condutor — flag do funcionário (não é entidade)

Não existe tabela `condutor`. O papel de condutor é a flag booleana
`funcionario.condutor` (default `FALSE`), marcada no cadastro do funcionário; a expedição
guarda **quem** dirigiu em `expedicao.ID_funcionario_condutor`, uma FK obrigatória para
`funcionario`:

```
expedicao
├── ID_funcionario_condutor  INT FK → funcionario NOT NULL   ← quem dirigiu a entrega
```

Regras:
- Só um funcionário cadastrado, **ativo e marcado como `condutor`** pode ser condutor de uma
  expedição
- Um funcionário pode ou não estar marcado como condutor
- Não há atributos próprios de condutor (CNH, categoria, validade) no modelo

#### 3.3.4 Fornecedor (1:1 com Pessoa Jurídica)

```
fornecedor
├── ID_fornecedor          INT PK auto_increment
├── ID_pessoa_juridica     INT FK UNIQUE NOT NULL
├── ID_endereco            INT FK → endereco NULL  ← opcional
└── ativo                  BOOLEAN DEFAULT TRUE
```

#### 3.3.5 Destinatário (1:1 com Pessoa Jurídica)

```
destinatario
├── ID_destinatario        INT PK auto_increment
├── ID_pessoa_juridica     INT FK UNIQUE NOT NULL
├── ID_tipo_destinatario   INT FK → tipo_destinatario NULL  ← opcional
├── ID_endereco            INT FK → endereco NOT NULL  ← obrigatório
└── ativo                  BOOLEAN DEFAULT TRUE

tipo_destinatario
├── ID_tipo_destinatario   INT PK auto_increment
├── codigo                 VARCHAR(191) UNIQUE NOT NULL  ← imutável
├── nome                   VARCHAR(191) UNIQUE NOT NULL  ← editável
└── padrao                 BOOLEAN DEFAULT FALSE  ← no máximo um
```

O tipo de destinatário é **cadastro editável** (não enum): criar, editar e excluir
fisicamente; a exclusão deixa os destinatários sem tipo (`ON DELETE SET NULL`). No
máximo um tipo é padrão, aplicado como seleção inicial de um novo destinatário; o campo é
opcional e pode ser limpo a qualquer momento. O seed cria Escola/Creche/CMEI/CMEIA somente
quando o cadastro está vazio, com Escola como padrão.

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
├── uf                  CHAR(2)                    ← opcional
└── cep                 VARCHAR
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
├── perecivel             BOOLEAN DEFAULT FALSE
├── composto              BOOLEAN DEFAULT FALSE
├── data_validade         DATE NULL                 ← controlado manualmente, menor validade
├── ID_conversao_padrao   INT FK NOT NULL DEFAULT 1 ← Conversão Padrão de Entrada (auxílio da entrada)
├── ID_conversao_saida    INT FK NOT NULL DEFAULT 1 ← Unidade Padrão de Saída (usada só em Remessa)
├── saldo                 FLOAT NOT NULL DEFAULT 0  ← saldo real do produto
├── saldo_reservado       FLOAT NOT NULL DEFAULT 0  ← comprometido por notas de saída com saldo a entregar
└── ativo                 BOOLEAN DEFAULT TRUE
```

O **produto é dono do saldo**: não existe tabela/linha de estoque nem lote. Todo produto tem
`saldo`/`saldo_reservado` desde a criação (zero) e `saldo_disponivel = saldo − saldo_reservado`
(vide §3.7). O campo `ativo` é o que a listagem filtra por padrão (só ativos); a permissão
`produto.ver_inativos` libera a visão de inativos apenas na listagem/busca e no detalhe/edição
por ID (§3.15.1).

**Flags removidas:** fracionado, porGrade, localizacao_fisica, gtin (gtin agora é código personalizado)

**Foto:** o produto tem **uma foto no cadastro**, guardada como `anexo` com `ID_produto`
(dono único) — `produto.foto_url` **não existe mais**. O usuário faz upload no formulário
(JPG/PNG/WEBP, ≤ 5 MB) ou informa uma URL externa; a imagem é validada, redimensionada (máx.
1024px) e convertida para **WEBP** (qualidade 80) via `sharp`, gravada em
`public/uploads/produtos/{ID_produto}/{timestamp}-{hash}.webp` e registrada em `anexo`
(`url` relativa, `ativo = true`). A gravação do anexo acontece **na mesma transação** do
cadastro; se a transação falhar, o arquivo recém-gravado é removido do disco. Trocar a foto
desativa o anexo anterior e apaga o arquivo antigo **somente depois do commit**. Ver §3.14.

#### 3.6.1 Conversão de Unidades (entrada e saída)

Tabela standalone (não vinculada a um produto específico):

```
conversao_unidade
├── ID_conversao       INT PK auto_increment
├── nome               VARCHAR NOT NULL UNIQUE  ← nome livre (o seed cria UNIDADE, PCT10 e CX50)
├── fator              FLOAT NOT NULL          ← 1, 10, 50 no seed
├── descricao          VARCHAR
└── padrao             BOOLEAN NOT NULL DEFAULT FALSE  ← exatamente uma TRUE (UNIDADE)
```

Regras:
- O nome é livre — o cliente cria conforme necessidade (ex: "CX50" com fator 50)
- A conversão é **auxílio de lançamento**, nunca a unidade do produto ou do saldo: o fator
  multiplica a quantidade digitada para obter o **total** que entra no estoque (ex.: 10 × 20
  = 200), e o saldo do produto, a reserva, a baixa e a movimentação ficam em **base** — `UNIDADE`, fator 1
- **A nota não guarda conversão:** `item_nota_entrada.quantidade` é o total que entra no
  saldo e `item_nota_saida` guarda só `qtd_esperada`/`qtd_entregue`; nome e fator existem
  apenas na tabela `conversao_unidade` e nos vínculos do produto
- O produto tem **dois** vínculos obrigatórios com `conversao_unidade`:
  - `ID_conversao_padrao` — **Conversão Padrão de Entrada**, auxílio do lançamento de
    entrada; quando o formulário não informa, o cadastro grava a unidade padrão do sistema
    (UNIDADE/1, economiza cliques)
  - `ID_conversao_saida` — **Unidade Padrão de Saída**, auxílio **somente** em notas de saída
    do tipo Remessa (`SAIDA`), para a transferência às escolas; quando não informada, também
    assume a unidade padrão (UNIDADE/1)
- Ao lançar uma entrada ou uma Remessa, o item novo já vem com a conversão do produto
  (entrada ou saída) como auxílio; o usuário pode trocar a conversão/fator na tela e o
  sistema grava o total
- O fator pode ser editado manualmente no lançamento **sem alterar o template**
- Unidades **não são desativadas**: podem ser criadas, editadas e excluídas fisicamente
- Existe **exatamente uma** unidade com `padrao = TRUE` — a `UNIDADE` (fator 1). Ela não
  pode ser excluída nem ter nome ou fator alterados; somente a descrição é editável
- Ao excluir uma unidade que não é a padrão, os produtos que a usavam são **revinculados à
  unidade padrão nos dois campos** (`ID_conversao_padrao` e `ID_conversao_saida`) — as FKs
  são obrigatórias, então não há desvinculação e a exclusão não é recusada por uso; a
  auditoria registra o total de produtos afetados e a quebra por entrada/saída
- Dashboard, relatórios, listagens e seletores **não exibem unidade**: os saldos são base e
  aparecem como número, sem o nome da conversão padrão

#### 3.6.2 Produto Composto (BOM — Bill of Materials)

```
produto_insumo
├── ID_produto_insumo   INT PK auto_increment
├── ID_produto_pai      INT FK → produto    ← ex: "Kit Escolar"
├── ID_produto_filho    INT FK → produto    ← ex: "Borracha Individual"
├── quantidade          FLOAT NOT NULL    ← ex: 20 (1 kit = 20 borrachas)
└── ativo               BOOLEAN DEFAULT TRUE
```

Regras:
- Os insumos (produtos-filho) **precisam estar cadastrados previamente**
- Um produto pai pode ter **múltiplos insumos** (ex: Kit Escolar = cola + lápis + borracha + caneta)
- Um produto filho pode estar em **vários produtos pai**
- A flag `composto` só é marcada se houver necessidade real de desmontar aquele produto
- **Fluxo de desmontagem:** ao selecionar "desmontar" no sistema:
  1. Dá baixa no saldo do produto pai (`produto.saldo -= X`)
  2. Gera entrada no saldo de cada filho (`produto.saldo += X * quantidade_insumo`)
  3. Registra as movimentações correspondentes (baixa do pai e entrada dos filhos) — sem
     coluna de tipo: a natureza é inferida pelas notas (`tipo = 'DESMONTAGEM'`)

Implementação (`src/services/desmembramento.ts`): a operação parte do botão **Desmembrar**
na visualização do produto ou da ação condicional na listagem (só compostos ativos) e exige
`estoque.entrada` **e** `estoque.saida`. Na mesma transação, cria a `nota_saida`
`DESMONTAGEM` `BAIXA_TOTAL` com um item do pai e a `nota_entrada` `DESMONTAGEM` com um item
por insumo ativo (repetidos são somados), registra as movimentações pelos totais e audita as
duas notas. O `saldo_reservado` não é alterado; saldo disponível insuficiente apenas avisa
(RN001; o saldo pode ficar negativo) e o bloqueio por inventário vale para o pai e para todos
os filhos. As notas `DESMONTAGEM` aparecem na lista de Entrada e são somente leitura.

---

### 3.7 Bloco: Saldo do Produto (estoque achatado)

**Não existe tabela `estoque` nem linha de estoque/lote.** O saldo mora em duas colunas do
próprio produto (vide §3.6):

```
produto
├── saldo                 FLOAT NOT NULL DEFAULT 0  ← saldo real no galpão
└── saldo_reservado       FLOAT NOT NULL DEFAULT 0  ← comprometido por notas de saída com saldo a entregar

*Cálculo do saldo disponível:*
saldo_disponivel = saldo - saldo_reservado
```

Todo produto tem saldo desde a criação (zero) — não há produto sem saldo, `data_entrada`
nem `ativo` de estoque. `produto.ativo` é a única referência de atividade. A data de entrada
não é guardada no saldo: ela é o histórico de `nota_entrada`/`movimentacao_estoque`.

`saldo` e `saldo_reservado` convivem no mesmo registro: a baixa física mexe no primeiro, a
reserva mexe no segundo (vide §3.8.1). As duas colunas estão sempre em **base** (`UNIDADE`,
fator 1) — a conversão de unidade atua só como auxílio no lançamento (entrada e Remessa, vide
§3.6.1).

A migração do modelo antigo consolidou as linhas **ativas** de `estoque` por produto
(`saldo = SUM(quantidade_atual)` e `saldo_reservado = SUM(saldo_reservado)`); produtos sem
linha ficaram com zero e os registros históricos (itens, reservas, movimentações, coleta e
inventário) passaram a apontar para `ID_produto`.

Enquanto um inventário está em andamento (`ABERTO`, `EM_CONTAGEM` ou
`AGUARDANDO_APROVACAO`), as operações de saldo dos produtos inventariados ficam bloqueadas —
entrada, saída (reserva, liberação, baixa e baixa direta), desmontagem e coleta. A exceção é a
movimentação de ajuste do próprio inventário (ver §3.9).

Regras:
- Produtos perecíveis possuem `data_validade` no cadastro do produto (menor validade disponível)
- Quando faltam 90, 60, 45 e 30 dias para o vencimento, o sistema cria automaticamente uma `mensagem_mural` de alerta
- A data de validade é controlada manualmente pelo Jonathan — ele atualiza conforme necessário
- Produtos não perecíveis têm o campo desabilitado

#### 3.7.1 Fluxo de Saldo

| Momento | Ação | Impacto |
|---------|------|---------|
| Entrada de mercadoria | Cria `movimentacao_estoque` ligada à nota de entrada (`ID_nota_entrada`) | `produto.saldo += total da entrada` |
| Criar Nota de Saída com itens | Cria `reserva_estoque` | `produto.saldo_reservado += X` |
| Cancelamento de Nota de Saída | Cria `reserva_estoque` negativa | `produto.saldo_reservado -= X` |
| Nota baixada (total/parcial/corte) | Baixa definitiva + libera reserva | `produto.saldo -= X` E `produto.saldo_reservado -= X` |
| Desmontagem de composto | Baixa pai + entrada filhos | Vide 3.6.2 |
| Ajuste de inventário | Acerto manual aprovado | `produto.saldo = novo_valor` |

---

### 3.8 Bloco: Movimentação de Estoque

Registro de auditoria de toda alteração no saldo do produto. **Não possui tipo próprio** — o tipo é inferido pelas FKs e pelo tipo da nota origem.

```
movimentacao_estoque
├── ID_movimentacao       INT PK auto_increment
├── ID_produto            INT FK NOT NULL
├── ID_usuario            INT FK NOT NULL
├── quantidade            FLOAT NOT NULL         ← positivo = entrada, negativo = saída
├── saldo_anterior        FLOAT                  ← snapshot do `produto.saldo` antes
├── saldo_posterior       FLOAT                  ← snapshot do `produto.saldo` depois
├── ID_nota_entrada       INT FK NULL              ← veio de uma nota de entrada
├── ID_nota_saida         INT FK NULL              ← veio de uma nota de saída (apenas baixas reais)
├── ID_ajuste_inventario  INT FK NULL              ← veio de um ajuste de inventário aprovado
├── data_hora             TIMESTAMP NOT NULL
└── observacao            TEXT
```

**Como o tipo é inferido na consulta:**

| FKs preenchidas | Tipo inferido |
|----------------|---------------|
| `ID_nota_entrada` + nota_entrada.tipo = 'ENTRADA' | Entrada de mercadoria |
| `ID_nota_entrada` + nota_entrada.tipo = 'DESMONTAGEM' | Entrada de insumos |
| `ID_nota_saida` + nota_saida.tipo = 'SAIDA' | Saída por entrega |
| `ID_nota_saida` + nota_saida.tipo = 'CONSUMO_INTERNO' | Baixa por consumo |
| `ID_nota_saida` + nota_saida.tipo = 'AVARIA' | Baixa por avaria |
| `ID_nota_saida` + nota_saida.tipo = 'DESMONTAGEM' | Baixa do produto composto |
| `ID_ajuste_inventario` | Ajuste de inventário aprovado |

#### 3.8.1 Reserva de Estoque (Auditoria Contábil)

Registra cada alteração no `produto.saldo_reservado` — reservas e liberações.

```
reserva_estoque
├── ID_reserva_estoque     INT PK auto_increment
├── ID_produto             INT FK NOT NULL
├── ID_nota_saida          INT FK NOT NULL
├── ID_usuario             INT FK NOT NULL
├── quantidade             FLOAT NOT NULL         ← positiva = reservou, negativa = liberou
├── saldo_anterior         FLOAT                  ← snapshot do `saldo_reservado` antes
├── saldo_posterior        FLOAT                  ← snapshot do `saldo_reservado` depois
├── data_hora              TIMESTAMP NOT NULL
└── observacao             TEXT
```

Regras:
- **Reservar:** criar a **nota de saída** com destinatário e itens (`item_nota_saida`) → insere `reserva_estoque` com `quantidade > 0` → `produto.saldo_reservado += X`
- **Liberar:** cancelar a nota → insere `reserva_estoque` com `quantidade < 0` → `produto.saldo_reservado -= X`; na baixa (total/parcial/corte) a reserva dos itens entregues também é liberada
- A reserva pertence **à própria nota de saída**, que carrega os itens e o destinatário — não existe mais um nível intermediário de remessa
- A consulta de saldo disponível usa `saldo_disponivel = saldo - saldo_reservado` (`saldo_reservado` está no `produto`, atualizado em tempo real)
- A `reserva_estoque` é a trilha de auditoria para conferência posterior

#### 3.8.2 Correção de Notas (Regra de Editabilidade)

Notas de entrada e saída **podem ser editadas** após confirmadas, mas toda edição gera rastro automático no `registro_auditoria` e a trilha correspondente (`movimentacao_estoque` ou `reserva_estoque`, conforme o caso).

```
Usuário edita item_nota_entrada.quantidade de 10 para 15
  ↓
1. registro_auditoria: { entidade: 'ItemNotaEntrada',
     dados_anteriores: {quantidade: 10},
     dados_novos: {quantidade: 15} }
  ↓
2. movimentacao_estoque: {
     ID_nota_entrada, ID_produto,
     quantidade: +5,
     saldo_anterior: 10, saldo_posterior: 15 }
  ↓
3. produto.saldo += 5
```

**Fluxo de correção da Nota de Saída (itens ainda não entregues):**
```
Usuário edita item_nota_saida.qtd_esperada de 20 para 15
  ↓
1. registro_auditoria captura antes/depois
  ↓
2. reserva_estoque: {
     ID_nota_saida, ID_produto,
     quantidade: -5,
     saldo_anterior: 20, saldo_posterior: 15 }
  ↓
3. produto.saldo_reservado -= 5
```

Regras:
- `registro_auditoria` sempre captura snapshots antes/depois em JSON
- Correção em nota de entrada: gera `movimentacao_estoque` (altera `produto.saldo`)
- Correção em nota de saída aberta: gera `reserva_estoque` (altera `produto.saldo_reservado`), pelo delta
- Correção em `item_nota_saida` de baixa interna (`CONSUMO_INTERNO`, `AVARIA`, `DESMONTAGEM`): gera `movimentacao_estoque` (altera `produto.saldo`)
- Se o item já teve parte entregue, a correção só afeta o saldo disponível (`qtd_esperada - qtd_entregue`)

---

### 3.9 Bloco: Inventário

```
inventario
├── ID_inventario           INT PK auto_increment
├── data_inicio             DATE NOT NULL
├── data_fim                DATE
├── contagem_cega           BOOLEAN DEFAULT FALSE  (true: sistema/saldos só com estoque.ver_saldo; false: todos veem)
├── status                  ENUM('ABERTO','EM_CONTAGEM','AGUARDANDO_APROVACAO','FINALIZADO','CANCELADO')
├── ID_usuario_abertura     INT FK NOT NULL
├── ID_usuario_aprovacao    INT FK NULL
└── observacao              TEXT  (nome do inventário)

item_inventario              uma linha por produto/inventário; guarda a decisão
├── ID_item_inventario      INT PK auto_increment
├── ID_inventario           INT FK NOT NULL
├── ID_produto              INT FK NOT NULL
├── quantidade_sistema      FLOAT NOT NULL   (snapshot de produto.saldo na abertura)
├── quantidade_final        FLOAT NULL       (média ou contagem escolhida)
├── origem                  ENUM('MEDIA','CONTAGEM') NULL
├── ID_contagem_inventario  INT FK NULL
├── decidido_em             TIMESTAMP NULL
├── ID_usuario_decisao      INT FK NULL
└── observacao              TEXT
    UNIQUE(ID_inventario, ID_produto)

contagem_inventario          uma contagem por funcionário/item
├── ID_contagem_inventario  INT PK auto_increment
├── ID_item_inventario      INT FK NOT NULL
├── ID_funcionario          INT FK NOT NULL
├── quantidade_contada      FLOAT NOT NULL
├── data_contagem           TIMESTAMP
└── observacao              TEXT
    UNIQUE(ID_item_inventario, ID_funcionario)

ajuste_inventario            só existe quando há diferença
├── ID_ajuste_inventario    INT PK auto_increment
├── ID_inventario           INT FK NOT NULL
├── ID_produto              INT FK NOT NULL
├── quantidade_contada      FLOAT NOT NULL  (valor escolhido)
├── origem                  ENUM('MEDIA','CONTAGEM')
├── ID_contagem_inventario  INT FK NULL
├── status                  ENUM('PENDENTE','APROVADO','REJEITADO')
├── ID_usuario_aprovacao    INT FK NULL
├── data_aprovacao          TIMESTAMP NULL
└── justificativa           TEXT
    UNIQUE(ID_inventario, ID_produto)
```

> **Implementado nos RUN-20261026-81/82 e RUN-20261027-83.** O nome do inventário é a `observacao` (não existe
> coluna `nome`). O item é único por inventário/produto e não há lote. A **decisão do item**
> fica em `item_inventario` (`quantidade_final`, `origem`, `ID_contagem_inventario`,
> `decidido_em`, `ID_usuario_decisao`), mesmo quando não há diferença; o `ajuste_inventario`
> só é criado quando `quantidade_final != quantidade_sistema` e é único por
> inventário/produto. Um produto **não pode estar em dois inventários ativos**
> (`ABERTO`/`EM_CONTAGEM`/`AGUARDANDO_APROVACAO`). O cancelamento grava `data_fim`.

Fluxo de status:

```text
ABERTO → EM_CONTAGEM → AGUARDANDO_APROVACAO → FINALIZADO
   │           │                    │
   └───────────┴────────────────────┴──→ CANCELADO
```

#### 3.9.1 Fluxo do Inventário

| Etapa | Ação no sistema | Impacto |
|-------|----------------|---------|
| **Abertura** | Usuário com `inventario.abrir` seleciona produtos (todos ou seleção) | status = ABERTO. Cria `item_inventario` com `quantidade_sistema = produto.saldo` (snapshot). Recusa produto que já esteja em outro inventário ativo. Movimentações dos produtos ficam BLOQUEADAS |
| **Contagem cega** | Com `contagem_cega` ligada, só quem tem `estoque.ver_saldo` vê `quantidade_sistema`/saldo; desligada, todos veem | A permissão antiga `inventario.ver_contagem_cega` não existe |
| **Contagem** | Funcionário do usuário logado registra uma contagem por item | Primeira contagem muda para EM_CONTAGEM; a mesma pessoa edita a sua contagem, outra pessoa cria outra contagem |
| **Fechar contagem** | Usuário encerra a contagem | Exige todos os itens contados; status = AGUARDANDO_APROVACAO. As contagens ficam disponíveis para a revisão, que calcula a média |
| **Revisão/decisão** | Aprovador vê sistema (conforme a cega/permissão), contagens individuais e média | Pode escolher a **média** ou **qualquer contagem individual**, independentemente da média; a escolha fica registrada em `item_inventario`, com aprovar/rejeitar e justificativa |
| **Ajuste** | Só é criado quando `quantidade_final` difere do snapshot | Aprovado: `produto.saldo` muda pelo delta e cria `movimentacao_estoque` com `ID_ajuste_inventario` (`saldo_anterior`/`saldo_posterior`); rejeitado: saldo e reserva não mudam. Valor igual ao sistema: decisão sem ajuste, mas o item fica decidido |
| **Finalização** | Todos os itens precisam estar decididos | Exige `quantidade_final` em todos os itens e ajuste para cada diferença; status = FINALIZADO, `data_fim` e aprovador; libera o bloqueio. `FINALIZADO` não volta |
| **Cancelamento** | Permitido em ABERTO/EM_CONTAGEM/AGUARDANDO_APROVACAO enquanto não houver ajuste aprovado/movimento | status = CANCELADO e `data_fim` gravada; itens/contagens/ajustes preservados; libera o bloqueio |
| **Lista/relatório** | Lista de contagem impressa e relatório CSV/PDF do fechado/cancelado | Exigem `relatorio.gerar`; na cega, sem `estoque.ver_saldo` não revelam sistema, saldos, `quantidade_final` nem “sem ajuste/igual”: tela, lista e CSV mascaram/omitem esses valores (a lista/CSV seguem com/sem sistema conforme a permissão) |

**Lista de contagem:** todos os produtos do inventário, com campos em branco para preencher à
mão; o cabeçalho mostra o nome (`observacao`), a data, o emitente e a data/hora de geração —
**sem assinatura**. A exibição das quantidades do sistema é opcional e segue a cega/permissão.

#### 3.9.2 Regras do Inventário

- **Bloqueio é por produto**, não geral: enquanto o inventário está `ABERTO`, `EM_CONTAGEM` ou `AGUARDANDO_APROVACAO`, ficam bloqueados entrada, saída (reserva, liberação, ajuste de reserva, baixa e baixa direta), desmontagem e coleta dos produtos do inventário. A **movimentação de ajuste do próprio inventário** é a exceção
- **Um inventário ativo por produto**: a abertura/edição recusa produto presente em outro inventário `ABERTO`/`EM_CONTAGEM`/`AGUARDANDO_APROVACAO`
- **Concorrência**: abertura/edição travam as linhas dos produtos (`SELECT ... FOR UPDATE`) antes da checagem de sobreposição; decisão, finalização e cancelamento são transacionais e travam a linha do inventário. Não há ajuste/movimento em inventário `CANCELADO` ou `FINALIZADO`
- **Uma contagem por funcionário/item**: a chave única `(ID_item_inventario, ID_funcionario)` impede duplicidade; o mesmo funcionário pode corrigir a sua contagem enquanto `EM_CONTAGEM`. Item sem contagem impede fechar a contagem
- **Decisão por item**: `quantidade_final`/`origem`/`ID_contagem_inventario`/`decidido_em`/`ID_usuario_decisao` registram a escolha; a média e qualquer contagem individual são sempre elegíveis. **Só há `ajuste_inventario` quando há diferença**, e ele é único por inventário/produto
- **Contagem cega**: com `Inventario.contagem_cega = true`, só `estoque.ver_saldo` vê sistema/saldos; com `false`, todos veem. Não existe `inventario.ver_contagem_cega`
- **Permissões**: `inventario.abrir`, `inventario.contar`, `inventario.aprovar_ajuste`; `estoque.ver_saldo` para a cega/saldos; `relatorio.gerar` para lista impressa e relatório. `relatorio.gerar` sozinho **não** libera sistema, saldos, `quantidade_final` nem a inferência de “sem ajuste/igual”
- **Diferença não gera ajuste automático** — a decisão é manual e o ajuste só nasce da diferença (RN005)
- **Rejeição/cancelamento não alteram o saldo**; a aprovação mexe só em `produto.saldo`, não em `saldo_reservado`
- **Edição/exclusão**: só antes da primeira contagem — edição em `ABERTO` sem contagens; exclusão sem contagens/ajustes. Depois, apenas cancelar, preservando contagens, ajustes e auditoria
- **Produto com histórico de inventário não é excluído**: `ItemInventario`/`AjusteInventario` contam como vínculo no hard delete do produto
- **Histórico preservado**: finalizado/cancelado continua consultável; contagens, ajustes e auditoria não são apagados
- **Auditoria**: abertura, contagem, decisão, finalização, cancelamento, edição e exclusão geram `registro_auditoria`; os snapshots de edição/exclusão trazem produto, quantidade e saldo, não só IDs

---

### 3.10 Bloco: Percurso e Expedição

#### 3.10.1 Percurso (Template)

```
percurso
├── ID_percurso           INT PK auto_increment
├── nome                  VARCHAR NOT NULL     ← "Escolas da roça", "Longe→perto"
└── descricao             TEXT

percurso_destinatario
├── ID_percurso           INT FK → percurso
├── ID_destinatario       INT FK → destinatario
├── ordem_visita          INT NOT NULL         ← posição no template
├── PRIMARY KEY (ID_percurso, ID_destinatario)
```

Regras:
- O percurso é um atalho de ordenação: guarda apenas o nome, a descrição e a ordem das
  visitas. Não possui `ativo` e **não é desativado** — excluir é **físico** e permanente
  (o registro e as visitas são apagados; a auditoria guarda o snapshot anterior).
- O nome é único entre **todos** os percursos existentes.

#### 3.10.2 Expedição (Instância do Dia)

```
expedicao
├── ID_expedicao          INT PK auto_increment
├── ID_veiculo            INT FK → veiculo NOT NULL        ← veículo que roda no dia
├── ID_funcionario_condutor INT FK → funcionario NOT NULL  ← quem dirige (não há tabela condutor)
├── data_criacao          TIMESTAMP NOT NULL
├── data_prevista         DATE NOT NULL             ← qual dia vai rodar
├── observacao            TEXT
├── status                ENUM(PLANEJADA, EM_PERCURSO, CONCLUIDA) DEFAULT PLANEJADA
└── ativo                 BOOLEAN DEFAULT TRUE
```

Regras:
- **A expedição é o manifesto do dia**: guarda o veículo, o condutor e a ordem das notas que
  transporta (`expedicao_nota`). Não armazena o percurso — o percurso só serve para ordenar os
  destinatários no momento de montar a expedição.
- **Data prevista, veículo e condutor são obrigatórios**: não existe expedição sem os três.
  A data prevista vazia no formulário assume o dia atual no fuso de São Paulo; o veículo
  precisa estar ativo e o condutor precisa ser funcionário ativo com `condutor = true`.
- A ordem gravada na expedição é a sua própria (`expedicao_nota.ordem_visita`).
- A expedição não precisa de nome — é filtrável por data, destinatários e notas
- A expedição **nasce `PLANEJADA`**; passa a `EM_PERCURSO` quando o percurso é iniciado e a
  `CONCLUIDA` quando é encerrado. O status é próprio da expedição, independente do status das
  notas que ela transporta.

---

### 3.11 Bloco: Pedido, Nota Saída e Coleta

#### 3.11.0 Pedido da Escola (Solicitação)

Representa o pedido que chega em **papel** da administração e é registrado no sistema. É
**somente a solicitação**: não reserva estoque e não movimenta saldo. O pedido tem
`data_criacao` automática e **não possui `ativo`, número, desativação nem exclusão** — o
histórico é o próprio status (`PENDENTE`, `CONFIRMADO`, `RECUSADO`).

```
pedido_escola
├── ID_pedido_escola        INT PK auto_increment
├── ID_destinatario         INT FK NOT NULL
├── ID_nota_saida           INT FK → nota_saida NULL   ← nota criada na importação
├── data_criacao            TIMESTAMP NOT NULL         ← automática
├── status                  ENUM('PENDENTE','CONFIRMADO','RECUSADO')
└── observacao              TEXT

item_pedido_escola
├── ID_item_pedido_escola   INT PK auto_increment
├── ID_pedido_escola        INT FK NOT NULL
├── ID_produto              INT FK NOT NULL
├── quantidade              FLOAT NOT NULL   ← total (sem fator/unidade)
└── observacao              TEXT
```

Regras:
- Criado como `PENDENTE`; só o pedido `PENDENTE` é editável (destinatário, itens, observação).
  Editar, aprovar e recusar usam **transição condicional** (`WHERE status = PENDENTE`), de modo
  que uma ação concorrente não altere um pedido já decidido
- Aprovar → `CONFIRMADO`; recusar → `RECUSADO`. A aprovação **não cria nota** e não reserva:
  apenas torna o pedido disponível para importação na Saída
- Cada pedido aprovado pode ser importado **uma única vez**: a importação usa
  `pedidoService.importar` (não o formulário comum de nota), cria **uma nota nova** (`SAIDA`)
  com o destinatário e os totais do pedido (1 pedido → 1 nota), grava `pedido.ID_nota_saida` e
  o retira da lista de importação. A vida da nota depois disso é fora do escopo do módulo
- Na importação, o destinatário e os itens do pedido aparecem em **conferência somente
  leitura** (não é possível adicionar, remover ou alterar); o vínculo valida destinatário,
  produtos e quantidades contra o pedido e **recusa nota divergente**, desfazendo a transação
- A importação exige `nota_saida.criar`, usa os totais já gravados (**sem reconverter**),
  soma produtos repetidos, passa por RN001 (aviso sem bloqueio), pelo bloqueio de inventário
  e por auditoria; a nota gerada é uma Remessa (`SAIDA`)
- Criar, editar, aprovar, recusar e importar geram `registro_auditoria` com os snapshots e o
  `ID_nota_saida` quando houver
- Os itens guardam **só a quantidade total**; a **Unidade Padrão de Saída** do produto é
  auxílio de preenchimento na tela (mostra unidade/fator e calcula o total), sem vínculo,
  fator ou quantidade convertida no pedido. Produtos repetidos **somam** no mesmo item
- A **observação por item** é editável no formulário, aparece no detalhe e é copiada para a
  observação do item da nota na importação
- Nenhuma nota (entrada ou saída) aceita produto duplicado: `item_nota_entrada` e
  `item_nota_saida` têm `UNIQUE(ID_nota, ID_produto)` e o serviço também recusa
- Pedido RECUSADO não gera nota. Não há desativação/exclusão de pedido (sem `ativo`)
- Lista e relatório têm busca e filtros em chips por **escola, status, período, produto e
  com/sem nota**;
  o filtro **Nota** aceita com/sem/todas (vazio ou ambos = todos). O relatório “Pedidos por
  escola” usa A4 retrato e CSV, como os demais relatórios
- `/pedidos` é acessível por **qualquer** permissão do módulo (`listar`, `consultar`, `criar`,
  `alterar`, `aprovar`); cada ação (criar/editar/aprovar/recusar) é exibida e autorizada
  conforme a permissão correspondente, e a importação na Saída exige `nota_saida.criar`

#### 3.11.1 Nota Saída (Entrega)

Representa a entrega. A nota **é** a unidade que carrega destinatário, itens, reserva e status —
não existe mais um nível intermediário de remessa. Para `tipo = SAIDA`, o destinatário
(`ID_destinatario`) é obrigatório na camada de serviço e os itens ficam em `item_nota_saida`.

Os tipos `CONSUMO_INTERNO`, `AVARIA` e `DESMONTAGEM` são **baixas internas sem entrega**: não têm
destinatário, não passam por reserva e dão baixa física direto na confirmação. O formulário de saída
opera com **Remessa** (`SAIDA`), **Avaria** (`AVARIA`) e **Consumo Interno** (`CONSUMO_INTERNO`);
`DESMONTAGEM` tem fluxo próprio e é recusada por esse formulário.

A nota pode ser criada do zero ou **importada de um pedido aprovado** (decisão do usuário,
2026-10-28): a importação é **1 pedido → 1 nota nova**, o vínculo fica em
`pedido_escola.ID_nota_saida` e a nota **não** tem coluna de pedido. Cada pedido pertence a
no máximo uma nota e a nota importada atende um pedido; o ciclo posterior da nota é fora do
escopo do módulo de Pedidos.

Os itens da nota também são únicos por produto (`UNIQUE(ID_nota_saida, ID_produto)`); a
importação soma os repetidos do pedido antes de criar a nota. O mesmo vale para
`item_nota_entrada` (`UNIQUE(ID_nota_entrada, ID_produto)`).

> **Release de produção:** notas antigas podem ter linhas duplicadas por produto. Antes do
> `db push` que cria as uniques, rode `npm run db:dedupe-notas`
> (`scripts/dedupe-itens-nota.ts`): por padrão é **dry-run**; com `--apply` grava backup JSON
> e consolida as quantidades (entrada: `quantidade`; saída: `qtd_esperada`/`qtd_entregue`),
> preservando a auditoria.

```
nota_saida
├── ID_nota_saida           INT PK auto_increment
├── ID_destinatario         INT FK → destinatario NULL  ← obrigatório para tipo SAIDA
├── data_criacao            TIMESTAMP NOT NULL
├── tipo                    ENUM('SAIDA','DESMONTAGEM','CONSUMO_INTERNO','AVARIA')
├── status                  ENUM(
                              'ABERTA',
                              'EM_PERCURSO',
                              'PENDENTE',
                              'BAIXA_TOTAL',
                              'BAIXA_PARCIAL',
                              'BAIXA_COM_CORTE',
                              'CANCELADA'
                            )
├── urgente                 BOOLEAN DEFAULT FALSE
├── observacao              TEXT
└── ativo                   BOOLEAN DEFAULT TRUE

item_nota_saida
├── ID_item_nota_saida      INT PK auto_increment
├── ID_nota_saida           INT FK NOT NULL
├── ID_produto              INT FK NOT NULL
├── qtd_esperada            FLOAT NOT NULL              ← total solicitado
├── qtd_entregue            FLOAT NOT NULL DEFAULT 0    ← total entregue
└── observacao              TEXT
```

Regras:
- A nota guarda **só totais**: `qtd_esperada` é o total solicitado e `qtd_entregue` o total
  entregue, em base (UNIDADE). Não há nome de unidade, fator nem quantidade “na unidade”
  gravados no item
- Na Remessa, a **Unidade Padrão de Saída do produto** (`ID_conversao_saida`) é **auxílio de
  lançamento**: a tela mostra unidade e fator e grava `qtd_esperada = quantidade × fator`;
  o que fica na nota é apenas o total. Avaria e Consumo Interno digitam o total direto
- Reserva, baixa, entrega e pendência usam `qtd_esperada`/`qtd_entregue`; alterar o cadastro
  ou excluir a conversão depois não muda a nota já lançada
- Criar uma nota `SAIDA` (Remessa) com itens **reserva o saldo do produto** (`produto.saldo_reservado += qtd_esperada`)
  e grava `item_nota_saida` e `reserva_estoque` na mesma transação (decisão do usuário, 2026-10-23)
- Criar uma nota `AVARIA` ou `CONSUMO_INTERNO` **não reserva**: dá baixa real na criação
  (`produto.saldo -= quantidade`), grava a `movimentacao_estoque` com quantidade negativa e
  `ID_nota_saida`, e a nota nasce `BAIXA_TOTAL` com `qtd_entregue = qtd_esperada`
- Saldo insuficiente apenas **avisa** (RN001), nunca bloqueia — na Remessa o aviso considera o
  disponível (`saldo − saldo_reservado`); na baixa direta, o `saldo` (que pode
  ficar negativo)
- Só a nota `SAIDA` `ABERTA` é editável: a edição corrige a reserva **pelo delta** e pode acrescentar
  item; remover item é recusado (RN004). O item existente usa o **total já guardado**; um item
  novo pode usar a Unidade Padrão de Saída como auxílio para calcular o total.
  Avaria e Consumo Interno são histórico e não são editáveis
- Cancelar só é permitido em `SAIDA` `ABERTA`: libera `saldo_reservado -= qtd_esperada` em cada item e
  muda para `CANCELADA`; a segunda tentativa é recusada sem debitar de novo. Avaria/Consumo Interno
  não são canceláveis — a correção é uma nota nova
- A nota pode entrar em **várias expedições** (`expedicao_nota`) e/ou gerar **coletas**
- Status: `ABERTA` (criada, aguardando expedição), `EM_PERCURSO` (saiu para entrega),
  `PENDENTE` (não entregue, reserva mantida), `BAIXA_TOTAL` (tudo entregue),
  `BAIXA_PARCIAL` (parte entregue, o restante continua reservado), `BAIXA_COM_CORTE` (parte
  entregue e o restante não será entregue), `CANCELADA` (nada entregue)

#### 3.11.2 Baixa da Nota e Pendência (RN003)

A baixa definitiva acontece na conclusão da entrega: para cada item entregue,
`produto.saldo -= qtd_entregue` e `produto.saldo_reservado -= qtd_entregue`, com a
`movimentacao_estoque` correspondente. As telas de entrada, saída e expedição mostram
**apenas quantidades/totais** — sem unidade, fator, “base” ou “convertida”.

- **`BAIXA_TOTAL`**: todos os itens foram entregues.
- **`BAIXA_PARCIAL`**: parte dos itens foi entregue e o restante continua reservado. A
  **pendência é a própria nota** em `BAIXA_PARCIAL` — **sem split e sem nota nova**. O que falta
  entregar é derivado de `item_nota_saida.qtd_esperada − qtd_entregue`, e a nota pode seguir para
  outra expedição.
- **`BAIXA_COM_CORTE`**: parte foi entregue e o restante não será entregue; a reserva restante é
  liberada.
- **`PENDENTE`**: a tentativa de entrega não ocorreu (ex.: escola fechada); a reserva permanece e
  a nota pode ser adicionada a outra expedição.

A execução acontece **dentro da expedição em `EM_PERCURSO`**, por nota e por item: o campo
**Entregar agora** informa o **delta** a entregar (default = pendência
`qtd_esperada − qtd_entregue`; `0` desmarca), e o formulário lista **somente itens com
pendência** — os já completos aparecem em bloco somente leitura. O sistema mantém o total já
entregue e aplica o delta, o **corte** libera a reserva do restante e o atalho **não
entregue** mantém tudo reservado. O servidor **recusa** item já completo, redução do já
entregue, item que não pertence à nota e entrega com todos os itens em zero sem corte e sem
justificativa. A baixa física não é
bloqueada por `saldo` insuficiente — divergência de inventário não impede registrar uma
entrega que aconteceu (RN001) —, mas nunca deixa `saldo_reservado` negativo. A segunda tentativa
numa nota já finalizada é recusada sem debitar de novo. Ao **concluir** a expedição, as notas ainda
em percurso passam a `PENDENTE`, a expedição vai para `CONCLUIDA` e o veículo volta a `DISPONIVEL`
quando não está em outra expedição em percurso.

#### 3.11.3 Coleta (Retirada Direta na Escola)

Representa retirada presencial por urgência — sem expedição, sem condutor, sem veículo.

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
├── ID_produto              INT FK NOT NULL
├── quantidade              FLOAT NOT NULL
```

Regras:
- Chegou e pegou — sem agendamento, sem status
- Ao registrar, a quantidade entregue é atualizada no acompanhamento correspondente e o saldo do produto dá baixa

#### 3.11.4 Expedição × Nota (N:N com ordem)

```
expedicao_nota
├── ID_expedicao_nota      INT PK auto_increment   ← PK independente!
├── ID_expedicao           INT FK → expedicao
├── ID_nota_saida          INT FK → nota_saida
├── ordem_visita           INT                      ← posição na expedição naquele dia
├── data_adicao            TIMESTAMP
├── justificativa          TEXT NULL                ← motivo do "não entregue" (1..1000)
├── data_tentativa         TIMESTAMP NULL           ← quando a tentativa foi registrada
└── ID_usuario_tentativa   INT FK → usuario NULL    ← quem registrou a tentativa
```

A PK independente permite que **a mesma nota apareça em expedições diferentes** (ex: tentativa falhou no dia X, entra na expedição do dia Y). A auditoria se mantém intacta pois cada entrada é um registro separado.

A **tentativa de entrega** fica no próprio vínculo: `data_tentativa`, `ID_usuario_tentativa`,
`justificativa` (obrigatória no "não entregue", 1..1000 caracteres) e as **fotos** (0..5,
`anexo` com `ID_expedicao_nota`). Duas tentativas da mesma nota em expedições diferentes geram
vínculos com históricos independentes. Depois de registrada, a tentativa é **imutável**: não
há remoção nem troca das fotos e um novo registro só é possível em outra expedição.

#### 3.11.5 Ciclo de Vida Completo

```
┌──────────────────────────────────────────────────────────┐
│  Cria Nota Saída (destinatário + itens) → reserva estoque│
│         ↓                                                │
│  ABERTA                                                  │
│         ↓                                                │
│  Adiciona na Expedição do dia (expedicao_nota)            │
│         ↓                                                │
│  EM_PERCURSO (saiu pra entrega)                          │
│         ↓                                                │
│  ┌─────┴──────────┐                                     │
│  ▼                 ▼                                     │
│  Sucesso          Falha                                  │
│  ↓                 ↓                                     │
│  BAIXA_TOTAL      PENDENTE                               │
│  (baixa real do   (reserva mantida, pode                 │
│   estoque)         entrar em outra expedição)            │
│                                                          │
│  Entrega Parcial:                                         │
│  ┌──────────────────────────────────┐                    │
│  │  Nota com 10 itens              │                    │
│  │  ↓                               │                    │
│  │  Entrega 6 itens                │                    │
│  │  ↓                               │                    │
│  │  BAIXA_PARCIAL                   │                    │
│  │  (a pendência é a MESMA nota,    │                    │
│  │   resto ainda reservado, pode    │                    │
│  │   entrar em outra expedição)     │                    │
│  └──────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

Esse ciclo é o da **Remessa** (`SAIDA`). **Avaria** e **Consumo Interno** não entram nele: nascem
`BAIXA_TOTAL`, já com a baixa física registrada na criação, e permanecem no histórico.

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
├── chave_acesso          VARCHAR(44) NULL UNIQUE  ← no máximo uma chave NF-e por nota
└── ativo                 BOOLEAN DEFAULT TRUE

item_nota_entrada
├── ID_item_nota_entrada  INT PK auto_increment
├── ID_nota_entrada       INT FK NOT NULL
├── ID_produto            INT FK NOT NULL
├── quantidade            FLOAT NOT NULL         ← total que entra no estoque (ex: 10 × 20 = 200)
└── observacao            TEXT
```

Regras:
- A entrada pode ser feita **com ou sem** chave de acesso de NF-e
- A chave de acesso, quando informada, deve ser uma chave válida de NF-e (44 caracteres)
- A nota tem **no máximo uma** chave de acesso: ela é a coluna `nota_entrada.chave_acesso`
  (nullable e única) — não existe mais a tabela `nota_entrada_chave_acesso`
- A unicidade da coluna impede a mesma chave em duas notas
- A conversão é **auxílio de lançamento**: o item novo parte da **Conversão Padrão de
  Entrada** do produto, o fator pode ser editado na tela e o sistema grava em `quantidade`
  apenas o **total** (quantidade × fator); a nota não guarda conversão
- Fornecedor é opcional — produtos de limpeza que chegam sem documento podem ter entrada sem fornecedor
- Ao confirmar a entrada, o sistema:
  1. Atualiza o saldo do produto (`produto.saldo += quantidade`)
  2. Cria `movimentacao_estoque` vinculada à nota (`ID_nota_entrada`) — a movimentação **não
     tem coluna de tipo**; a natureza de entrada é inferida pela FK e por `nota_entrada.tipo`
- Não há lote: o saldo é único por produto e a data de entrada fica no histórico de movimentações
- `data_validade` (quando aplicável) é atualizada manualmente no cadastro do produto pelo Jonathan

---

### 3.13 Bloco: Veículo

```
veiculo
├── ID_veiculo             INT PK auto_increment
├── placa                  VARCHAR NOT NULL UNIQUE
├── modelo                 VARCHAR
├── status                 ENUM('DISPONIVEL','INDISPONIVEL','EM_EXPEDICAO')
└── ativo                  BOOLEAN DEFAULT TRUE
```

---

### 3.14 Bloco: Anexos (fotos)

O anexo é uma **tabela única com dono polimórfico**: cada linha pertence a **exatamente um**
dono — produto, funcionário ou vínculo expedição/nota (`expedicao_nota`).

```
anexo
├── ID_anexo               INT PK auto_increment
├── nome_arquivo           VARCHAR NOT NULL
├── url                    VARCHAR NOT NULL
├── tipo_mime              VARCHAR
├── data_upload            TIMESTAMP NOT NULL
├── ID_usuario             INT FK → usuario NULL     ← quem enviou (auditoria)
├── ativo                  BOOLEAN DEFAULT TRUE
├── ID_produto             INT FK → produto NULL            onDelete: Cascade
├── ID_funcionario         INT FK → funcionario NULL        onDelete: Cascade
└── ID_expedicao_nota      INT FK → expedicao_nota NULL     onDelete: Cascade
```

Regras:
- **Dono único:** exatamente um dos três campos preenchido. Zero ou dois donos é recusado pelo
  serviço (`validarDonoUnico`) antes de qualquer escrita
- **Cadastro (produto e funcionário): no máximo 1 foto ativa.** Trocar a foto desativa o anexo
  anterior (`ativo = false`) e cria o novo na mesma transação; o arquivo antigo é apagado do
  disco **só depois do commit** e a URL antiga fica na auditoria
- **Tentativa de entrega: 0..5 fotos**, criadas junto com o registro da tentativa
  (`expedicao_nota`); depois disso são **imutáveis** — não há edição, remoção ou troca
- Todas as fotos passam por `src/lib/imagem.ts` (JPG/PNG/WEBP, ≤ 5 MB → WEBP 1024px via
  `sharp`) e ficam em `public/uploads/{produtos|funcionarios|entregas/ID_expedicao/ID_nota}/`
- `anexo` é **desativado** (soft delete) com auditoria; o hard delete da entidade dona
  (`produto`/`funcionario`) leva os anexos por **cascade** e as URLs são devolvidas ao
  chamador para apagar os arquivos
- `anexo.ID_nota_saida` foi **removido**: o dono da tentativa é o vínculo `expedicao_nota`,
  não a nota

> A antiga coluna `ID_documento_fiscal` foi **removida** do schema: era órfã (sem modelo
> `documento_fiscal`, sem FK e sem uso no código).

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

Permissões criadas por `prisma/seed.ts` (**89** no total):

| Entidade | Ações |
|----------|-------|
| `usuario` | listar, criar, alterar, consultar, desativar, excluir |
| `funcionario` | listar, criar, alterar, consultar, desativar, excluir |
| `destinatario` | listar, criar, alterar, consultar, desativar, excluir |
| `fornecedor` | listar, criar, alterar, consultar, desativar, excluir |
| `veiculo` | listar, criar, alterar, consultar, desativar, excluir |
| `produto` | listar, criar, alterar, consultar, desativar, excluir, ver_inativos |
| `perfil` | listar, criar, alterar, consultar, excluir |
| `estoque` | entrada, saida, ver_saldo |
| `nota_entrada` | criar, alterar, consultar, cancelar |
| `nota_saida` | criar, alterar, consultar, cancelar, alterar_status, finalizar |
| `pedido` | listar, criar, alterar, consultar, aprovar |
| `percurso` | listar, criar, alterar, consultar, excluir |
| `expedicao` | listar, criar, alterar, consultar, desativar |
| `inventario` | abrir, contar, aprovar_ajuste |
| `relatorio` | gerar |
| `unidade_conversao` | listar, criar, alterar, consultar, excluir (sem desativar) |
| `tipo_destinatario` | criar, alterar, excluir (sem `ativo`, exclusão física) |
| `mural` | criar, alterar, excluir |
| `backup` | listar, executar, agendar, restaurar |

> Perfil **não é desativado**: `perfil.excluir` é exclusão física (`src/services/permissao.ts`).
> O seed remove a permissão obsoleta `perfil.desativar` caso ela exista no banco.
> Percurso **não é desativado**: `percurso.excluir` é exclusão física. O seed remove a
> permissão obsoleta `percurso.desativar` caso ela exista no banco.
> A permissão obsoleta `inventario.ver_contagem_cega` não faz parte do seed nem da UI; em
> banco antigo ela pode continuar existindo e deve ser removida manualmente.

A permissão **`produto.ver_inativos`** é a única que expõe registros inativos: libera
o chip e a coluna **Situação** em `/produtos`, a busca por produtos inativos e o detalhe/edição
por ID. Ela **não** libera seletores operacionais (movimentação, pedidos, inventário e insumos),
que continuam apenas com produtos ativos; as notas históricas seguem exibindo os produtos
inativos que já têm item.

**Padrão das listagens.** As listagens de cadastro e operação (Produtos, Destinatários,
Fornecedores, Funcionários, Veículos, Usuários, Perfis, Expedições, Inventário, Pedidos, Entrada
e Saída) usam a mesma barra de filtros em **chips**: o campo só aparece depois de **Adicionar
filtro**, pode ser removido individualmente e não há filtro fixo — só os checkboxes de
apresentação dos relatórios (`fixo`) ficam sempre visíveis. Nas listagens paginadas no servidor,
aplicar volta à página 1, combina os filtros com a busca/paginação e mantém o recorte depois de
salvar/excluir (`router.refresh()`); em Perfis, a busca e o Grupo de permissões filtram no
cliente. Sem filtro, as listagens que têm `ativo` mostram **apenas ativos** (Perfis não tem
`ativo`). Os chips listam até **500 opções** (`LIMITE_OPCOES_MAX`); acima disso não há busca
dentro do seletor e nem todas as opções aparecem — o combobox com busca é evolução futura, não
implementada.

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
- A gestão de perfis tem tela própria (`/perfis`), acessível pelo botão **"Gerenciar perfis"** na tela de Usuários

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
├── senha_hash             VARCHAR NULL              ← nulo até o primeiro acesso definir a senha
├── senha_alterada_em      TIMESTAMP NULL            ← invalida tokens emitidos antes da troca
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

- `tipo_codigo` — **sem permissões, por desenho** (decisão do usuário, 2026-10-19): é dado de
  **referência**, sem operação de escrita para autorizar. `src/dao/tipo-codigo.ts` só **lê**
  (`list`, `listParaEntidade`, `getByNomes`), não existe tela nem Server Action de gestão, e os
  formulários de cadastro apenas **escolhem** entre os tipos permitidos — a lista chega às
  páginas por `listParaEntidade()` e o tipo é revalidado no servidor por `tipoPermitido()`
  (`src/services/codigo.ts` → `src/lib/codigo.ts`). A ausência de `tipo_codigo.*` no seed é
  consequência desse desenho, não esquecimento.
- `endereco` — vinculado à entidade que o possui
- `telefone`, `email` — vinculado à entidade que os possui

> **Invariante do catálogo de tipos (verificada em 2026-10-17):** os tipos de código existem em
> dois lugares — a constante `TIPOS_CODIGO`/`TIPOS_POR_ENTIDADE` em `src/lib/codigo.ts` e as
> **6** linhas de `tipo_codigo` criadas por `prisma/seed.ts`. **Quem manda é o TypeScript**:
> `tiposPermitidosPara()` (usado por `listParaEntidade()`) e `tipoPermitido()` recusam um tipo
> ausente da constante **mesmo que ele exista no banco** — acrescentar um tipo exige editar a
> constante, não apenas inserir a linha na tabela.

> Exceção: **`conversao_unidade` exige permissão** — o seed cria
> `unidade_conversao.{listar,criar,alterar,consultar,excluir}` e as Server Actions de
> `src/app/unidades/actions.ts` verificam essas permissões (aceitando também
> `produto.criar`/`produto.alterar` para o uso dentro do cadastro de produto).

---

### 3.16 Bloco: Auditoria

```
registro_auditoria
├── ID_registro_auditoria  INT PK auto_increment
├── ID_usuario             INT FK NOT NULL
├── data_hora              TIMESTAMP NOT NULL
├── acao                   VARCHAR NOT NULL   ← ver lista abaixo
├── entidade               VARCHAR NOT NULL   ← 'Produto', 'NotaSaida', etc.
├── ID_entidade_afetada    INT                ← ID do registro afetado
├── dados_anteriores       JSON               ← snapshot antes da alteração
└── dados_novos            JSON               ← snapshot depois da alteração
```

`acao` é uma coluna `VARCHAR` sem `enum` no banco; os valores usados pelo sistema são os do
tipo `AcaoAuditoria`, definido em `src/dao/_audit.ts`:

```text
CRIAR · ALTERAR · DESATIVAR · EXCLUIR · LOGIN · LOGIN_FALHA · LOGOUT · DEFINIR_SENHA
```

Regra crítica:
- **Registros de entrada confirmados e baixas finalizadas NÃO podem ser excluídos** (RN004)
- Devem ser estornados via lançamento de **ajuste com justificativa**

---

### 3.17 Bloco: Mural de Mensagens

Área de avisos na tela inicial. Pode conter mensagens **automáticas** (alertas do sistema) e **manuais** (publicadas por usuários com permissão).

```
mensagem_mural
├── ID_mensagem_mural      INT PK auto_increment
├── ID_usuario             INT FK NULL        ← quem publicou; NULL = mensagem gerada pelo sistema (sem autor)
├── titulo                 VARCHAR
├── conteudo               TEXT NOT NULL
├── data_publicacao        TIMESTAMP NOT NULL
├── data_expiracao         TIMESTAMP NULL
├── automatica             BOOLEAN DEFAULT FALSE  ← TRUE = gerado pelo sistema
└── ativo                  BOOLEAN DEFAULT TRUE
```

Regras:
- Mensagens automáticas: geradas por **triggers/rotinas de análise**, como alertas de validade (RN002) — sem autor humano (`ID_usuario = NULL` e `automatica = TRUE`)
- Mensagens manuais: exigem permissão `mural.criar`
- A lógica de geração automática deve ser reutilizável para futuros alertas
- A data de expiração controla quando a mensagem some do mural

### 3.18 Bloco: Relatórios (Consultas)

Não é uma tabela — é funcionalidade de consulta e exportação.

| Relatório | Filtros | Formato |
|-----------|---------|---------|
| Movimentação de Estoque | Período, produto, tipo de movimentação | PDF, CSV/XLSX |
| Expedições por Período | Data, expedição, destinatário, condutor | PDF, CSV/XLSX |
| Entregas por Instituição | Destinatário, período, status | PDF, CSV/XLSX |
| Produtos Próximos ao Vencimento | Dias para vencer | PDF |
| **Listagem Simplificada de Produtos** | — | PDF, CSV/XLSX |
| Auditoria | Usuário, período, entidade, ação | CSV/XLSX |
| Consolidado Semestral | Movimentações agregadas (6 em 6 meses) | PDF, CSV/XLSX |

**Fotos nos relatórios:** Produtos, Funcionários, Entregas e Expedições têm o checkbox opcional
**“Listar fotos”** (`?fotos=1`). Ele adiciona a coluna de miniaturas na tela/PDF (as imagens
abrem em nova aba; acima de 3–4 fotos a linha mostra `+N`) e a coluna de URL no CSV. Em
**Entregas** acrescenta também a **justificativa** da última não entrega. Todos os relatórios
usam A4 retrato. O relatório de Produtos mostra **a foto atual** (anexo ativo mais recente).

---

> **Documentos relacionados:**
> - [Requisitos Funcionais](REQUISITOS_FUNCIONAIS.md) — 26 RFs
> - [Regras de Negócio](REGRAS_NEGOCIO.md) — 5 RNs
> - [Requisitos Não Funcionais](REQUISITOS_NAO_FUNCIONAIS.md) — 9 RNFs
> - [Implementação](IMPLEMENTACAO.md) — o que já existe no código, requisito a requisito
> - [`../diagramas/classes.puml`](../diagramas/classes.puml) — modelo conceitual
> - [`../diagramas/DER.puml`](../diagramas/DER.puml) — modelo entidade-relacionamento
> - [`../diagramas/fluxo_atual.puml`](../diagramas/fluxo_atual.puml) e
>   [`../diagramas/fluxosAtuais/`](../diagramas/fluxosAtuais/) (6 sub-fluxos) — o fluxo
>   **AS-IS manual** descrito em §1.1 (papel, Trello, Excel, celular). **Não** representam o
>   TO-BE do sistema: o fluxo alvo está em §3.11 (nota de saída com reserva → expedição →
>   percurso → entrega → baixa)