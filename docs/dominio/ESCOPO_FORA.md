# Requisitos fora do escopo — Nexus

> Requisitos que a especificação prevê, mas que **não serão implementados** neste projeto.
> Para cada um: o motivo da exclusão e o que atende à necessidade no processo atual.
> A prioridade dos demais está em [`REQUISITOS_FUNCIONAIS.md`](REQUISITOS_FUNCIONAIS.md) e em
> [`REQUISITOS_NAO_FUNCIONAIS.md`](REQUISITOS_NAO_FUNCIONAIS.md).

## Critério

Um requisito entra aqui quando as três condições valem:

1. nenhuma regra de negócio (RN001–RN005) nem requisito Essencial depende dele;
2. a necessidade é atendida por outro caminho já previsto na especificação **ou pelo
   processo que a equipe já usa hoje**;
3. implementá-lo custa desproporcionalmente ao ganho operacional — inclusive quando exige
   infraestrutura que o projeto não tem.

Decisões do usuário de 2026-10-19.

## Resumo

| ID | Requisito | Prioridade original | Motivo em uma linha |
|---|---|---|---|
| `RF018` | Quadro Kanban de Remessas | Importante | o acompanhamento visual já é feito no Trello, na rua; sem hospedagem online exigiria um aplicativo mobile dedicado |
| `RF025` | Importação de NF-e (XML) | Desejável | o `RF017a` já registra a entrada com ou sem chave de acesso NF-e |
| `RNF009` | Interoperabilidade XML NF-e | Desejável | mesma capacidade do `RF025` |

## RF018 — Quadro Kanban de Remessas

**O que o requisito pedia:** gerenciar visualmente o fluxo das entregas pelos status
`EM_PREPARACAO`, `PRONTO_PARA_ENTREGA`, `EM_PERCURSO`, `PENDENTE`, `FINALIZADO_TOTAL` e
`FINALIZADO_PARCIAL`.

**Por que não será implementado:**

- O acompanhamento visual **já é feito hoje no Trello**, e é atualizado **na rua, durante as
  entregas**, por quem está executando o serviço — no momento e no lugar em que a informação
  nasce.
- O projeto **não tem infraestrutura para hospedar o sistema online** e permitir acesso de
  qualquer lugar, que é a condição para um quadro servido pelo Nexus substituir o Trello.
- Para funcionar nesse cenário, o Kanban exigiria uma **interface mobile dedicada**, com
  esforço muito acima do ganho: seria reimplementar, dentro do sistema, uma ferramenta que a
  equipe já usa onde a decisão acontece.

**O que atende à necessidade:** o acompanhamento visual continua no Trello, no processo atual.
O sistema mantém o status de cada remessa registrado no modelo, que é o que as consultas e
relatórios usam.

## RF025 — Importação de NF-e (XML)

**O que o requisito pedia:** pré-cadastro e entrada automatizada de produtos pela leitura do
arquivo XML da Nota Fiscal Eletrônica.

**Por que não será implementado:**

- O `RF017a` (Essencial) já prevê a entrada de mercadoria **com ou sem** chave de acesso
  NF-e — a nota é registrada manualmente, com a chave de 44 caracteres quando ela existir.
- Nenhuma regra de negócio depende da leitura do XML: a entrada, a movimentação de estoque e
  a atualização do saldo acontecem igual pelo registro manual.
- O XML automatiza a digitação, mas não é o que torna a operação possível — e a variedade de
  layouts de NF-e (por fornecedor e por versão do padrão) agregaria risco desproporcional ao
  ganho.

**O que atende à necessidade:** digitação da nota de entrada informando a chave de acesso,
quando houver.

## RNF009 — Interoperabilidade com XML NF-e

**O que o requisito pedia:** capacidade de processar XML de NF-e no padrão SEFAZ.

**Por que não será implementado:** é **a mesma capacidade do `RF025`**, declarada uma vez
como requisito funcional e outra como não funcional. Vale a mesma justificativa: nenhuma RN
nem requisito Essencial depende dela, e o `RF017a` cobre a necessidade pelo registro manual.

**O que atende à necessidade:** o mesmo caminho do `RF025` — entrada manual da nota.

## Observação: a mesma capacidade declarada duas vezes

`RF025` e `RNF009` descrevem **o mesmo recurso** — um como requisito funcional, outro como
não funcional (interoperabilidade). Ambos ficam fora do escopo pelas mesmas razões. Se a
leitura de XML voltar ao escopo no futuro, os dois devem ser tratados como **um** item, e não
como dois requisitos independentes.
