-- Nexus — migração 001: renomeia as unidades de seed para PCT10/CX50.
--
-- Executar em bancos que já tinham o seed antigo (PACOTE/CAIXA) antes de rodar
-- o seed novo. Preserva `ID_conversao` e, portanto, os vínculos de produto
-- (ID_conversao_padrao / ID_conversao_saida).
--
-- Idempotente: a segunda execução não encontra mais PACOTE/CAIXA e não altera
-- nada. Em banco novo (seed já com PCT10/CX50) também não altera nada.
-- Rodar ANTES do novo `seed.sql` no mesmo banco.

UPDATE `conversao_unidade` SET `nome` = 'PCT10' WHERE `nome` = 'PACOTE' AND `fator` = 10;
UPDATE `conversao_unidade` SET `nome` = 'CX50' WHERE `nome` = 'CAIXA' AND `fator` = 50;
