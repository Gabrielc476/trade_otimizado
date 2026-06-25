# Track 2: Regras da Aplicação & Portas (Use Cases)

## Goal
Implementar os Casos de Uso (Application Layer) da Clean Architecture e definir as Portas (Ports) de entrada e saída, isolando o núcleo algorítmico de qualquer infraestrutura física de rede, concorrência ou banco de dados, utilizando injeção de dependência em tempo de compilação.

## Skills a Serem Utilizadas
*   `typescript-expert`: Modelagem rigorosa de contratos de tipos e interfaces em tempo de compilação.
*   `clean-code`: Garantia de legibilidade de código, separação de conceitos e responsabilidade única dos Casos de Uso.
*   `typescript-advanced-types`: Criação de assinaturas genéricas de portas que não gerem sobrecarga de conversão de tipos em tempo de execução.

## Tasks
*   [ ] **Task 1:** Definir as interfaces das Portas de Saída (Outward Ports) do domínio: `JournalingPort` (para o WAL) e `EventPublisherPort` (para os eventos WebSocket de match/trades).
    *   *Verificar:* Compilação TypeScript sem erros de importação cíclica ou vazamento de escopo.
*   [ ] **Task 2:** Implementar o caso de uso `PlaceOrderUseCase`, responsável por receber uma intenção de ordem, realizar validação de saldo via `Wallet`, invocar a escrita do log na porta correspondente e encaminhar a ordem para o `MatchingEngine`.
    *   *Verificar:* Teste unitário garante fluxo correto: valida saldo $\rightarrow$ grava log $\rightarrow$ executa match.
*   [ ] **Task 3:** Implementar o caso de uso `CancelOrderUseCase`, responsável por localizar a ordem ativa via ID no mapa do livro, retirá-la e desbloquear os saldos correspondentes do usuário na `Wallet`.
    *   *Verificar:* Teste unitário garante remoção instantânea e devolução estrita do saldo não utilizado.
*   [ ] **Task 4:** Implementar o caso de uso `MatchEngineLoopUseCase` para gerenciar a fila contínua de eventos no Worker Thread, processando sequencialmente cada entrada e despachando as notificações de execuções de ordens.
    *   *Verificar:* Testes simulando o laço do motor processando lotes de eventos com sucesso.
*   [ ] **Task 5:** Desenvolver a fábrica estática (`StaticFactory`) na inicialização do Worker para acoplar manualmente os Casos de Uso com as interfaces de portas, assegurando chamadas monomórficas diretas sem o uso de contêineres de DI dinâmicos.
    *   *Verificar:* V8 executa o inlining das chamadas de portas sob testes locais (comprovação via flags do Node: `--trace-deopt` / `--trace-opt` livre de desotimizações nas portas).

## Done When
*   [ ] A camada `src/application/` está 100% livre de importações de frameworks, bancos de dados ou APIs de rede.
*   [ ] Suíte de testes integrados valida o fluxo completo de negócios simulando portas com implementações em memória sem falhas.
