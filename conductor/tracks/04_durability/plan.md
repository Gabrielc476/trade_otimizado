# Track 4: Durability and WAL (Write-Ahead Log & DB)

## Goal
Implementar o mecanismo de persistência rápida baseado em Write-Ahead Log (WAL) sequencial binário em disco e o sincronizador assíncrono tardio no PostgreSQL em lotes (Bulk Copy) utilizando o padrão Outbox.

## Skills a Serem Utilizadas
*   `database`: Modelagem otimizada de tabelas, índices avançados e gestão de concorrência relacional no PostgreSQL.
*   `database-design`: Arquitetura de persistência desacoplada (Event Sourcing / WAL / Outbox Pattern).
*   `postgres-best-practices`: Configurações de conexões eficientes e escrita de alto throughput.
*   `sql-pro`: Escrita de queries SQL nativas ultravelozes (multi-row inserts / bulk transactions).

## Tasks
*   [ ] **Task 1:** Desenvolver o adaptador `BinaryWALJournalAdapter` na Thread Principal do NestJS, gravando sequencialmente cada ordem em disco em um buffer binário compacto de 33 bytes.
    *   *Verificar:* Teste de escrita sequencial em disco valida que cada ordem é anexada de forma síncrona em sub-milissegundos (<200 microssegundos).
*   [ ] **Task 2:** Implementar a rotina de Recuperação de Desastre (*Crash Recovery*): leitura sequencial do arquivo WAL binário na inicialização do sistema para reconstruir o estado do Order Book e Wallet na RAM.
    *   *Verificar:* Desligar o servidor de forma forçada no meio de negociações, reiniciar o processo e checar se o estado de memória e saldos foi reconstituído com 100% de exatidão.
*   [ ] **Task 3:** Configurar a modelagem física no PostgreSQL (tabelas de usuários, histórico de execuções de ordens, histórico de transações e a tabela de Outbox para sincronização de saldo).
    *   *Verificar:* Execução de migrações e validação dos índices no banco.
*   [ ] **Task 4:** Desenvolver o serviço `PgSyncWorker` de segundo plano. Ele monitora a cauda do arquivo WAL ou eventos de match, acumula em memória e executa inserções em lote (*bulk insert* ou *COPY* no PostgreSQL) a cada 1 segundo ou 1.000 transações.
    *   *Verificar:* Teste de carga valida inserção de 100.000 históricos de trades no PostgreSQL sem gerar lentidão no Event Loop ou sobrecarregar a piscina de conexões de rede do banco.
*   [ ] **Task 5:** Implementar o padrão Outbox para depósitos e saques: a transação é escrita de forma ACID no PostgreSQL junto a um evento de Outbox, e o `OutboxPoller` consome o evento e escreve no WAL para atualização física e segura no motor de casamento.
    *   *Verificar:* Validação de fluxo ponta a ponta garantindo consistência eventual entre o banco físico e os saldos ativos do motor.

## Done When
*   [ ] Toda escrita do motor é durável fisicamente em disco (WAL) antes do casamento ocorrer.
*   [ ] O sistema se recupera de falhas de energia reconstruindo o livro na memória RAM em poucos segundos.
*   [ ] O PostgreSQL atua de forma assíncrona, operando livre de gargalos transacionais ou contenções de locks no banco.
