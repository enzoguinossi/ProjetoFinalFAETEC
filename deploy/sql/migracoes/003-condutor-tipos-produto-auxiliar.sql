-- Nexus - migração 003: condutor, tipos de produto e auxiliar na expedição.
--
-- Executar em bancos existentes (modo Update) antes do seed novo. Em banco novo
-- o schema.sql já nasce com a tabela/colunas/índices/FKs; esta migração apenas
-- confirma que tudo existe (é idempotente).
--
-- 1. cria `tipo_produto` (cadastro opcional do produto);
-- 2. adiciona os campos de condutor em `funcionario` (todos opcionais);
-- 3. adiciona `produto.ID_tipo_produto` + índice + FK `ON DELETE SET NULL`;
-- 4. adiciona `expedicao.ID_funcionario_auxiliar` + índice + FK
--    `ON DELETE SET NULL`.
--
-- Nenhum dado existente é apagado ou alterado.

SET NAMES utf8mb4;

-- 1. Cadastro de tipo de produto (sem tipo padrão).
CREATE TABLE IF NOT EXISTS `tipo_produto` (
    `ID_tipo_produto` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `padrao` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tipo_produto_codigo_key`(`codigo`),
    UNIQUE INDEX `tipo_produto_nome_key`(`nome`),
    PRIMARY KEY (`ID_tipo_produto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Dados de condutor no funcionário (opcionais).
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'funcionario'
              AND COLUMN_NAME = 'cnh'
        ),
        'DO 0',
        'ALTER TABLE `funcionario` ADD COLUMN `cnh` VARCHAR(11) NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'funcionario'
              AND COLUMN_NAME = 'categoria_cnh'
        ),
        'DO 0',
        'ALTER TABLE `funcionario` ADD COLUMN `categoria_cnh` VARCHAR(5) NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'funcionario'
              AND COLUMN_NAME = 'validade_cnh'
        ),
        'DO 0',
        'ALTER TABLE `funcionario` ADD COLUMN `validade_cnh` DATE NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'funcionario'
              AND COLUMN_NAME = 'tipo_sanguineo'
        ),
        'DO 0',
        'ALTER TABLE `funcionario` ADD COLUMN `tipo_sanguineo` VARCHAR(3) NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3a. Vínculo opcional do produto com o tipo.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'produto'
              AND COLUMN_NAME = 'ID_tipo_produto'
        ),
        'DO 0',
        'ALTER TABLE `produto` ADD COLUMN `ID_tipo_produto` INT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3b. Índice da FK do tipo de produto.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'produto'
              AND INDEX_NAME = 'produto_ID_tipo_produto_fkey'
        ),
        'DO 0',
        'CREATE INDEX `produto_ID_tipo_produto_fkey` ON `produto` (`ID_tipo_produto`)'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3c. FK do tipo de produto: excluir o tipo deixa o produto sem tipo.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'produto'
              AND CONSTRAINT_NAME = 'produto_ID_tipo_produto_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ),
        'DO 0',
        'ALTER TABLE `produto` ADD CONSTRAINT `produto_ID_tipo_produto_fkey` FOREIGN KEY (`ID_tipo_produto`) REFERENCES `tipo_produto` (`ID_tipo_produto`) ON DELETE SET NULL ON UPDATE CASCADE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4a. Auxiliar opcional da expedição.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'expedicao'
              AND COLUMN_NAME = 'ID_funcionario_auxiliar'
        ),
        'DO 0',
        'ALTER TABLE `expedicao` ADD COLUMN `ID_funcionario_auxiliar` INT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4b. Índice da FK do auxiliar.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'expedicao'
              AND INDEX_NAME = 'expedicao_ID_funcionario_auxiliar_fkey'
        ),
        'DO 0',
        'CREATE INDEX `expedicao_ID_funcionario_auxiliar_fkey` ON `expedicao` (`ID_funcionario_auxiliar`)'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4c. FK do auxiliar: excluir o funcionário deixa a expedição sem auxiliar.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'expedicao'
              AND CONSTRAINT_NAME = 'expedicao_ID_funcionario_auxiliar_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ),
        'DO 0',
        'ALTER TABLE `expedicao` ADD CONSTRAINT `expedicao_ID_funcionario_auxiliar_fkey` FOREIGN KEY (`ID_funcionario_auxiliar`) REFERENCES `funcionario` (`ID_funcionario`) ON DELETE SET NULL ON UPDATE CASCADE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
