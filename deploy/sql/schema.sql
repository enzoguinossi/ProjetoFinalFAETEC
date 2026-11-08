-- Nexus — esquema físico do banco (MySQL 8.4, utf8mb4).
-- Gerado por scripts/gerar-sql-producao.mjs a partir de prisma/schema.prisma.
-- Aplicar em um banco vazio e já criado; não cria o banco nem usuários.
-- Equivalente ao DDL do `prisma db push` (o destino não usa Prisma).

SET NAMES utf8mb4;

-- CreateTable
CREATE TABLE `tipo_codigo` (
    `ID_tipo_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tipo_codigo_nome_key`(`nome`),
    PRIMARY KEY (`ID_tipo_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produto_codigo` (
    `ID_produto_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_produto` INTEGER NOT NULL,
    `ID_tipo_codigo` INTEGER NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `produto_codigo_codigo_key`(`codigo`),
    INDEX `produto_codigo_ID_produto_fkey`(`ID_produto`),
    INDEX `produto_codigo_ID_tipo_codigo_fkey`(`ID_tipo_codigo`),
    PRIMARY KEY (`ID_produto_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinatario_codigo` (
    `ID_destinatario_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_destinatario` INTEGER NOT NULL,
    `ID_tipo_codigo` INTEGER NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `destinatario_codigo_codigo_key`(`codigo`),
    INDEX `destinatario_codigo_ID_destinatario_fkey`(`ID_destinatario`),
    INDEX `destinatario_codigo_ID_tipo_codigo_fkey`(`ID_tipo_codigo`),
    PRIMARY KEY (`ID_destinatario_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedor_codigo` (
    `ID_fornecedor_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_fornecedor` INTEGER NOT NULL,
    `ID_tipo_codigo` INTEGER NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `fornecedor_codigo_codigo_key`(`codigo`),
    INDEX `fornecedor_codigo_ID_fornecedor_fkey`(`ID_fornecedor`),
    INDEX `fornecedor_codigo_ID_tipo_codigo_fkey`(`ID_tipo_codigo`),
    PRIMARY KEY (`ID_fornecedor_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario_codigo` (
    `ID_funcionario_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_funcionario` INTEGER NOT NULL,
    `ID_tipo_codigo` INTEGER NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `funcionario_codigo_codigo_key`(`codigo`),
    INDEX `funcionario_codigo_ID_funcionario_fkey`(`ID_funcionario`),
    INDEX `funcionario_codigo_ID_tipo_codigo_fkey`(`ID_tipo_codigo`),
    PRIMARY KEY (`ID_funcionario_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veiculo_codigo` (
    `ID_veiculo_codigo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_veiculo` INTEGER NOT NULL,
    `ID_tipo_codigo` INTEGER NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `veiculo_codigo_codigo_key`(`codigo`),
    INDEX `veiculo_codigo_ID_tipo_codigo_fkey`(`ID_tipo_codigo`),
    INDEX `veiculo_codigo_ID_veiculo_fkey`(`ID_veiculo`),
    PRIMARY KEY (`ID_veiculo_codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pessoa_fisica` (
    `ID_pessoa_fisica` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(11) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `pessoa_fisica_cpf_key`(`cpf`),
    PRIMARY KEY (`ID_pessoa_fisica`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pessoa_juridica` (
    `ID_pessoa_juridica` INTEGER NOT NULL AUTO_INCREMENT,
    `razao_social` VARCHAR(191) NOT NULL,
    `nome_fantasia` VARCHAR(191) NULL,
    `cnpj` VARCHAR(14) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `pessoa_juridica_cnpj_key`(`cnpj`),
    PRIMARY KEY (`ID_pessoa_juridica`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario` (
    `ID_funcionario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_pessoa_fisica` INTEGER NOT NULL,
    `cargo` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `condutor` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `funcionario_ID_pessoa_fisica_key`(`ID_pessoa_fisica`),
    PRIMARY KEY (`ID_funcionario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `ID_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_funcionario` INTEGER NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `senha_hash` VARCHAR(191) NULL,
    `senha_alterada_em` TIMESTAMP(0) NULL,
    `super_admin` BOOLEAN NOT NULL DEFAULT false,
    `ultimo_acesso` TIMESTAMP(0) NULL,
    `mural_visto_em` TIMESTAMP(0) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `usuario_ID_funcionario_key`(`ID_funcionario`),
    UNIQUE INDEX `usuario_login_key`(`login`),
    PRIMARY KEY (`ID_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedor` (
    `ID_fornecedor` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_pessoa_juridica` INTEGER NOT NULL,
    `ID_endereco` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `fornecedor_ID_pessoa_juridica_key`(`ID_pessoa_juridica`),
    INDEX `fornecedor_ID_endereco_fkey`(`ID_endereco`),
    PRIMARY KEY (`ID_fornecedor`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinatario` (
    `ID_destinatario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_pessoa_juridica` INTEGER NOT NULL,
    `ID_tipo_destinatario` INTEGER NULL,
    `ID_endereco` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `destinatario_ID_pessoa_juridica_key`(`ID_pessoa_juridica`),
    INDEX `destinatario_ID_endereco_fkey`(`ID_endereco`),
    INDEX `destinatario_ID_tipo_destinatario_fkey`(`ID_tipo_destinatario`),
    PRIMARY KEY (`ID_destinatario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_destinatario` (
    `ID_tipo_destinatario` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `padrao` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tipo_destinatario_codigo_key`(`codigo`),
    UNIQUE INDEX `tipo_destinatario_nome_key`(`nome`),
    PRIMARY KEY (`ID_tipo_destinatario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `endereco` (
    `ID_endereco` INTEGER NOT NULL AUTO_INCREMENT,
    `logradouro` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NULL,
    `complemento` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NOT NULL,
    `uf` CHAR(2) NULL,
    `cep` VARCHAR(191) NULL,

    PRIMARY KEY (`ID_endereco`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario_telefone` (
    `ID_funcionario_telefone` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_funcionario` INTEGER NOT NULL,
    `numero` VARCHAR(11) NOT NULL,
    `tipo` ENUM('CELULAR', 'FIXO', 'COMERCIAL') NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `funcionario_telefone_numero_key`(`numero`),
    INDEX `funcionario_telefone_ID_funcionario_fkey`(`ID_funcionario`),
    PRIMARY KEY (`ID_funcionario_telefone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinatario_telefone` (
    `ID_destinatario_telefone` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_destinatario` INTEGER NOT NULL,
    `numero` VARCHAR(11) NOT NULL,
    `tipo` ENUM('CELULAR', 'FIXO', 'COMERCIAL') NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `destinatario_telefone_numero_key`(`numero`),
    INDEX `destinatario_telefone_ID_destinatario_fkey`(`ID_destinatario`),
    PRIMARY KEY (`ID_destinatario_telefone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedor_telefone` (
    `ID_fornecedor_telefone` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_fornecedor` INTEGER NOT NULL,
    `numero` VARCHAR(11) NOT NULL,
    `tipo` ENUM('CELULAR', 'FIXO', 'COMERCIAL') NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `fornecedor_telefone_numero_key`(`numero`),
    INDEX `fornecedor_telefone_ID_fornecedor_fkey`(`ID_fornecedor`),
    PRIMARY KEY (`ID_fornecedor_telefone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario_email` (
    `ID_funcionario_email` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_funcionario` INTEGER NOT NULL,
    `endereco` VARCHAR(191) NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `funcionario_email_endereco_key`(`endereco`),
    INDEX `funcionario_email_ID_funcionario_fkey`(`ID_funcionario`),
    PRIMARY KEY (`ID_funcionario_email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinatario_email` (
    `ID_destinatario_email` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_destinatario` INTEGER NOT NULL,
    `endereco` VARCHAR(191) NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `destinatario_email_endereco_key`(`endereco`),
    INDEX `destinatario_email_ID_destinatario_fkey`(`ID_destinatario`),
    PRIMARY KEY (`ID_destinatario_email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedor_email` (
    `ID_fornecedor_email` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_fornecedor` INTEGER NOT NULL,
    `endereco` VARCHAR(191) NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `fornecedor_email_endereco_key`(`endereco`),
    INDEX `fornecedor_email_ID_fornecedor_fkey`(`ID_fornecedor`),
    PRIMARY KEY (`ID_fornecedor_email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversao_unidade` (
    `ID_conversao` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `fator` DOUBLE NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `padrao` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `conversao_unidade_nome_key`(`nome`),
    PRIMARY KEY (`ID_conversao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produto` (
    `ID_produto` INTEGER NOT NULL AUTO_INCREMENT,
    `descricao` VARCHAR(191) NOT NULL,
    `perecivel` BOOLEAN NOT NULL DEFAULT false,
    `composto` BOOLEAN NOT NULL DEFAULT false,
    `data_validade` DATE NULL,
    `ID_conversao_padrao` INTEGER NOT NULL DEFAULT 1,
    `ID_conversao_saida` INTEGER NOT NULL DEFAULT 1,
    `saldo` DOUBLE NOT NULL DEFAULT 0,
    `saldo_reservado` DOUBLE NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `produto_ID_conversao_padrao_fkey`(`ID_conversao_padrao`),
    INDEX `produto_ID_conversao_saida_fkey`(`ID_conversao_saida`),
    PRIMARY KEY (`ID_produto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produto_insumo` (
    `ID_produto_insumo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_produto_pai` INTEGER NOT NULL,
    `ID_produto_filho` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `produto_insumo_ID_produto_filho_fkey`(`ID_produto_filho`),
    INDEX `produto_insumo_ID_produto_pai_fkey`(`ID_produto_pai`),
    PRIMARY KEY (`ID_produto_insumo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentacao_estoque` (
    `ID_movimentacao` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_produto` INTEGER NOT NULL,
    `ID_usuario` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,
    `saldo_anterior` DOUBLE NULL,
    `saldo_posterior` DOUBLE NULL,
    `ID_nota_saida` INTEGER NULL,
    `ID_nota_entrada` INTEGER NULL,
    `ID_ajuste_inventario` INTEGER NULL,
    `data_hora` TIMESTAMP(0) NOT NULL,
    `observacao` TEXT NULL,

    INDEX `movimentacao_estoque_ID_produto_fkey`(`ID_produto`),
    INDEX `movimentacao_estoque_ID_nota_entrada_fkey`(`ID_nota_entrada`),
    INDEX `movimentacao_estoque_ID_nota_saida_fkey`(`ID_nota_saida`),
    INDEX `movimentacao_estoque_ID_ajuste_inventario_fkey`(`ID_ajuste_inventario`),
    INDEX `movimentacao_estoque_ID_usuario_fkey`(`ID_usuario`),
    PRIMARY KEY (`ID_movimentacao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reserva_estoque` (
    `ID_reserva_estoque` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_produto` INTEGER NOT NULL,
    `ID_nota_saida` INTEGER NOT NULL,
    `ID_usuario` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,
    `saldo_anterior` DOUBLE NULL,
    `saldo_posterior` DOUBLE NULL,
    `data_hora` TIMESTAMP(0) NOT NULL,
    `observacao` TEXT NULL,

    INDEX `reserva_estoque_ID_produto_fkey`(`ID_produto`),
    INDEX `reserva_estoque_ID_nota_saida_fkey`(`ID_nota_saida`),
    INDEX `reserva_estoque_ID_usuario_fkey`(`ID_usuario`),
    PRIMARY KEY (`ID_reserva_estoque`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventario` (
    `ID_inventario` INTEGER NOT NULL AUTO_INCREMENT,
    `data_inicio` DATE NOT NULL,
    `data_fim` DATE NULL,
    `contagem_cega` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ABERTO', 'EM_CONTAGEM', 'AGUARDANDO_APROVACAO', 'FINALIZADO', 'CANCELADO') NOT NULL,
    `ID_usuario_abertura` INTEGER NOT NULL,
    `ID_usuario_aprovacao` INTEGER NULL,
    `observacao` TEXT NULL,

    INDEX `inventario_ID_usuario_abertura_fkey`(`ID_usuario_abertura`),
    INDEX `inventario_ID_usuario_aprovacao_fkey`(`ID_usuario_aprovacao`),
    PRIMARY KEY (`ID_inventario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_inventario` (
    `ID_item_inventario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_inventario` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `quantidade_sistema` DOUBLE NOT NULL,
    `observacao` TEXT NULL,
    `quantidade_final` DOUBLE NULL,
    `origem` ENUM('MEDIA', 'CONTAGEM') NULL,
    `ID_contagem_inventario` INTEGER NULL,
    `decidido_em` TIMESTAMP(0) NULL,
    `ID_usuario_decisao` INTEGER NULL,

    INDEX `item_inventario_ID_produto_fkey`(`ID_produto`),
    INDEX `item_inventario_ID_inventario_fkey`(`ID_inventario`),
    UNIQUE INDEX `item_inventario_ID_inventario_ID_produto_key`(`ID_inventario`, `ID_produto`),
    PRIMARY KEY (`ID_item_inventario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contagem_inventario` (
    `ID_contagem_inventario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_item_inventario` INTEGER NOT NULL,
    `ID_funcionario` INTEGER NOT NULL,
    `quantidade_contada` DOUBLE NOT NULL,
    `data_contagem` TIMESTAMP(0) NOT NULL,
    `observacao` TEXT NULL,

    INDEX `contagem_inventario_ID_funcionario_fkey`(`ID_funcionario`),
    INDEX `contagem_inventario_ID_item_inventario_fkey`(`ID_item_inventario`),
    UNIQUE INDEX `contagem_inventario_ID_item_ID_funcionario_key`(`ID_item_inventario`, `ID_funcionario`),
    PRIMARY KEY (`ID_contagem_inventario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ajuste_inventario` (
    `ID_ajuste_inventario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_inventario` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `quantidade_contada` DOUBLE NOT NULL,
    `origem` ENUM('MEDIA', 'CONTAGEM') NOT NULL,
    `ID_contagem_inventario` INTEGER NULL,
    `status` ENUM('PENDENTE', 'APROVADO', 'REJEITADO') NOT NULL,
    `ID_usuario_aprovacao` INTEGER NULL,
    `data_aprovacao` TIMESTAMP(0) NULL,
    `justificativa` TEXT NULL,

    INDEX `ajuste_inventario_ID_produto_fkey`(`ID_produto`),
    INDEX `ajuste_inventario_ID_inventario_fkey`(`ID_inventario`),
    INDEX `ajuste_inventario_ID_contagem_inventario_fkey`(`ID_contagem_inventario`),
    INDEX `ajuste_inventario_ID_usuario_aprovacao_fkey`(`ID_usuario_aprovacao`),
    UNIQUE INDEX `ajuste_inventario_ID_inventario_ID_produto_key`(`ID_inventario`, `ID_produto`),
    PRIMARY KEY (`ID_ajuste_inventario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido_escola` (
    `ID_pedido_escola` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_destinatario` INTEGER NOT NULL,
    `ID_nota_saida` INTEGER NULL,
    `data_criacao` TIMESTAMP(0) NOT NULL,
    `status` ENUM('PENDENTE', 'CONFIRMADO', 'RECUSADO') NOT NULL,
    `observacao` TEXT NULL,

    INDEX `pedido_escola_ID_destinatario_fkey`(`ID_destinatario`),
    INDEX `pedido_escola_ID_nota_saida_fkey`(`ID_nota_saida`),
    PRIMARY KEY (`ID_pedido_escola`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_pedido_escola` (
    `ID_item_pedido_escola` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_pedido_escola` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,
    `observacao` TEXT NULL,

    INDEX `item_pedido_escola_ID_pedido_escola_fkey`(`ID_pedido_escola`),
    INDEX `item_pedido_escola_ID_produto_fkey`(`ID_produto`),
    PRIMARY KEY (`ID_item_pedido_escola`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nota_saida` (
    `ID_nota_saida` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_destinatario` INTEGER NULL,
    `data_criacao` TIMESTAMP(0) NOT NULL,
    `tipo` ENUM('SAIDA', 'DESMONTAGEM', 'CONSUMO_INTERNO', 'AVARIA') NOT NULL,
    `status` ENUM('ABERTA', 'EM_PERCURSO', 'PENDENTE', 'BAIXA_TOTAL', 'BAIXA_PARCIAL', 'BAIXA_COM_CORTE', 'CANCELADA') NOT NULL,
    `urgente` BOOLEAN NOT NULL DEFAULT false,
    `observacao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `nota_saida_ID_destinatario_fkey`(`ID_destinatario`),
    PRIMARY KEY (`ID_nota_saida`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_nota_saida` (
    `ID_item_nota_saida` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_nota_saida` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `qtd_esperada` DOUBLE NOT NULL,
    `qtd_entregue` DOUBLE NOT NULL DEFAULT 0,
    `observacao` TEXT NULL,

    INDEX `item_nota_saida_ID_produto_fkey`(`ID_produto`),
    INDEX `item_nota_saida_ID_nota_saida_fkey`(`ID_nota_saida`),
    UNIQUE INDEX `item_nota_saida_nota_produto_key`(`ID_nota_saida`, `ID_produto`),
    PRIMARY KEY (`ID_item_nota_saida`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coleta` (
    `ID_coleta` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_nota_saida` INTEGER NOT NULL,
    `ID_destinatario` INTEGER NOT NULL,
    `data_criacao` TIMESTAMP(0) NOT NULL,
    `observacao` TEXT NULL,

    INDEX `coleta_ID_destinatario_fkey`(`ID_destinatario`),
    INDEX `coleta_ID_nota_saida_fkey`(`ID_nota_saida`),
    PRIMARY KEY (`ID_coleta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_coleta` (
    `ID_item_coleta` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_coleta` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,

    INDEX `item_coleta_ID_coleta_fkey`(`ID_coleta`),
    INDEX `item_coleta_ID_produto_fkey`(`ID_produto`),
    PRIMARY KEY (`ID_item_coleta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `percurso` (
    `ID_percurso` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,

    PRIMARY KEY (`ID_percurso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `percurso_destinatario` (
    `ID_percurso` INTEGER NOT NULL,
    `ID_destinatario` INTEGER NOT NULL,
    `ordem_visita` INTEGER NOT NULL,

    INDEX `percurso_destinatario_ID_destinatario_fkey`(`ID_destinatario`),
    PRIMARY KEY (`ID_percurso`, `ID_destinatario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expedicao` (
    `ID_expedicao` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_veiculo` INTEGER NOT NULL,
    `ID_funcionario_condutor` INTEGER NOT NULL,
    `data_criacao` TIMESTAMP(0) NOT NULL,
    `data_prevista` DATE NOT NULL,
    `observacao` TEXT NULL,
    `status` ENUM('PLANEJADA', 'EM_PERCURSO', 'CONCLUIDA') NOT NULL DEFAULT 'PLANEJADA',
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `expedicao_ID_funcionario_condutor_fkey`(`ID_funcionario_condutor`),
    INDEX `expedicao_ID_veiculo_fkey`(`ID_veiculo`),
    PRIMARY KEY (`ID_expedicao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expedicao_nota` (
    `ID_expedicao_nota` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_expedicao` INTEGER NOT NULL,
    `ID_nota_saida` INTEGER NOT NULL,
    `ordem_visita` INTEGER NOT NULL,
    `data_adicao` TIMESTAMP(0) NOT NULL,
    `justificativa` TEXT NULL,
    `data_tentativa` TIMESTAMP(0) NULL,
    `ID_usuario_tentativa` INTEGER NULL,

    INDEX `expedicao_nota_ID_nota_saida_fkey`(`ID_nota_saida`),
    INDEX `expedicao_nota_ID_expedicao_fkey`(`ID_expedicao`),
    INDEX `expedicao_nota_ID_usuario_tentativa_fkey`(`ID_usuario_tentativa`),
    PRIMARY KEY (`ID_expedicao_nota`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `veiculo` (
    `ID_veiculo` INTEGER NOT NULL AUTO_INCREMENT,
    `placa` VARCHAR(191) NOT NULL,
    `modelo` VARCHAR(191) NULL,
    `status` ENUM('DISPONIVEL', 'INDISPONIVEL', 'EM_EXPEDICAO') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `veiculo_placa_key`(`placa`),
    PRIMARY KEY (`ID_veiculo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nota_entrada` (
    `ID_nota_entrada` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_fornecedor` INTEGER NULL,
    `data_criacao` TIMESTAMP(0) NOT NULL,
    `tipo` ENUM('ENTRADA', 'DESMONTAGEM') NOT NULL,
    `data_recebimento` DATE NULL,
    `observacao` TEXT NULL,
    `chave_acesso` VARCHAR(44) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `nota_entrada_chave_acesso_key`(`chave_acesso`),
    INDEX `nota_entrada_ID_fornecedor_fkey`(`ID_fornecedor`),
    PRIMARY KEY (`ID_nota_entrada`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_nota_entrada` (
    `ID_item_nota_entrada` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_nota_entrada` INTEGER NOT NULL,
    `ID_produto` INTEGER NOT NULL,
    `quantidade` DOUBLE NOT NULL,
    `observacao` TEXT NULL,

    INDEX `item_nota_entrada_ID_nota_entrada_fkey`(`ID_nota_entrada`),
    INDEX `item_nota_entrada_ID_produto_fkey`(`ID_produto`),
    UNIQUE INDEX `item_nota_entrada_nota_produto_key`(`ID_nota_entrada`, `ID_produto`),
    PRIMARY KEY (`ID_item_nota_entrada`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anexo` (
    `ID_anexo` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_arquivo` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `tipo_mime` VARCHAR(191) NULL,
    `data_upload` TIMESTAMP(0) NOT NULL,
    `ID_usuario` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ID_produto` INTEGER NULL,
    `ID_funcionario` INTEGER NULL,
    `ID_expedicao_nota` INTEGER NULL,

    INDEX `anexo_ID_produto_fkey`(`ID_produto`),
    INDEX `anexo_ID_funcionario_fkey`(`ID_funcionario`),
    INDEX `anexo_ID_expedicao_nota_fkey`(`ID_expedicao_nota`),
    INDEX `anexo_ID_usuario_fkey`(`ID_usuario`),
    PRIMARY KEY (`ID_anexo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissao` (
    `ID_permissao` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `permissao_nome_key`(`nome`),
    PRIMARY KEY (`ID_permissao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `perfil` (
    `ID_perfil` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,

    UNIQUE INDEX `perfil_nome_key`(`nome`),
    PRIMARY KEY (`ID_perfil`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `perfil_permissao` (
    `ID_perfil` INTEGER NOT NULL,
    `ID_permissao` INTEGER NOT NULL,

    INDEX `perfil_permissao_ID_permissao_fkey`(`ID_permissao`),
    PRIMARY KEY (`ID_perfil`, `ID_permissao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_permissao` (
    `ID_usuario` INTEGER NOT NULL,
    `ID_permissao` INTEGER NOT NULL,

    INDEX `usuario_permissao_ID_permissao_fkey`(`ID_permissao`),
    PRIMARY KEY (`ID_usuario`, `ID_permissao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registro_auditoria` (
    `ID_registro_auditoria` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_usuario` INTEGER NOT NULL,
    `data_hora` TIMESTAMP(0) NOT NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `ID_entidade_afetada` INTEGER NULL,
    `dados_anteriores` JSON NULL,
    `dados_novos` JSON NULL,

    INDEX `registro_auditoria_ID_usuario_fkey`(`ID_usuario`),
    PRIMARY KEY (`ID_registro_auditoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagem_mural` (
    `ID_mensagem_mural` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_usuario` INTEGER NULL,
    `titulo` VARCHAR(191) NULL,
    `conteudo` TEXT NOT NULL,
    `data_publicacao` TIMESTAMP(0) NOT NULL,
    `data_expiracao` TIMESTAMP(0) NULL,
    `automatica` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `chave` VARCHAR(191) NULL,

    UNIQUE INDEX `mensagem_mural_chave_key`(`chave`),
    INDEX `mensagem_mural_ID_usuario_fkey`(`ID_usuario`),
    PRIMARY KEY (`ID_mensagem_mural`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `produto_codigo` ADD CONSTRAINT `produto_codigo_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produto_codigo` ADD CONSTRAINT `produto_codigo_ID_tipo_codigo_fkey` FOREIGN KEY (`ID_tipo_codigo`) REFERENCES `tipo_codigo`(`ID_tipo_codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario_codigo` ADD CONSTRAINT `destinatario_codigo_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario_codigo` ADD CONSTRAINT `destinatario_codigo_ID_tipo_codigo_fkey` FOREIGN KEY (`ID_tipo_codigo`) REFERENCES `tipo_codigo`(`ID_tipo_codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor_codigo` ADD CONSTRAINT `fornecedor_codigo_ID_fornecedor_fkey` FOREIGN KEY (`ID_fornecedor`) REFERENCES `fornecedor`(`ID_fornecedor`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor_codigo` ADD CONSTRAINT `fornecedor_codigo_ID_tipo_codigo_fkey` FOREIGN KEY (`ID_tipo_codigo`) REFERENCES `tipo_codigo`(`ID_tipo_codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario_codigo` ADD CONSTRAINT `funcionario_codigo_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario_codigo` ADD CONSTRAINT `funcionario_codigo_ID_tipo_codigo_fkey` FOREIGN KEY (`ID_tipo_codigo`) REFERENCES `tipo_codigo`(`ID_tipo_codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veiculo_codigo` ADD CONSTRAINT `veiculo_codigo_ID_tipo_codigo_fkey` FOREIGN KEY (`ID_tipo_codigo`) REFERENCES `tipo_codigo`(`ID_tipo_codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `veiculo_codigo` ADD CONSTRAINT `veiculo_codigo_ID_veiculo_fkey` FOREIGN KEY (`ID_veiculo`) REFERENCES `veiculo`(`ID_veiculo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_ID_pessoa_fisica_fkey` FOREIGN KEY (`ID_pessoa_fisica`) REFERENCES `pessoa_fisica`(`ID_pessoa_fisica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor` ADD CONSTRAINT `fornecedor_ID_endereco_fkey` FOREIGN KEY (`ID_endereco`) REFERENCES `endereco`(`ID_endereco`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor` ADD CONSTRAINT `fornecedor_ID_pessoa_juridica_fkey` FOREIGN KEY (`ID_pessoa_juridica`) REFERENCES `pessoa_juridica`(`ID_pessoa_juridica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario` ADD CONSTRAINT `destinatario_ID_endereco_fkey` FOREIGN KEY (`ID_endereco`) REFERENCES `endereco`(`ID_endereco`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario` ADD CONSTRAINT `destinatario_ID_pessoa_juridica_fkey` FOREIGN KEY (`ID_pessoa_juridica`) REFERENCES `pessoa_juridica`(`ID_pessoa_juridica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario` ADD CONSTRAINT `destinatario_ID_tipo_destinatario_fkey` FOREIGN KEY (`ID_tipo_destinatario`) REFERENCES `tipo_destinatario`(`ID_tipo_destinatario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario_telefone` ADD CONSTRAINT `funcionario_telefone_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario_telefone` ADD CONSTRAINT `destinatario_telefone_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor_telefone` ADD CONSTRAINT `fornecedor_telefone_ID_fornecedor_fkey` FOREIGN KEY (`ID_fornecedor`) REFERENCES `fornecedor`(`ID_fornecedor`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario_email` ADD CONSTRAINT `funcionario_email_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinatario_email` ADD CONSTRAINT `destinatario_email_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fornecedor_email` ADD CONSTRAINT `fornecedor_email_ID_fornecedor_fkey` FOREIGN KEY (`ID_fornecedor`) REFERENCES `fornecedor`(`ID_fornecedor`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produto` ADD CONSTRAINT `produto_ID_conversao_padrao_fkey` FOREIGN KEY (`ID_conversao_padrao`) REFERENCES `conversao_unidade`(`ID_conversao`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produto` ADD CONSTRAINT `produto_ID_conversao_saida_fkey` FOREIGN KEY (`ID_conversao_saida`) REFERENCES `conversao_unidade`(`ID_conversao`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produto_insumo` ADD CONSTRAINT `produto_insumo_ID_produto_filho_fkey` FOREIGN KEY (`ID_produto_filho`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produto_insumo` ADD CONSTRAINT `produto_insumo_ID_produto_pai_fkey` FOREIGN KEY (`ID_produto_pai`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_estoque` ADD CONSTRAINT `movimentacao_estoque_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_estoque` ADD CONSTRAINT `movimentacao_estoque_ID_nota_entrada_fkey` FOREIGN KEY (`ID_nota_entrada`) REFERENCES `nota_entrada`(`ID_nota_entrada`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_estoque` ADD CONSTRAINT `movimentacao_estoque_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_estoque` ADD CONSTRAINT `movimentacao_estoque_ID_ajuste_inventario_fkey` FOREIGN KEY (`ID_ajuste_inventario`) REFERENCES `ajuste_inventario`(`ID_ajuste_inventario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_estoque` ADD CONSTRAINT `movimentacao_estoque_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserva_estoque` ADD CONSTRAINT `reserva_estoque_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserva_estoque` ADD CONSTRAINT `reserva_estoque_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserva_estoque` ADD CONSTRAINT `reserva_estoque_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario` ADD CONSTRAINT `inventario_ID_usuario_abertura_fkey` FOREIGN KEY (`ID_usuario_abertura`) REFERENCES `usuario`(`ID_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario` ADD CONSTRAINT `inventario_ID_usuario_aprovacao_fkey` FOREIGN KEY (`ID_usuario_aprovacao`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_inventario` ADD CONSTRAINT `item_inventario_ID_contagem_inventario_fkey` FOREIGN KEY (`ID_contagem_inventario`) REFERENCES `contagem_inventario`(`ID_contagem_inventario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_inventario` ADD CONSTRAINT `item_inventario_ID_usuario_decisao_fkey` FOREIGN KEY (`ID_usuario_decisao`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_inventario` ADD CONSTRAINT `item_inventario_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_inventario` ADD CONSTRAINT `item_inventario_ID_inventario_fkey` FOREIGN KEY (`ID_inventario`) REFERENCES `inventario`(`ID_inventario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contagem_inventario` ADD CONSTRAINT `contagem_inventario_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contagem_inventario` ADD CONSTRAINT `contagem_inventario_ID_item_inventario_fkey` FOREIGN KEY (`ID_item_inventario`) REFERENCES `item_inventario`(`ID_item_inventario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ajuste_inventario` ADD CONSTRAINT `ajuste_inventario_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ajuste_inventario` ADD CONSTRAINT `ajuste_inventario_ID_inventario_fkey` FOREIGN KEY (`ID_inventario`) REFERENCES `inventario`(`ID_inventario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ajuste_inventario` ADD CONSTRAINT `ajuste_inventario_ID_contagem_inventario_fkey` FOREIGN KEY (`ID_contagem_inventario`) REFERENCES `contagem_inventario`(`ID_contagem_inventario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ajuste_inventario` ADD CONSTRAINT `ajuste_inventario_ID_usuario_aprovacao_fkey` FOREIGN KEY (`ID_usuario_aprovacao`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_escola` ADD CONSTRAINT `pedido_escola_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_escola` ADD CONSTRAINT `pedido_escola_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido_escola` ADD CONSTRAINT `item_pedido_escola_ID_pedido_escola_fkey` FOREIGN KEY (`ID_pedido_escola`) REFERENCES `pedido_escola`(`ID_pedido_escola`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido_escola` ADD CONSTRAINT `item_pedido_escola_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_saida` ADD CONSTRAINT `nota_saida_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_nota_saida` ADD CONSTRAINT `item_nota_saida_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_nota_saida` ADD CONSTRAINT `item_nota_saida_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coleta` ADD CONSTRAINT `coleta_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coleta` ADD CONSTRAINT `coleta_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_coleta` ADD CONSTRAINT `item_coleta_ID_coleta_fkey` FOREIGN KEY (`ID_coleta`) REFERENCES `coleta`(`ID_coleta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_coleta` ADD CONSTRAINT `item_coleta_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `percurso_destinatario` ADD CONSTRAINT `percurso_destinatario_ID_destinatario_fkey` FOREIGN KEY (`ID_destinatario`) REFERENCES `destinatario`(`ID_destinatario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `percurso_destinatario` ADD CONSTRAINT `percurso_destinatario_ID_percurso_fkey` FOREIGN KEY (`ID_percurso`) REFERENCES `percurso`(`ID_percurso`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expedicao` ADD CONSTRAINT `expedicao_ID_funcionario_condutor_fkey` FOREIGN KEY (`ID_funcionario_condutor`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expedicao` ADD CONSTRAINT `expedicao_ID_veiculo_fkey` FOREIGN KEY (`ID_veiculo`) REFERENCES `veiculo`(`ID_veiculo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expedicao_nota` ADD CONSTRAINT `expedicao_nota_ID_nota_saida_fkey` FOREIGN KEY (`ID_nota_saida`) REFERENCES `nota_saida`(`ID_nota_saida`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expedicao_nota` ADD CONSTRAINT `expedicao_nota_ID_expedicao_fkey` FOREIGN KEY (`ID_expedicao`) REFERENCES `expedicao`(`ID_expedicao`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expedicao_nota` ADD CONSTRAINT `expedicao_nota_ID_usuario_tentativa_fkey` FOREIGN KEY (`ID_usuario_tentativa`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_entrada` ADD CONSTRAINT `nota_entrada_ID_fornecedor_fkey` FOREIGN KEY (`ID_fornecedor`) REFERENCES `fornecedor`(`ID_fornecedor`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_nota_entrada` ADD CONSTRAINT `item_nota_entrada_ID_nota_entrada_fkey` FOREIGN KEY (`ID_nota_entrada`) REFERENCES `nota_entrada`(`ID_nota_entrada`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_nota_entrada` ADD CONSTRAINT `item_nota_entrada_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo` ADD CONSTRAINT `anexo_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo` ADD CONSTRAINT `anexo_ID_produto_fkey` FOREIGN KEY (`ID_produto`) REFERENCES `produto`(`ID_produto`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo` ADD CONSTRAINT `anexo_ID_funcionario_fkey` FOREIGN KEY (`ID_funcionario`) REFERENCES `funcionario`(`ID_funcionario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo` ADD CONSTRAINT `anexo_ID_expedicao_nota_fkey` FOREIGN KEY (`ID_expedicao_nota`) REFERENCES `expedicao_nota`(`ID_expedicao_nota`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfil_permissao` ADD CONSTRAINT `perfil_permissao_ID_perfil_fkey` FOREIGN KEY (`ID_perfil`) REFERENCES `perfil`(`ID_perfil`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfil_permissao` ADD CONSTRAINT `perfil_permissao_ID_permissao_fkey` FOREIGN KEY (`ID_permissao`) REFERENCES `permissao`(`ID_permissao`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_permissao` ADD CONSTRAINT `usuario_permissao_ID_permissao_fkey` FOREIGN KEY (`ID_permissao`) REFERENCES `permissao`(`ID_permissao`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_permissao` ADD CONSTRAINT `usuario_permissao_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registro_auditoria` ADD CONSTRAINT `registro_auditoria_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagem_mural` ADD CONSTRAINT `mensagem_mural_ID_usuario_fkey` FOREIGN KEY (`ID_usuario`) REFERENCES `usuario`(`ID_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
