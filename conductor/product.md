# Contexto de Produto: ApexTrade

## 1. Visão Geral do Produto
O **ApexTrade** é uma plataforma de negociação financeira (Exchange) de alta performance simplificada. O núcleo do produto é um motor de cruzamento de ordens (*Matching Engine*) de alta velocidade e baixíssima latência que opera inteiramente em memória sob a regra FIFO (Preço e Tempo).

Diferente de exchanges tradicionais pesadas, o ApexTrade foi concebido como uma demonstração de excelência de engenharia de software fullstack, provando que é possível atingir mais de 80.000 casamentos de ordens por segundo (RPS) em ambiente Node.js/TypeScript através de otimizações de baixo nível e arquitetura assíncrona desacoplada.

## 2. O Problema e a Solução
*   **Problema:** Exchanges de cripto e ações comuns sofrem com latência de rede e banco de dados durante períodos de pico (alta volatilidade), resultando em falhas de execução e prejuízos aos traders. Desenvolvedores costumam assumir que o Node.js é lento demais para esse tipo de sistema, recorrendo a C++ ou Go.
*   **Solução:** O ApexTrade resolve a latência através de:
    1.  *Matching Engine na RAM:* Sem consultas de banco de dados no caminho da transação.
    2.  *Worker Thread Isolada:* CPU inteiramente dedicada a processar as ordens sequencialmente.
    3.  *Write-Ahead Log (WAL) Binário:* Persistência ultraveloz por escrita sequencial no disco antes do casamento.
    4.  *Sincronização Assíncrona no DB:* PostgreSQL atualizado de forma em lote secundária (Outbox).

## 3. Público-Alvo e Casos de Uso
1.  **High-Frequency Traders (HFT Bots):** Clientes institucionais ou automatizados que exigem latência consistente de sub-milissegundos via APIs HTTP com assinatura HMAC e WebSockets estáveis.
2.  **Active Day Traders:** Usuários humanos que negociam pelo terminal web e exigem atualizações visuais em tempo real fluídas (60 FPS) do livro de ofertas e gráficos de velas, sem lag.

## 4. Escopo do MVP (Recursos do Core)
*   **Negociação Spot:** Suporte a ordens do tipo *Limite* (compra e venda em um preço fixado) e *Mercado* (compra e venda executadas imediatamente pelo melhor preço disponível).
*   **Livro de Ofertas Interativo (Order Book):** Atualizações L2 consolidadas a cada 50ms para os clientes.
*   **Gráfico Candlestick (TradingView):** Histórico visual de preços alimentado dinamicamente.
*   **Gestão de Saldos e Carteira:** Depósitos e saques com consistência atômica entre o banco de dados e a memória do motor.
*   **Métricas de Performance Ativas:** Visualização em tempo real das requisições por segundo (RPS) do motor no próprio terminal.

## 5. Métricas de Sucesso
*   **Throughput do Motor:** >80.000 ordens casadas por segundo sob estresse do simulador HFT.
*   **Latência Média:** Sub-milissegundos (<500 microssegundos) no loop interno de processamento de ordens.
*   **Taxa de Quadros da Interface (60 FPS):** Atualização visual estável das tabelas e do reator 3D no navegador do usuário, mesmo sob enxurrada de eventos.
*   **Integridade Financeira:** 0% de divergência de saldos (double-spending) em simulações de alta concorrência.
