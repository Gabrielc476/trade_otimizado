# Track 7: Simulação de Carga HFT & Validação de Métricas (K6)

## Goal
Validar a performance da arquitetura multithread do ApexTrade sob carga extrema. Desenvolver scripts de testes de estresse e simulação de mercado de alta frequência (HFT) utilizando o **k6** para coletar métricas empíricas de throughput, latência de V8 e frame-rate no terminal 3D.

## Skills a Serem Utilizadas
*   `performance-profiling`: Medição científica de tempo de execução, identificação de gargalos de I/O, análise de CPU/memória e gargalos de threads.
*   `performance-engineer`: Configuração de testes de carga realistas, simulação de concorrência massiva e interpretação de percentis de latência (p50/p99).
*   `webapp-testing`: Automatização e testes ponta a ponta de interfaces web dinâmicas e endpoints de comunicação persistente (WebSockets).

## Tasks
*   [ ] **Task 1:** Desenvolver o script de teste de carga utilizando o **k6** para simular milhares de usuários virtuais concorrentes enviando ordens e estabelecendo conexões persistentes WebSocket.
    *   *Verificar:* Script k6 inicializa e gera tráfego concorrente simulando picos crescentes de carga de forma coordenada.
*   [ ] **Task 2:** Integrar o coletor de métricas nativo `prom-client` no NestJS, expondo dados de RPS, latência interna do motor, uso de CPU e consumo de memória RAM do processo.
    *   *Verificar:* Acesso ao endpoint `/metrics` do NestJS expõe dados corretos atualizados em tempo de execução.
*   [ ] **Task 3:** Rodar o teste de carga k6 simulando o comportamento de **High-Frequency Trading (HFT)**: disparo contínuo de mais de 80.000 ordens de compra/venda limite por segundo com preços aleatórios no livro de ofertas.
    *   *Verificar:* Execução completa do teste de estresse mantendo a taxa de erro em 0% e validando o throughput e latências.
*   [ ] **Task 4:** Coletar e documentar os resultados empíricos: extrair os percentis de latência do motor (p50, p90, p99), consumo médio de CPU do servidor, e verificar se o uso de memória do heap do Node permaneceu estável (flatline) devido ao Object Pooling.
    *   *Verificar:* Relatório final do k6 e dados de telemetria consolidados em tabelas de performance.
*   [ ] **Task 5:** Validar o desempenho do terminal 3D no frontend durante a carga máxima de simulação do k6: checar se a aba do navegador manteve os **60 FPS estáveis** sob a enxurrada de snapshots WebSocket de 50ms e se as animações do reator 3D responderam corretamente à volatilidade.
    *   *Verificar:* Execução do profiler do Google Chrome na aba do frontend medindo taxas de frames e atividade de renderização do WebGL.

## Done When
*   [ ] O script de teste de carga k6 é capaz de estressar o servidor de forma concorrente e automatizada.
*   [ ] A arquitetura multithread do ApexTrade prova em relatórios empíricos a capacidade de casar mais de 80.000 ordens por segundo.
*   [ ] As métricas de p99 latência interna do motor permanecem abaixo de 1 milissegundo sob carga extrema de estresse.
*   [ ] O terminal visual 3D mantém renderização contínua a 60 FPS estáveis sem travamentos de thread principal no cliente.
