# Track 1: Domínio Puro & Algoritmo (Core Engine)

## Goal
Implementar o núcleo do motor de cruzamento de ordens em memória (Order Book, Doubly Linked List, Red-Black Tree, Wallet e Object Pool) em TypeScript puro, livre de dependências externas, aplicando otimizações avançadas de baixo nível para a V8 Engine.

## Skills a Serem Utilizadas
*   `typescript-expert`: Garante tipagem estrita (`strict: true`) e compilação otimizada.
*   `typescript-pro`: Aplicação de regras de monomorfismo, shapes de objetos estáveis, prevenção de Garbage Collection e uso de TypedArrays fora do heap principal.
*   `tdd-workflow`: Condução do desenvolvimento algorítmico sob o ciclo rigoroso RED-GREEN-REFACTOR.
*   `unit-testing-test-generate`: Geração de testes unitários Jest exaustivos cobrindo 90%+ de branch coverage.

## Tasks
*   [ ] **Task 1:** Criar a classe de entidade `Order` com estrutura fixa de hidden classes (construtor declarando todas as propriedades, sem chaves opcionais) e a classe `OrderPool` para reciclagem estática de referências.
    *   *Verificar:* Teste unitário valida aquisição e liberação de 100.000 instâncias mantendo o uso do heap do Node estável.
*   [ ] **Task 2:** Desenvolver a estrutura de dados `DoublyLinkedList` e seus nós específicos para a fila de ordens FIFO de cada nível de preço.
    *   *Verificar:* Teste unitário garante que inserção no fim e remoção em qualquer ponto do nó ocorrem em tempo constante $O(1)$.
*   [ ] **Task 3:** Implementar a árvore binária de busca balanceada (`RedBlackTree` ou `AVLTree`) para armazenar os níveis de preço de compra (*Bids* - ordem decrescente) e venda (*Asks* - ordem crescente).
    *   *Verificar:* Teste unitário garante ordenação correta, balanceamento automático de altura e busca do topo em $O(\log N)$.
*   [ ] **Task 4:** Desenvolver a entidade `Wallet` para controle de saldos em memória dos usuários, implementando métodos puramente síncronos de débito, crédito e reserva de saldo.
    *   *Verificar:* Teste unitário garante consistência matemática e impede saldos negativos.
*   [ ] **Task 5:** Implementar a classe `MatchingEngine` integrada, processando ordens limites e a mercado, executando casamentos parciais/totais (regra FIFO) e gerando logs de negócios (*trades*) na memória.
    *   *Verificar:* Testes unitários validam cruzamento correto de ordens concorrentes e liquidação de saldos correspondentes nas wallets.

## Done When
*   [ ] A suíte de testes do Jest cobre 90%+ de branch coverage das classes em `src/domain/`.
*   *   [ ] Benchmark local atinge tempo de processamento inferior a 150 microssegundos por cruzamento no ciclo interno.
