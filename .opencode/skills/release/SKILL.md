---
name: Release e versionamento DateVer (Nexus)
description: Como o Nexus versiona e publica releases — DateVer N.DD.MM.YYYY, tag vN.DD.MM.YYYY, CHANGELOG no padrão Keep a Changelog pt-BR e o checklist de release. Use ao preparar uma release, escrever/atualizar o changelog, propor versão ou tag, ou conferir rastreabilidade issue↔commit↔release.
---

# Release e versionamento — Nexus

## Convenção DateVer

- Versão: **`N.DD.MM.YYYY`** — `N` = sequência da release **no mesmo dia** (1, 2, …).
- Tag Git: **`vN.DD.MM.YYYY`** (ex.: `v1.17.10.2026`).
- Exemplo: dois releases em 17/10/2026 → `1.17.10.2026` e `2.17.10.2026`.

## Changelog

`CHANGELOG.md` no padrão **Keep a Changelog 1.1.0 (pt-BR)**
(<https://keepachangelog.com/pt-BR/1.1.0/>):

- sempre com seção **`Unreleased`** no topo, depois as versões em ordem decrescente;
- categorias: **Added, Changed, Deprecated, Removed, Fixed, Security**;
- entradas **reais, com evidência**, sem duplicidade e sem texto vago;
- cada versão referencia a data e, quando possível, as issues.

## Checklist de release (tudo obrigatório)

- [ ] Entregas aprovadas (reviewer sem bloqueante; QA verde).
- [ ] Cada mudança rastreável: issue → commit → entrada no changelog.
- [ ] Changelog atualizado (categorias corretas, sem duplicidade).
- [ ] Documentação (`/docs`) atualizada pelo Docs Keeper.
- [ ] Testes executados com resultado registrado.
- [ ] Versão DateVer e tag propostas ao usuário.
- [ ] **Aprovação do usuário** para commit final, tag e push.

> Criar tag oficial **somente** depois de todos os critérios. Sem aprovação, não publicar.
