# Track 3: Adaptadores & Concorrência (Multithread / SAB)

## Goal
Configurar a infraestrutura de concorrência baseada em `worker_threads` do Node.js, isolar o motor de casamento na Worker Thread e implementar o fluxo de saldos ultraveloz lock-free via `SharedArrayBuffer` e `Atomics`.

## Skills a Serem Utilizadas
*   `typescript-pro`: Criação e gerenciamento do ciclo de vida de `worker_threads`, passagem de mensagens e manipulação de TypedArrays estruturadas fora do heap do JS.
*   `performance-profiling`: Medição e diagnóstico de tempos de transmissão de mensagens, atrasos no Event Loop e latência de acessos à memória compartilhada.
*   `windows-shell-reliability`: Execução e monitoramento seguro dos comandos de inicialização de threads paralelos no ambiente Windows.

## Tasks
*   [ ] **Task 1:** Criar o módulo de infraestrutura `WorkerThreadDriver` para inicializar a thread de CPU dedicada do motor de casamento e configurar os canais de mensagens bidirecionais (`MessageChannel`).
    *   *Verificar:* Teste físico inicializa a thread secundária e recebe mensagens básicas de ping-pong com latência <1ms.
*   [ ] **Task 2:** Alocar o `SharedArrayBuffer` plano na inicialização do NestJS (Thread Principal) mapeando `10.000 usuários * 2 moedas * 8 bytes (Float64) = 160.000 bytes`.
    *   *Verificar:* Instanciação do buffer em memória e passagem segura da referência para o Worker durante o boot.
*   [ ] **Task 3:** Implementar o adaptador `SharedMemoryWalletReader` na Thread Principal (NestJS) para leitura direta de saldos concorrentes utilizando `Atomics.load` em tempo constante $O(1)$.
    *   *Verificar:* Leitura atômica de saldo retorna valores idênticos aos definidos no buffer físico.
*   [ ] **Task 4:** Implementar a escrita do saldo do lado do motor (Worker Thread) através da API de `Atomics.store` e `Atomics.add` para garantir thread-safety absoluto a nível de barramento de memória sem locks bloqueantes.
    *   *Verificar:* Escritas intensivas concorrentes no Worker refletem instantaneamente no leitor da Thread Principal sem corrupção de dados ou inconsistências.
*   [ ] **Task 5:** Implementar o `WorkerThreadMessageAdapter` para escutar requisições de ordens da Thread Principal e despachá-las ao laço crítico de Use Cases do motor.
    *   *Verificar:* Envio e recebimento contínuo de 10.000 ordens via postMessage operando estável sem travamentos do Event Loop.

## Done When
*   [ ] O motor executa isolado em thread dedicada de CPU.
*   [ ] A Thread Principal consulta saldos dos usuários instantaneamente na memória física com complexidade $O(1)$ e tempo inferior a 50 nanossegundos por consulta.
*   [ ] Testes de estresse concorrentes comprovam imunidade absoluta contra condições de corrida (*race conditions*) de saldo.
