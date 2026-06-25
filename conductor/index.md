# ApexTrade: Conductor Context Hub

Bem-vindo ao centro de contexto do **ApexTrade**. Este diretório serve como a única fonte de verdade (Single Source of Truth) para o desenvolvimento do sistema sob a metodologia **Context-Driven Development (CDD)**.

---

## 1. Documentos de Contexto Global

Estes documentos definem as diretrizes perenes do projeto e guiam o comportamento de todos os agentes e desenvolvedores na base de código:

*   [product.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/product.md) — **O QUE** e **POR QUÊ**: Visão do produto, objetivos de negócio, personas e o escopo do MVP.
*   [product-guidelines.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/product-guidelines.md) — **COMO COMUNICAR**: Voz de marca, convenções de logs, tratamento de erros e microcopy.
*   [tech-stack.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tech-stack.md) — **COM O QUE**: Pilha tecnológica detalhada, dependências estritas, controle de versões e arquitetura de hardware/software.
*   [workflow.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/workflow.md) — **COMO TRABALHAR**: Convenções de Git, ciclo de TDD, qualidade de código, segurança de concorrência e processos de CI/CD.
*   [tracks.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks.md) — **O QUE ESTÁ ACONTECENDO**: O registro de tarefas (*tracks*) ativas, planejadas e concluídas.
*   [apex_trade_refined_context.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/apex_trade_refined_context.md) — **ARQUITETURA DETALHADA**: Especificação técnica refinada sob Clean Architecture e otimizações V8.
*   [frontend_specification.md](file:///c:/projetos/ordem%20de%20pagamentos/conductor/frontend_specification.md) — **FRONTEND 3D DETALHADO**: Especificações de layout Bento Grid, Zustand transiente, R3F InstancedMesh, GLSL Shaders e gráficos.

---

## 2. Roteiro de Tracks (Fases do Projeto)

Cada fase de desenvolvimento do projeto é mapeada como uma *track* com especificações e planos de implementação detalhados na pasta `conductor/tracks/`:

1.  **Track 1: Domínio Puro & Algoritmo (Core Engine)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/01_core_engine/plan.md)
2.  **Track 2: Regras da Aplicação & Portas (Use Cases)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/02_use_cases/plan.md)
3.  **Track 3: Adaptadores & Concorrência (Multithread / SAB)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/03_concurrency/plan.md)
4.  **Track 4: Durabilidade e WAL (Write-Ahead Log & DB)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/04_durability/plan.md)
5.  **Track 5: O Motor WebGL/WebGPU 3D (Next.js / R3F / Shaders)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/05_3d_frontend/plan.md)
6.  **Track 6: Integração de Rede (NestJS WebSockets & L2 Aggregator)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/06_network_integration/plan.md)
7.  **Track 7: Simulação de Carga HFT & Validação de Métricas (K6)**
    *   [Especificação e Plano](file:///c:/projetos/ordem%20de%20pagamentos/conductor/tracks/07_validation/plan.md)
