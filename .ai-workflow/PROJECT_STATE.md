# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-11-01 (ficha de empresa + remoção de coordenadas + seed demo).

## Objetivo atual

Repaginar os cadastros no estilo “ficha” e manter o **seed de demonstração dev-only**. A
`main` recebeu o commit `KAN-139` da repaginação/seed e foi empurrada; o worktree
`C:\Users\Enzo\Documents\Code\projetofinalfaetec-visual`, branch
`KAN-139-repaginacao-produto`, está limpo.

## Entregue nesta rodada (commit `KAN-139`)

1. **Produto** (`ProdutoForm`/`ProdutoView`): banda com foto 96px, saldo/reservado,
   `Ativo`, seções, códigos/insumos compactos e rodapé fixo.
2. **Funcionário** (`FuncionarioForm` criar/editar/visualizar): mesma ficha, foto/iniciais,
   `Ativo`, `Condutor`, contatos/códigos compactos.
3. **Destinatário e fornecedor** (`EmpresaFicha` compartilhado): banda com iniciais,
   `Ativo`, chip do tipo, seções Identificação/Endereço/Contato/Códigos; **CNPJ
   (Consultar)** e **CEP (Buscar)** com loading, auto-preenchimento, erros e preservação de
   número/complemento; a situação da Receita é só aviso.
4. **Latitude/longitude removidas** do `Endereco` no schema, `EnderecoFields`,
   DTOs/actions, DAOs, `lib/form-data`, `tests/lib/form-data.test` e docs/diagramas
   (RF004, ENTENDIMENTO, classes/DER). O banco dev `nexus` já está sem as colunas.
5. **Seed demo dev-only**: `prisma/seed-demo-data.ts` + `prisma/seed-demo.ts` +
   `npm run db:seed:demo`; 10 funcionários, 10 destinatários, 10 fornecedores, 10 veículos
   e 10 produtos (4devs/Bluesoft). Aditivo/idempotente; `prisma/seed.ts` intacto.
   Totais no dev: 11 funcionários, 10 destinatários, 11 fornecedores, 10 veículos, 12
   produtos (10 demo + dataset de teste existente). Super Admin/login preservados.
6. **Regras/docs:** `AGENTS.md` §17 desktop only (1360×768) e §6 seed demo dev-only;
   `CHANGELOG` atualizado.

## Verificação

- `tsc --noEmit`, `lint`, `build` verdes; **490/490 testes**; `figma:check` verde.
- `nexus_test` atualizado pelo setup dos testes; `nexus_prod` intocado.
- Colunas de `endereco` no `nexus` conferidas: sem `latitude`/`longitude`.
- Screenshots desktop 1366×768 em `out/visual/` (produto, funcionário, destinatário,
  fornecedor).

## Pendências

1. **Veículo** — último cadastro da repaginação (mesmo shell; sem endereço/contato).
2. **Release** `1.31.10.2026` + push (aprovação).
4. **Produção**: backfill `foto_url` → `anexo`, achatamento do estoque, dedupe das notas,
   gates, `db push`, build/start/smoke.
5. **RFs restantes**: RF011, RF012, RF019, RF021, RF023, RF024/XLSX; RF018/RF026/RNF009
   fora do escopo.

## Próximas ações

1. Repaginar veículo.
2. Preparar a release e a produção.
