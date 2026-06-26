import { useStore, PriceLevel, TradeEvent, LiquidationEvent } from "../store/useStore";

export class MockMarketGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private midPrice = 65000.0;
  private tradeIdCounter = 1;
  private liquidationIdCounter = 1;
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

      // 3. Simula flutuação suave do Open Interest (OI em milhões de USD)
      // O OI aumenta de forma correlacionada à volatilidade (mais alavancagem / pânico)
      const targetOI = 140.0 + this.currentVolatility * 180.0;
      const currentOI = useStore.getState().openInterest;
      const nextOI = currentOI + (targetOI - currentOI) * 0.01 + (Math.random() - 0.5) * 1.5;
      const openInterest = Number(Math.max(100.0, Math.min(nextOI, 380.0)).toFixed(1));

      // 4. Atualiza as métricas do sistema
      const baseRps = 70000;
      const rpsVariance = (Math.random() - 0.5) * 15000;
      const rps = Math.floor((baseRps + rpsVariance) * (1.0 + this.currentVolatility * 0.5));
      useStore.getState().setSystemMetrics(this.currentVolatility, rps, openInterest);

      // 5. Regenera o livro de ofertas (Order Book L2)
      this.generateSnapshot();

      // 6. Gera trades ocasionais
      const tradeChance = 0.1 + this.currentVolatility * 0.3; // Mais volátil = mais trades
      if (Math.random() < tradeChance) {
        this.generateTrade();
      }

      // 7. Gera eventos de liquidação esporádicos (especialmente em alta volatilidade)
      const liqChance = 0.004 + this.currentVolatility * 0.035;
      if (Math.random() < liqChance) {
        this.generateLiquidation();
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
    const state = useStore.getState();
    if (side === 0) {
      const usdDiff = quantity * price;
      if (state.usdBalance > usdDiff && Math.random() < 0.05) {
        state.updateBalances(state.usdBalance - usdDiff, state.btcBalance + quantity);
      }
    } else {
      if (state.btcBalance > quantity && Math.random() < 0.05) {
        const usdDiff = quantity * price;
        state.updateBalances(state.usdBalance + usdDiff, state.btcBalance - quantity);
      }
    }
  }

  private generateLiquidation() {
    const side: 0 | 1 = Math.random() > 0.5 ? 0 : 1; // 0 = shorts liquidando (compra), 1 = longs liquidando (venda)
    const quantity = 0.4 + Math.random() * 3.5; // De 0.4 a 3.9 BTC liquidado
    const spread = 2.0 + this.currentVolatility * 15.0;
    
    // Liquidações ocorrem ligeiramente fora do spread ativo (varredura de stops)
    const offset = (1.5 + Math.random() * 6.0) * (this.currentVolatility + 0.5);
    const price = side === 0 ? this.midPrice + spread / 2 + offset : this.midPrice - spread / 2 - offset;

    const liq: LiquidationEvent = {
      id: this.liquidationIdCounter++,
      price: Number(price.toFixed(2)),
      quantity: Number(quantity.toFixed(4)),
      side,
      timestamp: Date.now(),
    };

    // Adiciona a liquidação à store
    useStore.getState().addLiquidation(liq);
  }
}
