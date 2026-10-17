# Versionamento e changelog — Nexus

Este documento é a **fonte detalhada** da convenção de versionamento e de changelog do
projeto. Ele mescla duas referências externas e as adapta ao Nexus:

| Referência | O que aproveitamos |
| --- | --- |
| [Date Versioning (Date-Ver)](https://date-ver.com/) | a ideia de que o número da versão representa **quando** a release aconteceu (data + sequência no mesmo dia), em vez de compatibilidade. |
| [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/) | a estrutura do `CHANGELOG.md`: seção `Unreleased`, versões em ordem decrescente, categorias por tipo de mudança, entradas para humanos. |

Regras operacionais **não** moram aqui — para não duplicar:

- **checklist de release** (curto, o que fazer na hora de publicar):
  `.opencode/skills/release/SKILL.md`;
- **Jira** (consultar issue, smart commits, worklog, versão de projeto):
  `docs/agents/JIRA.MD`;
- **Jira · Git · worktrees · versão** no fluxo multiagente: `docs/agents/WORKFLOW.md`;
- **o papel de quem prepara a release**: `.opencode/agents/release-manager.md`.

---

## 1. DateVer adaptado: `N.DD.MM.YYYY`

### 1.1 Formato

```text
N.DD.MM.YYYY
```

- `N` — **sequência da release no mesmo dia**, começando em **1** e reiniciando a cada
  novo dia.
- `DD.MM.YYYY` — dia, mês e ano da release, com **dois dígitos** para dia e mês
  (`05.03.2026`, não `5.3.2026`) e **quatro** para o ano.
- A tag Git correspondente é **`vN.DD.MM.YYYY`**.

Exemplo: a primeira release de 17/10/2026 é a versão `1.17.10.2026`, com a tag
`v1.17.10.2026`.

### 1.2 Por que `N` na frente (e não no fim)

O Date-Ver original escreve a data primeiro e a sequência como identificador adicional
(`20251115.1`, `20251115.2`), com a regra de que a granularidade acompanha a data. O
Nexus usa a **mesma ideia** — data + sequência para o segundo release do mesmo dia — mas
com o separador de ponto em tudo e com `N` **na frente**, para que a versão fique legível
e ordenável no dia a dia do projeto (`1.17.10.2026`, `2.17.10.2026`).

Consequências prática dessa escolha:

- a granularidade é **sempre** dia (`N.DD.MM.YYYY`) — não se misturam formatos de ano ou
  de ano-mês como o spec externo permite;
- a ordenação é: **primeiro a data, depois `N`** — dentro do mesmo dia, `2.…` vem depois
  de `1.…`.

### 1.3 Duas releases no mesmo dia

Nunca reaproveite um número. Se já saiu uma release hoje, a próxima é `N + 1`:

```text
17/10/2026  →  1.17.10.2026   tag v1.17.10.2026
17/10/2026  →  2.17.10.2026   tag v2.17.10.2026   (2ª release do mesmo dia)
18/10/2026  →  1.18.10.2026   tag v1.18.10.2026   (N reinicia em 1)
```

No `CHANGELOG.md` a mais recente fica acima:

```markdown
## [2.17.10.2026] - 2026-10-17

## [1.17.10.2026] - 2026-10-17
```

### 1.4 O que a versão comunica — e o que não comunica

- A versão comunica **quando** a release saiu. Não há `major`/`minor`/`patch` e não há
  promessa de compatibilidade: **o Nexus não usa SemVer**.
- Mudança que quebra algo (quebra de contrato, remoção de funcionalidade) **não** é
  sinalizada pelo número. Ela precisa estar visível no changelog, nas categorias
  `Changed` / `Deprecated` / `Removed` — é isso que avisa quem atualiza.
- `N` **não** é a quantidade de releases do dia no sentido de "features"; é apenas a
  ordem de publicação naquele dia.

### 1.5 Regras que não podem quebrar

1. A data da versão é a **data da release**, não a data do primeiro commit da tarefa.
2. `N` começa em **1** e só aumenta dentro do mesmo dia; em outro dia, volta a `1`.
3. Não existem duas versões iguais. Mesmo conjunto de mudanças, publicações diferentes ⇒
   versões diferentes.
4. A **tag** repete a versão com `v` (`vN.DD.MM.YYYY`) e é criada **depois** do checklist
   de release e da **aprovação do usuário** — sem isso, não se cria tag nem se publica.
5. Não invente data "bonita" nem versão retroativa: a versão registra o dia real em que a
   release foi feita.
6. A versão fica associada às **issues** incluídas nela. A forma de relacionar (versão de
   projeto no Jira, quando aplicável) está em `docs/agents/JIRA.MD` §"Releases, versões e
   issues" — não repetida aqui.

> **Fuso de referência:** o dia da release é o de **`America/Sao_Paulo`** (fuso de
> Brasília, UTC−03:00) — é o fuso do projeto e o mesmo já usado na colheita da exportação
> para o Figma. A referência Date-Ver recomenda fixar isso, e fica fixado aqui.
> Observação: **não existe** o identificador IANA `America/Brasilia`; o que cobre Brasília
> é `America/Sao_Paulo`.

---

## 2. Changelog: Keep a Changelog 1.1.0 (pt-BR)

Arquivo: **`CHANGELOG.md`**, na raiz, sempre com este formato de cabeçalho:

```markdown
# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

A convenção detalhada está em [`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md).

## [Unreleased]
```

### 2.1 Estrutura

1. **`## [Unreleased]` sempre no topo** — é onde as mudanças entram conforme são feitas
   (o "não publicado" do Keep a Changelog). Serve para acumular o que ainda não saiu.
2. Abaixo, as versões publicadas em **ordem decrescente** (a mais nova primeiro).
3. Cada release é um `##` com a versão e a data em **ISO 8601** (`AAAA-MM-DD`):

   ```markdown
   ## [1.17.10.2026] - 2026-10-17
   ```

   A data ISO no título é o formato recomendado pelo Keep a Changelog (sem ambiguidade
   entre dia e mês); a versão em si carrega a data no formato `DD.MM.YYYY`.
4. Ao publicar, o conteúdo de `Unreleased` **passa a ser** a seção da nova versão; a
   seção `Unreleased` fica vazia, no topo, pronta para o próximo ciclo. (O
   `.opencode/skills/release/SKILL.md` é quem descreve o passo a passo.)
5. Quando existirem tags publicadas, os títulos podem virar links de comparação, como o
   Keep a Changelog sugere. Enquanto não houver tag, os títulos ficam sem link.

### 2.2 Categorias

As seis categorias do Keep a Changelog, com o significado usado no projeto. Os títulos no
`CHANGELOG.md` são os **nomes canônicos em inglês** (é o que o arquivo já usa); a leitura
em português está na tabela:

| Categoria no arquivo | Em português | Quando usar |
| --- | --- | --- |
| `Added` | Adicionado | funcionalidade nova |
| `Changed` | Modificado | mudança em algo que já existia — **inclui quebra de comportamento** |
| `Deprecated` | Obsoleto | algo que vai sair em breve |
| `Removed` | Removido | algo que saiu nesta versão |
| `Fixed` | Corrigido | correção de defeito |
| `Security` | Segurança | vulnerabilidade corrigida |

Regras de uso:

- agrupe as entradas **por tipo** — nada de misturar correção dentro de `Added`;
- **não deixe seção vazia**: se não houver mudança de um tipo, a seção simplesmente não
  existe naquela versão (recomendação explícita do Keep a Changelog);
- mantenha a ordem das categorias estável entre as versões.

### 2.3 Como escrever uma entrada

Uma entrada boa diz **o que mudou para quem usa**, com **evidência** de que mudou:

- comece pelo efeito observável, não pelo arquivo alterado;
- uma linha por mudança; se precisar de detalhe, use um sub-item (2 espaços) — como já é
  feito nas entradas longas do `CHANGELOG.md`;
- referencie a **issue** (e o commit, quando ajudar a localizar) ao final da linha;
- cite **números reais e verificáveis** (percentuais, contagens, comandos) quando eles
  forem a evidência da mudança;
- não use "melhorias", "ajustes", "diversos": sem objeto, a entrada não é rastreável.

```markdown
### Fixed

- Paginação da listagem não quebra mais em duas linhas: `{a} de {b}` é contado como
  linhas visuais e o texto fica em `nowrap`. (KAN-166, commit 2f8d99d)
```

### 2.4 Versão retirada (yanked)

Se uma release precisar ser retirada por problema sério ou falha de segurança, o Keep a
Changelog manda **manter a seção** e marcá-la, em caixa alta:

```markdown
## [1.17.10.2026] - 2026-10-17 [REMOVIDO]
```

A seção não é apagada; acrescenta-se o motivo. (Mesma lógica do histórico operacional do
sistema: nada de exclusão física — `AGENTS.md` §9/§13.)

---

## 3. Rastreabilidade: versão ↔ issues ↔ commit

Cada item do changelog de uma versão deve ser rastreável nos três níveis:

```text
versão N.DD.MM.YYYY
   └── issue            Jira — KAN-xxx
        └── commit(es)   mensagem começando pela chave: KAN-xxx: ...
             └── entrada no CHANGELOG.md (categoria + texto)
```

Exemplo (formato ilustrativo):

```text
versão 1.17.10.2026 / tag v1.17.10.2026
  issues:  KAN-166, KAN-167
  commits: "KAN-166: fix: fidelidade da reconstrução no Figma"
           "KAN-167: docs: registra o resultado do run"
  changelog: Unreleased → Fixed / Added (uma entrada por mudança real)
```

Regras:

- **toda** entrada de changelog corresponde a pelo menos uma issue e a pelo menos um
  commit; **toda** issue da versão tem pelo menos um commit associado;
- o formato da mensagem de commit, o smart commit e o worklog estão em
  `docs/agents/JIRA.MD` — não os repita aqui;
- o changelog **não** é o log de commits: ele conta as mudanças notáveis, que muitas
  vezes vêm de vários commits.

---

## 4. Checklist de release

Não está neste documento. O checklist obrigatório é o de
**`.opencode/skills/release/SKILL.md`**, e o agente que prepara a release é o descrito em
**`.opencode/agents/release-manager.md`**. Nenhuma versão ou tag é criada sem cumprir
tudo e sem **aprovação do usuário**.

Em uma frase: entregas aprovadas → rastreabilidade conferida → changelog correto → versão
DateVer e tag propostas → aprovação → tag e push.

---

## 5. O que nunca fazer

**No número da versão**

- usar SemVer (`1.2.3`) ou qualquer esquema "major.minor.patch";
- esquecer o `N` ou repeti-lo em duas releases do mesmo dia;
- pular/renomear a data, ou usar a data do commit em vez da data da release;
- criar a tag antes do checklist e da aprovação, ou sem o prefixo `v`.

**No changelog**

- **não** usar o `git log` como changelog: commits de merge, ruído e ajustes internos não
  são mudanças notáveis para quem lê;
- não registrar entrada **vaga** ("melhorias diversas") nem entrada **sem evidência** — se
  não há código/teste que comprove, não está concluída e não vai para o changelog;
- não **duplicar**: a mesma mudança não aparece duas vezes, nem em duas categorias, nem em
  duas versões;
- não escrever o changelog **depois** de publicar, de memória — a seção `Unreleased` é
  alimentada durante o trabalho;
- não deixar seções vazias "por simetria";
- não **apagar** nem reescrever entradas já publicadas: correção se registra em nova
  entrada (o changelog é histórico);
- não omitir `Deprecated`/`Removed`: são justamente as categorias que avisam quem
  atualiza que algo vai quebrar;
- não marcar release com critério de aceite não cumprido, rastreabilidade quebrada ou QA
  com falha bloqueante.

---

## 6. Exemplo completo (estrutura do arquivo)

```markdown
# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.
...

## [Unreleased]

### Added

- <mudança em andamento, com evidência e issue>.

## [2.17.10.2026] - 2026-10-17

### Fixed

- <correção publicada na 2ª release do dia>. (KAN-xxx, commit abc1234)

## [1.17.10.2026] - 2026-10-17

### Added

- <funcionalidade publicada na 1ª release do dia>. (KAN-xxx, commit def5678)
```
