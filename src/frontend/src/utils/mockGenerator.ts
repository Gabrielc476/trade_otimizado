import { useStore, PriceLevel, TradeEvent } from "../store/useStore";

export class MockMarketGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private midPrice = 65000.0;
  private tradeIdCounter = 1;
  private targetVolatility = 0.2;
  private currentVolatility = 0.2;

  public start() {
    if (this.intervalId) return;

    // Inicializa o livro
    this.generateSnapshot();

    this.intervalId = setInterval(() => {
      // 1. Oscila o preço médio
      const volatilityFactor = this.currentVolatility;
      const priceChange = (Math.random() - 0.5) * 40.0 * (volatilityFactor + 0.1);
      this.midPrice += priceChange;

      // 2. Modifica a volatilidade de forma suave em direção ao alvo
      if (Math.random() < 0.05) {
        // Define um novo alvo de volatilidade esporadicamente (ex: picos de pânico)
        this.targetVolatility = Math.random() < 0.15 ? 0.7 + Math.random() * 0.3 : 0.05 + Math.random() * 0.3;
      }
      this.currentVolatility += (this.targetVolatility - this.currentVolatility) * 0.05;

      // 3. Atualiza as métricas do sistema
      const baseRps = 70000;
      const rpsVariance = (Math.random() - 0.5) * 15000;
      const rps = Math.floor((baseRps + rpsVariance) * (1.0 + this.currentVolatility * 0.5));
      useStore.getState().setSystemMetrics(this.currentVolatility, rps);

      // 4. Regenera o livro de ofertas (Order Book L2)
      this.generateSnapshot();

      // 5. Gera trades ocasionais
      const tradeChance = 0.1 + this.currentVolatility * 0.3; // Mais volátil = mais trades
      if (Math.random() < tradeChance) {
        this.generateTrade();
      }
    }, 50); // Atualizações a cada 50ms (20 vezes por segundo!)
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private generateSnapshot() {
    const bids: PriceLevel[] = [];
    const asks: PriceLevel[] = [];
    const spread = 2.0 + this.currentVolatility * 15.0; // Spread aumenta com a volatilidade

    // Gera 15 níveis de compra (bids)
    let bidPrice = this.midPrice - spread / 2.0;
    for (let i = 0; i < 15; i++) {
      const quantity = Math.random() * 0.5 * (1.0 + Math.sin(i / 2) * 0.5) + (Math.random() < 0.1 ? 1.2 : 0.0); // Picos ocasionais
      bids.push({
        price: Number(bidPrice.toFixed(2)),
        quantity: Number(quantity.toFixed(4)),
        timestamp: Date.now() - i * 100,
      });
      bidPrice -= 1.0 + Math.random() * 3.0;
    }

    // Gera 15 níveis de venda (asks)
    let askPrice = this.midPrice + spread / 2.0;
    for (let i = 0; i < 15; i++) {
      const quantity = Math.random() * 0.5 * (1.0 + Math.sin(i / 2) * 0.5) + (Math.random() < 0.1 ? 1.2 : 0.0);
      asks.push({
        price: Number(askPrice.toFixed(2)),
        quantity: Number(quantity.toFixed(4)),
        timestamp: Date.now() - i * 100,
      });
      askPrice += 1.0 + Math.random() * 3.0;
    }

    useStore.getState().updateOrderBook(bids, asks);
  }

  private generateTrade() {
    const side: 0 | 1 = Math.random() > 0.5 ? 0 : 1; // 0 = compra, 1 = venda
    const isWhale = Math.random() < 0.04; // 4% de chance de ser um baleia
    const quantity = isWhale ? 2.5 + Math.random() * 5.0 : 0.01 + Math.random() * 0.4;
    const spread = 2.0 + this.currentVolatility * 15.0;
    const price = side === 0 ? this.midPrice + spread / 2 : this.midPrice - spread / 2;

    const trade: TradeEvent = {
      id: this.tradeIdCounter++,
      price: Number(price.toFixed(2)),
      quantity: Number(quantity.toFixed(4)),
      side,
      timestamp: Date.now(),
    };

    // Atualiza a store
    useStore.getState().addTrade(trade);

    // Se for uma transação com impacto financeiro na nossa carteira fictícia
    // Simula a execução do nosso próprio saldo ocasionalmente se os preços coincidirem com ordens enviadas
    const state = useStore.getState();
    if (side === 0) {
      // Alguém comprou. Se fomos nós (simulação):
      const usdDiff = quantity * price;
      if (state.usdBalance > usdDiff && Math.random() < 0.05) {
        state.updateBalances(state.usdBalance - usdDiff, state.btcBalance + quantity);
      }
    } else {
      // Alguém vendeu.
      if (state.btcBalance > quantity && Math.random() < 0.05) {
        const usdDiff = quantity * price;
        state.updateBalances(state.usdBalance + usdDiff, state.btcBalance - quantity);
      }
    }
  }
}
