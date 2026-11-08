-- Nexus — migração 002: tipo de destinatário passa de enum para cadastro.
--
-- Executar em bancos existentes (modo Update) antes do seed novo. Em banco novo
-- o schema.sql já nasce com a tabela, a coluna, o índice e a FK; esta migração
-- apenas confirma que tudo existe (é idempotente).
--
-- 1. cria `tipo_destinatario` e insere os 4 tipos de referência só se vazia;
-- 2. adiciona `destinatario.ID_tipo_destinatario` quando ainda não existe;
-- 3. mapeia o enum antigo (`tipo_destinatario`) pelo `codigo`;
-- 4. cria índice e FK `ON DELETE SET NULL`;
-- 5. remove a coluna enum antiga.
--
-- Nada é apagado de destinatários: apenas a coluna enum deixa de existir.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tipo_destinatario` (
    `ID_tipo_destinatario` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `padrao` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tipo_destinatario_codigo_key`(`codigo`),
    UNIQUE INDEX `tipo_destinatario_nome_key`(`nome`),
    PRIMARY KEY (`ID_tipo_destinatario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @qtd_tipo_destinatario := (SELECT COUNT(*) FROM `tipo_destinatario`);
INSERT INTO `tipo_destinatario` (`codigo`, `nome`, `padrao`)
SELECT `codigo`, `nome`, `padrao` FROM (
    SELECT 'ESCOLA' AS `codigo`, 'Escola' AS `nome`, TRUE AS `padrao`
    UNION ALL SELECT 'CRECHE', 'Creche', FALSE
    UNION ALL SELECT 'CMEI', 'CMEI', FALSE
    UNION ALL SELECT 'CMEIA', 'CMEIA', FALSE
) AS novos
WHERE @qtd_tipo_destinatario = 0;

-- 2. Coluna de vínculo (opcional) no destinatário.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'destinatario'
              AND COLUMN_NAME = 'ID_tipo_destinatario'
        ),
        'DO 0',
        'ALTER TABLE `destinatario` ADD COLUMN `ID_tipo_destinatario` INT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Mapeia o enum antigo pelo código (só enquanto a coluna existir).
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'destinatario'
              AND COLUMN_NAME = 'tipo_destinatario'
        ),
        'UPDATE `destinatario` d JOIN `tipo_destinatario` t ON t.`codigo` = d.`tipo_destinatario` SET d.`ID_tipo_destinatario` = t.`ID_tipo_destinatario`',
        'DO 0'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4a. Índice da FK.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'destinatario'
              AND INDEX_NAME = 'destinatario_ID_tipo_destinatario_fkey'
        ),
        'DO 0',
        'CREATE INDEX `destinatario_ID_tipo_destinatario_fkey` ON `destinatario` (`ID_tipo_destinatario`)'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4b. FK `ON DELETE SET NULL`: excluir o tipo deixa os destinatários sem tipo.
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'destinatario'
              AND CONSTRAINT_NAME = 'destinatario_ID_tipo_destinatario_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ),
        'DO 0',
        'ALTER TABLE `destinatario` ADD CONSTRAINT `destinatario_ID_tipo_destinatario_fkey` FOREIGN KEY (`ID_tipo_destinatario`) REFERENCES `tipo_destinatario` (`ID_tipo_destinatario`) ON DELETE SET NULL ON UPDATE CASCADE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Remove a coluna enum antiga (o vínculo agora é por ID).
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'destinatario'
              AND COLUMN_NAME = 'tipo_destinatario'
        ),
        'ALTER TABLE `destinatario` DROP COLUMN `tipo_destinatario`',
        'DO 0'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
