# Requisitos fora do escopo — Nexus

> Requisitos que a especificação prevê, mas que **não serão implementados** neste projeto.
> A prioridade dos demais está em [`REQUISITOS_FUNCIONAIS.md`](REQUISITOS_FUNCIONAIS.md) e em
> [`REQUISITOS_NAO_FUNCIONAIS.md`](REQUISITOS_NAO_FUNCIONAIS.md).

## Critério

Um requisito entra aqui quando as três condições valem:

1. nenhuma regra de negócio (RN001–RN005) nem requisito Essencial depende dele;
2. o sistema atende à mesma necessidade por outro caminho já previsto na especificação;
3. implementá-lo custa desproporcionalmente ao ganho operacional.

Decisão do usuário de 2026-10-19.

## Requisitos fora do escopo

| ID | Requisito | Prioridade original | Por que não será implementado | O que cobre a necessidade |
|---|---|---|---|---|
| `RF025` | Importação de NF-e (XML) — pré-cadastro e entrada automatizada pela leitura do XML | Desejável | o `RF017a` (Essencial) já prevê a entrada **com ou sem** chave de acesso NF-e; nenhuma regra de negócio depende do XML | digitação da nota de entrada informando a chave de acesso (44 caracteres) |
| `RNF009` | Interoperabilidade: processar XML NF-e (padrão SEFAZ) | Desejável | mesma capacidade do `RF025` — nenhuma RN nem requisito Essencial depende dela | idem: entrada manual da nota |

## Observação: a mesma capacidade declarada duas vezes

`RF025` e `RNF009` descrevem **o mesmo recurso** — um como requisito funcional, outro como
não funcional (interoperabilidade). Ambos ficam fora do escopo pelas mesmas razões. Se a
leitura de XML voltar ao escopo no futuro, os dois devem ser tratados como **um** item, e não
como dois requisitos independentes.
