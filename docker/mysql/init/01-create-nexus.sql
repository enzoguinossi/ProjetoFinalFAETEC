-- Garante o banco com charset/colation corretos.
-- O usuário da aplicação (MYSQL_USER/MYSQL_PASSWORD) é criado automaticamente
-- pela imagem oficial do MySQL e recebe GRANT sobre MYSQL_DATABASE.
CREATE DATABASE IF NOT EXISTS `Nexus`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
