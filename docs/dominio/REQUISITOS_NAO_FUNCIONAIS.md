# Requisitos Não Funcionais — Projeto Nexus

| ID | Requisito | Categoria | Prioridade |
|----|-----------|-----------|------------|
| RNF001 | **Arquitetura Desktop Web:** Aplicação web conectada a SGBD MySQL | Arquitetura | Essencial |
| RNF002 | **Desempenho:** Busca por código de barras ou Kanban < 2 segundos em rede local | Desempenho | Importante |
| RNF003 | **Usabilidade:** Interface simples e intuitiva para operadores de almoxarifado | Usabilidade | Essencial |
| RNF004 | **Segurança/Perfis:** Acesso filtrado dinamicamente conforme perfil autenticado | Segurança | Essencial |
| RNF005 | **Backup/Integridade:** Consistência referencial + rotinas de backup | Confiabilidade | Essencial |
| RNF006 | **Segurança/Autenticação:** Senhas armazenadas com hash criptográfico seguro (BCrypt) | Segurança | Essencial |
| RNF007 | **Auditabilidade:** Snapshot dos dados anteriores e novos em formato JSON | Arquitetura de Dados | Essencial |
| RNF008 | **Portabilidade:** Suporte aos formatos PDF, CSV e XLSX para exportação | Portabilidade | Essencial |
| RNF009 | **Interoperabilidade:** Capacidade de processar XML NF-e (padrão SEFAZ) | Interoperabilidade | Desejável |