-- Nexus — seed de referência (sem usuários, produtos ou dados operacionais).
-- Gerado por scripts/gerar-sql-producao.mjs a partir da lista de referência do
-- prisma/seed.ts. Idempotente: pode ser reaplicado sem duplicar.

SET NAMES utf8mb4;

-- ── Tipos de código ────────────────────────────────────────────────────────
INSERT INTO `tipo_codigo` (`nome`, `descricao`, `ativo`) VALUES
  ('DIGITACAO', 'Apelido livre para digitação rápida', TRUE),
  ('EAN12', 'GTIN-12 / UPC-A — 12 dígitos numéricos', TRUE),
  ('EAN13', 'GTIN-13 / EAN-13 — 13 dígitos numéricos', TRUE),
  ('COD_FORNECEDOR', 'Código do produto no fornecedor', TRUE),
  ('COD_ESCOLA', 'Código da escola/creche', TRUE),
  ('MATRICULA', 'Matrícula funcional do funcionário', TRUE)
AS new
ON DUPLICATE KEY UPDATE `descricao` = new.`descricao`, `ativo` = new.`ativo`;

-- ── Tipos de destinatário (só quando o cadastro está vazio) ────────────────
SET @qtd_tipo_destinatario = (SELECT COUNT(*) FROM `tipo_destinatario`);
INSERT INTO `tipo_destinatario` (`codigo`, `nome`, `padrao`)
SELECT `codigo`, `nome`, `padrao` FROM (
  SELECT 'ESCOLA' AS `codigo`, 'Escola' AS `nome`, TRUE AS `padrao` UNION ALL
  SELECT 'CRECHE' AS `codigo`, 'Creche' AS `nome`, FALSE AS `padrao` UNION ALL
  SELECT 'CMEI' AS `codigo`, 'CMEI' AS `nome`, FALSE AS `padrao` UNION ALL
  SELECT 'CMEIA' AS `codigo`, 'CMEIA' AS `nome`, FALSE AS `padrao`
) AS novos
WHERE @qtd_tipo_destinatario = 0;

-- ── Permissões (entidade.acao) ─────────────────────────────────────────────
INSERT INTO `permissao` (`nome`, `ativo`) VALUES
  ('usuario.listar', TRUE),
  ('usuario.criar', TRUE),
  ('usuario.alterar', TRUE),
  ('usuario.consultar', TRUE),
  ('funcionario.listar', TRUE),
  ('funcionario.criar', TRUE),
  ('funcionario.alterar', TRUE),
  ('funcionario.consultar', TRUE),
  ('destinatario.listar', TRUE),
  ('destinatario.criar', TRUE),
  ('destinatario.alterar', TRUE),
  ('destinatario.consultar', TRUE),
  ('fornecedor.listar', TRUE),
  ('fornecedor.criar', TRUE),
  ('fornecedor.alterar', TRUE),
  ('fornecedor.consultar', TRUE),
  ('veiculo.listar', TRUE),
  ('veiculo.criar', TRUE),
  ('veiculo.alterar', TRUE),
  ('veiculo.consultar', TRUE),
  ('produto.listar', TRUE),
  ('produto.criar', TRUE),
  ('produto.alterar', TRUE),
  ('produto.consultar', TRUE),
  ('perfil.listar', TRUE),
  ('perfil.criar', TRUE),
  ('perfil.alterar', TRUE),
  ('perfil.consultar', TRUE),
  ('usuario.desativar', TRUE),
  ('funcionario.desativar', TRUE),
  ('destinatario.desativar', TRUE),
  ('fornecedor.desativar', TRUE),
  ('veiculo.desativar', TRUE),
  ('produto.desativar', TRUE),
  ('usuario.excluir', TRUE),
  ('funcionario.excluir', TRUE),
  ('destinatario.excluir', TRUE),
  ('fornecedor.excluir', TRUE),
  ('veiculo.excluir', TRUE),
  ('produto.excluir', TRUE),
  ('perfil.excluir', TRUE),
  ('produto.ver_inativos', TRUE),
  ('unidade_conversao.listar', TRUE),
  ('unidade_conversao.criar', TRUE),
  ('unidade_conversao.alterar', TRUE),
  ('unidade_conversao.consultar', TRUE),
  ('unidade_conversao.excluir', TRUE),
  ('tipo_destinatario.criar', TRUE),
  ('tipo_destinatario.alterar', TRUE),
  ('tipo_destinatario.excluir', TRUE),
  ('estoque.entrada', TRUE),
  ('estoque.saida', TRUE),
  ('estoque.ver_saldo', TRUE),
  ('nota_entrada.criar', TRUE),
  ('nota_entrada.alterar', TRUE),
  ('nota_entrada.consultar', TRUE),
  ('nota_entrada.cancelar', TRUE),
  ('nota_saida.criar', TRUE),
  ('nota_saida.alterar', TRUE),
  ('nota_saida.consultar', TRUE),
  ('nota_saida.cancelar', TRUE),
  ('nota_saida.alterar_status', TRUE),
  ('nota_saida.finalizar', TRUE),
  ('percurso.listar', TRUE),
  ('percurso.criar', TRUE),
  ('percurso.alterar', TRUE),
  ('percurso.consultar', TRUE),
  ('percurso.excluir', TRUE),
  ('expedicao.listar', TRUE),
  ('expedicao.criar', TRUE),
  ('expedicao.alterar', TRUE),
  ('expedicao.consultar', TRUE),
  ('expedicao.desativar', TRUE),
  ('inventario.abrir', TRUE),
  ('inventario.contar', TRUE),
  ('inventario.aprovar_ajuste', TRUE),
  ('pedido.listar', TRUE),
  ('pedido.criar', TRUE),
  ('pedido.alterar', TRUE),
  ('pedido.consultar', TRUE),
  ('pedido.aprovar', TRUE),
  ('relatorio.gerar', TRUE),
  ('mural.criar', TRUE),
  ('mural.alterar', TRUE),
  ('mural.excluir', TRUE),
  ('backup.listar', TRUE),
  ('backup.executar', TRUE),
  ('backup.agendar', TRUE),
  ('backup.restaurar', TRUE)
AS new
ON DUPLICATE KEY UPDATE `ativo` = new.`ativo`;

-- ── Limpeza de permissões obsoletas (modelos antigos remessa/rota) ─────────
DELETE FROM `usuario_permissao` WHERE `ID_permissao` IN (SELECT `ID_permissao` FROM `permissao` WHERE `nome` IN ('perfil.desativar', 'percurso.desativar', 'rota.listar', 'rota.criar', 'rota.alterar', 'rota.consultar', 'rota.desativar', 'remessa.criar', 'remessa.alterar', 'remessa.alterar_status', 'remessa.consultar', 'remessa.finalizar'));
DELETE FROM `perfil_permissao` WHERE `ID_permissao` IN (SELECT `ID_permissao` FROM `permissao` WHERE `nome` IN ('perfil.desativar', 'percurso.desativar', 'rota.listar', 'rota.criar', 'rota.alterar', 'rota.consultar', 'rota.desativar', 'remessa.criar', 'remessa.alterar', 'remessa.alterar_status', 'remessa.consultar', 'remessa.finalizar'));
DELETE FROM `permissao` WHERE `nome` IN ('perfil.desativar', 'percurso.desativar', 'rota.listar', 'rota.criar', 'rota.alterar', 'rota.consultar', 'rota.desativar', 'remessa.criar', 'remessa.alterar', 'remessa.alterar_status', 'remessa.consultar', 'remessa.finalizar');

-- ── Perfis-template ────────────────────────────────────────────────────────
INSERT INTO `perfil` (`nome`, `descricao`) VALUES
  ('Operador', 'Operador do galpão'),
  ('Auxiliar', 'Auxiliar administrativo')
AS new
ON DUPLICATE KEY UPDATE `descricao` = new.`descricao`;

-- Operador
INSERT IGNORE INTO `perfil_permissao` (`ID_perfil`, `ID_permissao`)
SELECT p.`ID_perfil`, pe.`ID_permissao`
FROM `perfil` p
CROSS JOIN `permissao` pe
WHERE p.`nome` = 'Operador' AND pe.`nome` IN ('produto.consultar', 'produto.criar', 'estoque.entrada', 'estoque.ver_saldo', 'nota_saida.criar', 'nota_saida.consultar', 'nota_saida.alterar', 'nota_saida.alterar_status', 'nota_saida.finalizar', 'destinatario.consultar', 'inventario.contar');

-- Auxiliar
INSERT IGNORE INTO `perfil_permissao` (`ID_perfil`, `ID_permissao`)
SELECT p.`ID_perfil`, pe.`ID_permissao`
FROM `perfil` p
CROSS JOIN `permissao` pe
WHERE p.`nome` = 'Auxiliar' AND pe.`nome` IN ('nota_saida.consultar', 'nota_saida.alterar', 'estoque.ver_saldo', 'estoque.saida', 'produto.consultar', 'inventario.contar', 'relatorio.gerar');

-- ── Unidades de conversão ──────────────────────────────────────────────────
-- UNIDADE (fator 1) é a única padrão do sistema; PCT10/CX50 são auxílios.
INSERT INTO `conversao_unidade` (`nome`, `fator`, `descricao`, `padrao`) VALUES
  ('UNIDADE', 1, 'Unidade avulsa', TRUE),
  ('PCT10', 10, 'Pacote com 10 unidades', FALSE),
  ('CX50', 50, 'Caixa com 50 unidades', FALSE)
AS new
ON DUPLICATE KEY UPDATE `fator` = new.`fator`, `descricao` = new.`descricao`, `padrao` = new.`padrao`;

-- Invariante: apenas a UNIDADE é padrão.
UPDATE `conversao_unidade` SET `padrao` = (`nome` = 'UNIDADE');
