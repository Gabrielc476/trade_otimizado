# Track 6: Integração de Rede (NestJS WebSockets & L2 Aggregator)

## Goal
Implementar as rotas HTTP de cadastro e movimentação financeira no NestJS, configurar o servidor de WebSockets de alta velocidade com autenticação de handshake único e desenvolver o buffer de agregação L2 de 50ms no motor para transmissão eficiente de snapshots.

## Skills a Serem Utilizadas
*   `nestjs-expert` (caso disponível, ou `api-patterns`): Desenvolvimento de módulos, guards e interceptors de alta velocidade no NestJS, e servidores WebSocket eficientes.
*   `api-patterns`: Design de rotas HTTP REST seguras, modelagem de payloads JSON compactos e controle de sessão otimizado.
*   `typescript-expert`: Criação de tipos seguros para payloads WebSocket e otimização de buffers de serialização na thread de transmissão.

## Tasks
*   [ ] **Task 1:** Desenvolver os endpoints HTTP de cadastro de usuários, login (geração de JWT) e operações de depósito/saque na Thread Principal do NestJS.
    *   *Verificar:* Teste de rota HTTP de criação de conta e geração de token JWT executa com sucesso.
*   [ ] **Task 2:** Configurar o WebSocket Gateway no NestJS e implementar o guarda de segurança de **handshake único**: validação do JWT na conexão inicial e associação do `userId` à conexão física do socket.
    *   *Verificar:* Conexão de múltiplos clientes via WS valida tokens iniciais e bloqueia conexões não autenticadas, associando IDs internos sem validações subsequentes nas mensagens enviadas.
*   [ ] **Task 3:** Implementar o buffer de agregação L2 na Worker Thread (Matching Engine). O motor de casamento acumula as mudanças do Order Book e, a cada 50ms, gera um snapshot consolidado contendo as 20 melhores ofertas de bids/asks.
    *   *Verificar:* Saída do motor envia um único payload a cada 50ms contendo os deltas agrupados em vez de disparar milhares de pequenas atualizações por segundo.
*   [ ] **Task 4:** Desenvolver a rotina de transmissão eficiente utilizando **objetos transferíveis (Transferable Objects)** para passar o snapshot L2 consolidado do Worker para a Thread Principal com custo de cópia zero.
    *   *Verificar:* Passagem de array binário de mensagens do Worker para a Thread Principal ocorre por transferência de posse física de memória em menos de 10 microssegundos.
*   [ ] **Task 5:** Implementar o Broadcaster de WebSockets na Thread Principal, pegando o snapshot L2 consolidado e transmitindo para todos os clientes conectados de forma unificada.
    *   *Verificar:* Broadcast envia um payload compacto JSON consolidado que é lido e parseado no frontend sem engasgos de rede.

## Done When
*   [ ] Conexões de WebSockets autenticam uma única vez no aperto de mão e transmitem ordens livres de validações criptográficas adicionais.
*   [ ] O servidor WebSocket opera estável, enviando snapshots consolidados do Order Book estritamente a cada 50ms para todos os clientes ativos.
*   [ ] Tráfego de rede geral no servidor WebSocket é reduzido em 95% em comparação com envios individuais de eventos de match.
