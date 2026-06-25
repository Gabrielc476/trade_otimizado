# Contexto de Pilha Tecnológica (Tech Stack): ApexTrade

Este documento consolida as escolhas de tecnologia, dependências e padrões arquiteturais adotados para garantir o throughput e a robustez do **ApexTrade**.

---

## 1. Backend (Servidor de Negociação)
*   **Runtime:** Node.js (versão LTS v20+ ou superior).
*   **Framework:** NestJS (v10+). Provê a estrutura de injeção de dependência e controle HTTP/WS na camada externa de infraestrutura.
*   **Linguagem:** TypeScript (modo estrito - `strict: true` ativado no `tsconfig.json`).
*   **Módulo de Concorrência:** `worker_threads` nativo do Node.js. Utilizado para criar a thread dedicada do motor de casamento em isolamento do Event Loop de I/O.
*   **Comunicação Inter-Thread:** 
    *   `SharedArrayBuffer` para compartilhamento direto de saldos dos usuários com acesso Lock-Free de leitura e controle atômico via `Atomics`.
    *   `MessageChannel` nativo do Node.js para envio estruturado e transferência de posse de arrays binários (TypedArrays) de ordens e trades.

---

## 2. Banco de Dados e Persistência
*   **Banco de Dados Principal:** PostgreSQL (v15+). Armazena dados de usuários, chaves de API, saldos persistidos e histórico de transações em lote.
*   **Driver de Conexão:** `pg` (Node-Postgres) nativo. Evitamos ORMs pesados (como Prisma/Sequelize) no fluxo de persistência assíncrona para maximizar o throughput de inserção através de comandos `COPY` ou multi-row `INSERT` puros em SQL.
*   **Write-Ahead Log (WAL):** Módulo `fs` nativo do Node.js. Gravador sequencial de arquivos em disco binário de alta performance (`fs.createWriteStream` com flags sequenciais adequadas).

---

## 3. Frontend (Terminal de Trading)
*   **Framework:** Next.js (App Router, React v18+).
*   **Linguagem:** TypeScript.
*   **Estilização:** Tailwind CSS (com visual futurista, dark theme e efeitos de glassmorphism baseados em backdrop-filters).
*   **Gerenciamento de Estado:** Zustand (v4+). Utiliza seletores estritos para evitar re-renderizações indesejadas do React DOM sob alta frequência.
*   **DOM Virtualizado:** `@tanstack/react-virtual` ou `react-window`. Utilizado para virtualizar as tabelas do Order Book e Histórico de Ordens, garantindo renderização estável limitando os nós HTML na página.
*   **Visualização Gráfica 3D (WebGL/WebGPU):**
    *   `three` (Three.js v170+).
    *   `@react-three/fiber` (React Three Fiber) para integração declarativa das cenas 3D no React.
    *   `@react-three/drei` para utilitários de órbita, shaders e partículas.
    *   Shaders customizados em **GLSL** para deformações de vértice e efeitos de cor na GPU.
*   **Gráficos Financeiros:** **Lightweight Charts** da TradingView (renderização incremental sobre Canvas 2D).

---

## 4. Testes de Carga, Observabilidade e Qualidade
*   **Testes de Unidade/Integração:** Jest (integrado ao NestJS).
*   **Teste de Carga Concorrente (HFT):** **k6** (ferramenta de alta performance escrita em Go).
*   **Coleta de Métricas do Servidor:** `prom-client` para expor métricas internas (RPS, CPU, memória, latência) compatíveis com Prometheus/Grafana.
