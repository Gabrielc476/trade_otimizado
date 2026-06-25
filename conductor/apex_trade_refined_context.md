# ApexTrade: Contexto Técnico Refinado e Especificação sob Clean Architecture

Este documento apresenta a especificação arquitetural de alta performance do **ApexTrade** refinada através dos princípios da **Clean Architecture (Arquitetura Limpa)**. O objetivo é desacoplar as regras de negócio centrais (casamento de ordens e saldos) dos detalhes de infraestrutura (NestJS, banco de dados, threads e WebSockets), mantendo as otimizações de nível de máquina na **V8 Engine (TypeScript)**.

---

## 1. O Desafio: Clean Architecture vs. Alta Performance
Tradicionalmente, a Clean Architecture introduz múltiplas camadas de abstração, injeções de dependência dinâmicas e mapeamentos de objetos entre camadas. No entanto, alocações frequentes de memória e indireções de chamadas de método destroem o desempenho da V8 Engine (causando pausas de Garbage Collection e impedindo a otimização JIT).

Para resolver isso, o ApexTrade adota a **Clean Architecture de Alta Performance**:
1. **Monotonia de Call Sites (Monomorfismo JIT):** As interfaces de Portas (Ports) possuem uma única implementação concreta ativa em tempo de execução no loop crítico. Isso garante que a V8 faça *inlining* (substituição da chamada de interface pelo código direto da função) durante a compilação JIT.
2. **Zero-Allocation Data Flow:** Os Adaptadores (Adapters) de entrada consomem dados brutos da rede e populam objetos reaproveitados obtidos de um *Object Pool* central, repassando-os limpos para os Casos de Uso (Use Cases) e Entidades (Entities). Não há instanciação de novos objetos DTO no ciclo crítico.
3. **CQRS Físico via Memória Compartilhada:** A leitura de dados (Query) e a alteração de dados (Command) são segregadas arquiteturalmente e fisicamente por meio de buffers compartilhados (`SharedArrayBuffer`).

---

## 2. Estrutura de Camadas (Clean Architecture)

```
                       ┌─────────────────────────────────────────────────────────┐
                       │               Frameworks & Drivers (Infra)              │
                       │     NestJS, PostgreSQL, worker_threads, Next.js         │
                       │                                                         │
                       │       ┌─────────────────────────────────────────┐       │
                       │       │        Interface Adapters (Adapters)    │       │
                       │       │   WS Controllers, WAL, DB Repositories  │       │
                       │       │                                         │       │
                       │       │       ┌─────────────────────────┐       │       │
                       │       │       │    Use Cases (Application)      │       │
                       │       │       │  PlaceOrder, MatchEngineLoop    │       │
                       │       │       │                         │       │       │
                       │       │       │       ┌─────────┐       │       │       │
                       │       │       │       │ Entities│       │       │       │
                       │       │       │       │  (Core) │       │       │       │
                       │       │       │       │OrderBook│       │       │       │
                       │       │       │       │ Wallet  │       │       │       │
                       │       │       │       └─────────┘       │       │       │
                       │       │       └─────────────────────────┘       │       │
                       │       └─────────────────────────────────────────┘       │
                       └─────────────────────────────────────────────────────────┘
```

### 2.1 Camada 1: Entities (Núcleo do Domínio)
Esta camada contém as regras de negócio fundamentais do sistema financeiro. Ela é totalmente isolada, auto-contida e não possui dependências de nenhuma biblioteca, banco de dados ou framework externo.
* **`Order` (Entidade):** Representa a intenção de compra ou venda. Contém a estrutura rígida de hidden classes para a V8.
* **`OrderBook` (Entidade):** Gerencia o livro de ofertas utilizando a árvore binária de busca balanceada e filas duplamente encadeadas. Executa as regras puras de prioridade de preço e tempo (FIFO).
* **`Wallet` (Entidade):** Gerencia os saldos e regras de validação financeira (débito, crédito, travas de fundos).
* **`Trade` (Entidade):** Representa o resultado físico de uma correspondência entre duas ordens.

### 2.2 Camada 2: Use Cases (Regras de Negócio da Aplicação)
Orquestra o fluxo de dados vindos de fora para dentro, interagindo diretamente com as Entidades. Define as **Portas (Ports)** de entrada e saída (interfaces) que a infraestrutura deve implementar.
* **`MatchEngineLoopUseCase`:** Loop contínuo que consome eventos de entrada, delega o cruzamento para a entidade `OrderBook` e atualiza a entidade `Wallet`.
* **`PlaceOrderUseCase`:** Valida regras de fluxo (ex: se a carteira possui saldo suficiente) e insere a ordem no livro de ofertas.
* **`CancelOrderUseCase`:** Remove a ordem do livro de ofertas e devolve a margem travada à carteira do usuário.
* **Portas de Saída (Outward Ports):**
  * `EventPublisherPort`: Interface para notificar o sistema sobre execuções de ordens (Trades) e atualizações L2.
  * `JournalingPort` (WAL): Interface para persistência síncrona imediata da intenção da ordem antes do processamento.

### 2.3 Camada 3: Interface Adapters (Adaptadores)
Converte dados no formato mais conveniente para os Casos de Uso e Entidades para o formato mais conveniente para agentes externos (Web, Banco de Dados, Threads).
* **`WorkerThreadMessageAdapter` (Input Adapter):** Escuta as mensagens cruas trafegadas de forma serializada pela thread principal e as traduz em chamadas tipadas para os Use Cases do motor.
* **`BinaryWALJournalAdapter` (Output Adapter):** Implementa o `JournalingPort`, escrevendo registros binários estruturados de tamanho fixo em disco físico.
* **`PostgresTradeHistoryRepository` (Output Adapter):** Implementa a persistência assíncrona tardia, salvando dados de auditoria no PostgreSQL em lotes utilizando *bulk inserts*.
* **`L2WebSocketPresenter` (Output Presenter):** Implementa o `EventPublisherPort`. Acumula deltas de transações, executa a consolidação das melhores ofertas a cada 50ms e prepara o payload otimizado para transmissão.

### 2.4 Camada 4: Frameworks & Drivers (Infraestrutura)
A camada mais externa, onde residem os detalhes de tecnologia. NestJS, bancos de dados físicos, servidores de rede e o próprio runtime do Node.js.
* **NestJS HTTP & WebSocket Server:** Responsável por escutar as portas de rede e prover a camada de transporte.
* **Node.js `worker_threads` Driver:** Inicializa e gerencia a thread de CPU isolada onde o motor de Clean Architecture é executado.
* **PostgreSQL Database Driver:** Gerencia a piscina de conexões (connection pool) e executa as queries SQL no disco físico.
* **Next.js Web App:** Interface do usuário que consome os dados e renderiza o terminal de trading.

---

## 3. Especificação do Fluxo de Dados sob Clean Architecture

O ciclo de vida de uma ordem percorre as camadas de forma estrita, garantindo a direção de dependência das camadas externas para as internas:

```
[Cliente] -> [NestJS (Infra)] -> [Controllers (Adapter)] -> [WAL Adapter (Adapter)] -> [WAL File (Infra)]
                                                                   │
                                                                   ▼
[Worker Thread (Infra)] -> [Worker Message Adapter] -> [PlaceOrderUseCase] -> [OrderBook & Wallet (Entities)]
                                                                   │
                                                                   ▼
[WebSocket Broadcast] <- [WS Presenter (Adapter)] <- [EventPublisherPort]
```

### 3.1 Detalhamento da Ingestão de Ordens
1. **Ingresso (Infra):** O cliente envia uma ordem via WebSocket. A conexão cai no `NestJS WebSocket Gateway` (Infra).
2. **Tradução (Adapter):** O gateway passa os dados para o `OrderController` (Adapter), que sanitiza o input e garante os tipos.
3. **Escrita no WAL (Adapter -> Infra):** O controlador chama o `BinaryWALJournalAdapter` (Adapter). Ele empacota os dados em um buffer binário compacto de 33 bytes e faz a gravação sequencial síncrona em disco no arquivo `wal.log` (Infra).
4. **Despacho Zero-Copy (Infra):** O controlador grava os dados básicos da ordem em um anel de transmissão seguro compartilhando a memória via `SharedArrayBuffer` ou envia via `MessagePort` para a Worker Thread (Infra).
5. **Consumo no Motor (Adapter -> Use Case):** Na thread isolada, o `WorkerMessageAdapter` intercepta o evento, resgata uma instância de `Order` do `OrderPool` (prevenindo Garbage Collection) e invoca o `PlaceOrderUseCase` (Use Case).
6. **Processamento do Negócio (Use Case -> Entity):**
   * O `PlaceOrderUseCase` consulta a entidade `Wallet` para validar saldo (leitura síncrona na memória do `SharedArrayBuffer`).
   * Se válido, passa a ordem para a entidade `OrderBook`, que busca correspondências na árvore binária balanceada.
   * Se houver correspondência (*match*), a entidade `Wallet` realiza os débitos e créditos nos saldos dos usuários envolvidos em $O(1)$.
   * Se não houver casamento imediato, a ordem é enfileirada em $O(1)$ na fila correspondente ao seu preço na árvore de ofertas.
7. **Saída de Eventos (Use Case -> Adapter -> Infra):**
   * O caso de uso notifica a porta `EventPublisherPort`.
   * O adaptador `L2WebSocketPresenter` recebe o evento de match e enfileira em seu buffer de agregação.
   * A cada 50ms, o apresentador extrai o estado L2 consolidado do livro e envia uma única mensagem formatada de volta para a thread principal (via *postMessage* com transferência de posse de objeto), que faz o broadcast imediato via WebSockets para os clientes.

---

## 4. Otimizações de Performance Aplicadas à Clean Architecture

Para assegurar que o design desacoplado não resulte em queda de performance, as seguintes regras são aplicadas na implementação física das camadas:

### 4.1 Monomorfismo e Prevenção de Desoptmization (JIT)
Na V8 Engine, se uma interface é implementada por apenas uma classe concreta, a chamada de método é considerada **monomórfica**. O compilador JIT otimiza isso eliminando a busca na tabela de métodos virtuais.
* **Regra:** Todas as portas (`JournalingPort`, `EventPublisherPort`) devem ter exatamente uma classe correspondente na thread do motor. Não use mocks ou múltiplas implementações de teste rodando no mesmo processo de produção.
* **Exemplo de Port e Adapter Otimizado:**
```typescript
// Camada de Use Cases (Application)
export interface EventPublisherPort {
  publishTrade(buyerId: number, sellerId: number, price: number, qty: number): void;
}

// Camada de Interface Adapters (Adapters)
// Esta classe deve ter propriedades estruturadas de forma fixa no construtor para manter seu Shape estável na V8
export class L2WebSocketPresenter implements EventPublisherPort {
  private readonly messagePort: MessagePort;
  private readonly updateBuffer: Float64Array; // Evita alocação de objetos para telemetria
  private bufferIndex: number = 0;

  constructor(messagePort: MessagePort) {
    this.messagePort = messagePort;
    this.updateBuffer = new Float64Array(1000); // Buffer pré-alocado
  }

  public publishTrade(buyerId: number, sellerId: number, price: number, qty: number): void {
    // Escrita direta no array plano sem criar objetos intermediários
    const idx = this.bufferIndex;
    this.updateBuffer[idx] = buyerId;
    this.updateBuffer[idx + 1] = sellerId;
    this.updateBuffer[idx + 2] = price;
    this.updateBuffer[idx + 3] = qty;
    this.bufferIndex += 4;

    if (this.bufferIndex >= 990) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.bufferIndex === 0) return;
    // Transfere o buffer de posse de memória sem realizar cópia profunda
    const payload = this.updateBuffer.slice(0, this.bufferIndex);
    this.messagePort.postMessage({ type: "TRADE_BATCH", data: payload }, [payload.buffer]);
    this.bufferIndex = 0;
  }
}
```

### 4.2 CQRS Físico e Abstração de Leitura de Saldos
Consultar saldo é uma operação de leitura intensiva (Query). Realizar essa busca enviando uma mensagem síncrona para a Worker Thread do motor congelaria a thread principal do NestJS, arruinando a taxa de requisições por segundo (RPS).
* **Solução com Clean Architecture:** O `Wallet` (Entidade) manipula a memória compartilhada no `SharedArrayBuffer`.
* Na thread principal, criamos um adaptador `SharedMemoryWalletReader` que implementa um port de leitura de carteira. Esse adaptador lê diretamente os dados de saldo do `SharedArrayBuffer` de forma atômica (`Atomics.load`).
* Isso preserva a separação de responsabilidades da Clean Architecture (o controlador NestJS não sabe que existe um `SharedArrayBuffer` físico, ele apenas conversa com a interface `WalletReaderPort`), enquanto atinge latência de nanossegundos em tempo de leitura.
