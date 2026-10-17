# Implementação — o que já existe no código

> **Este documento descreve o ESTADO ATUAL do sistema**, não a especificação.
> [`REQUISITOS_FUNCIONAIS.md`](REQUISITOS_FUNCIONAIS.md) e
> [`REQUISITOS_NAO_FUNCIONAIS.md`](REQUISITOS_NAO_FUNCIONAIS.md) dizem o que o sistema
> **deve ser**; aqui está o que **já foi construído** — e a evidência de cada linha.
>
> Classificação: **implementado** (existe e é usado), **parcial** (existe em parte ou só em
> testes) e **não implementado** (não há código).

Levantamento conferido por leitura do código em `2026-10-17`, no commit-base `6922050`.
A evidência é o caminho do arquivo que sustenta a classificação — não há resultado fictício.

## Requisitos funcionais

| RF | Status | Evidência (ou ausência) |
| --- | --- | --- |
| RF001 — Usuários, perfis e permissões | implementado | `src/app/usuarios/**`, `src/app/perfis/**`, `src/services/permissao.ts`, `src/dao/usuario.ts`, `src/lib/permissoes.ts` |
| RF002 — Autenticação | implementado | `src/app/login/actions.ts`, `src/app/definir-senha/actions.ts`, `src/app/primeiro-acesso/actions.ts`, `src/lib/auth.ts`, `src/lib/jwt.ts`, `src/proxy.ts` |
| RF003 — Trilha de auditoria | implementado | `src/dao/_audit.ts`; tabela `registro_auditoria` em `prisma/schema.prisma` |
| RF004 — Destinatários | implementado | `src/app/destinatarios/**`, `src/dao/destinatario.ts` |
| RF005 — Funcionários | implementado | `src/app/funcionarios/**` (checkbox de condutor em `FuncionarioForm.tsx`), `src/dao/funcionario.ts` |
| RF006 — Fornecedores | implementado | `src/app/fornecedores/**`, `src/dao/fornecedor.ts` |
| RF007 — Veículos | implementado | `src/app/veiculos/**`, `src/dao/veiculo.ts`, `STATUS_VEICULO` em `src/types/index.ts` |
| *(RF008 não existe — lacuna preservada, ver `REQUISITOS_FUNCIONAIS.md`)* | — | — |
| RF009 — Mural de mensagens | não implementado | Só um cartão **estático** no dashboard (`src/app/dashboard/page.tsx`); sem tela, serviço ou DAO de mural |
| RF010 — Catálogo de produtos | implementado | `src/app/produtos/**`, `src/dao/produto.ts`, `src/components/UnidadesModal.tsx` |
| RF011 — Leitura por código de barras | parcial | Busca priorizada por código em `src/dao/produto.ts` e tipos EAN em `src/dao/tipo-codigo.ts`; **sem** tela/leitor dedicado |
| RF012 — Movimentação de estoque | parcial | `src/dao/estoque.ts` (`movimentar`) e a tabela `movimentacao_estoque`; **sem** nota de entrada/saída/transferência e sem uso fora dos testes (`tests/dao/estoque.test.ts`) |
| RF013 — Conversão de unidades | parcial | CRUD em `src/app/unidades/actions.ts`, `src/dao/conversao-unidade.ts` e `src/components/UnidadesModal.tsx`; a multiplicação na entrada depende de RF012/RF017a, que não existem |
| RF014 — Alertas de validade | não implementado | Nenhuma rotina gera alerta a partir de `produto.data_validade` |
| RF015 — Gestão de inventário | não implementado | Sem código de inventário em `src/app`, `src/services` ou `src/dao` (só as tabelas no schema) |
| RF016 — Baixas por consumo interno e avaria | não implementado | Nenhum fluxo de baixa por consumo/avaria |
| RF017a — Nota de entrada | não implementado | Sem tela/serviço/DAO de nota de entrada |
| RF017b — Nota de saída | não implementado | Sem tela/serviço/DAO de nota de saída |
| RF018 — Quadro Kanban de remessas | não implementado | Apenas as constantes `STATUS_REMESSA` (`src/types/index.ts`); sem Kanban |
| RF019 — Assistente de remessa (RN001) | parcial | RN001 implementada em `src/services/estoque.ts` (`verificarDisponibilidade` avisa e não bloqueia); **sem** assistente/tela; uso só em `tests/services/estoque.test.ts` |
| RF020 — Anexo de fotos | não implementado | Upload existe apenas para foto de produto (`src/lib/imagem.ts`); nada vinculado a remessa |
| RF021 — Pendências e urgências | não implementado | Sem fluxo de pendência/urgência |
| RF022 — Percurso e rota | não implementado | Sem tela/serviço/DAO (só as tabelas no schema) |
| RF023 — Relatórios | não implementado | Item de menu `/relatorios` **sem página** (`src/components/sidebar-config.ts`) |
| RF024 — Exportação de dados | não implementado | Sem geração de PDF/CSV/XLSX |
| RF025 — Importação de NF-e (XML) | não implementado | Sem leitura de XML NF-e |

## Requisitos não funcionais

| RNF | Status | Evidência (ou ausência) |
| --- | --- | --- |
| RNF001 — Arquitetura web + SGBD | implementado | App Next.js e `prisma/schema.prisma` (`provider = "mysql"`) |
| RNF002 — Desempenho (busca/Kanban < 2 s) | parcial | Busca por código priorizada em `src/dao/produto.ts`; Kanban ausente (RF018); sem medição de tempo |
| RNF003 — Usabilidade | implementado | Telas de cadastro com componentes compartilhados (`src/components/**`, `src/app/**`) |
| RNF004 — Segurança por perfil | implementado | `src/lib/permissoes.ts` e `src/services/permissao.ts`; gating por `entidade.acao` no servidor |
| RNF005 — Backup e integridade | parcial | Integridade referencial pelas FKs do Prisma; **sem** rotina de backup (nenhum script em `scripts/`) |
| RNF006 — Hash de senha (BCrypt) | implementado | `bcryptjs` em `src/app/login/actions.ts`, `src/app/definir-senha/actions.ts` e `src/app/primeiro-acesso/actions.ts` |
| RNF007 — Auditabilidade (snapshots JSON) | implementado | `src/dao/_audit.ts` e as colunas `Json` `dados_anteriores`/`dados_novos` |
| RNF008 — Portabilidade (PDF/CSV/XLSX) | não implementado | Sem exportação em nenhum formato |
| RNF009 — Interoperabilidade (XML NF-e) | não implementado | Sem processamento de XML NF-e |

## Pontos em aberto

Decisões que o código e o schema **não** definem — registradas aqui em vez de decididas:

1. **Autor das mensagens automáticas do mural.** `mensagem_mural.ID_usuario` é uma FK
   `NOT NULL`, e `automatica` marca as mensagens geradas pelo sistema (RN002) — mas o modelo
   não diz **qual** usuário responde por uma mensagem automática. Enquanto isso não for
   definido, qualquer rotina de alerta precisa de um usuário de sistema (a criar) ou de uma
   mudança de schema. (Ver `ENTENDIMENTO.md` §3.17.)
2. **Forma do "registro de pendência" da RN003.** A regra fala em "registro automático de
   pendência vinculado ao destinatário"; o modelo físico só prevê remessa com status
   `PENDENTE` (sem tabela de pendência). Se a pendência é apenas a remessa pendente ou um
   registro próprio, não está decidido. (Ver `REGRAS_NEGOCIO.md` RN003 e `ENTENDIMENTO.md`
   §3.11.2/§3.11.5.)
3. **Destino de `anexo.ID_documento_fiscal`.** A coluna existe no schema como inteiro
   opcional, sem modelo `documento_fiscal` e sem FK, e nenhum código a preenche. Falta
   definir se nasce uma entidade de documento fiscal ou se a coluna é removida.
4. **Enforcement de `tipo_codigo`.** `tipo_codigo` não tem permissões no seed e é lido
   direto pelos DAOs; `conversao_unidade` tem permissões próprias e é verificado nas Server
   Actions. Não está registrado se a ausência de permissão para `tipo_codigo` é uma decisão
   de produto ou uma lacuna. (Ver `ENTENDIMENTO.md` §3.15.6.)
