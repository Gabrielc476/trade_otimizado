import { useStore, PriceLevel, TradeEvent } from "../../frontend/src/store/useStore";
import { MockMarketGenerator } from "../../frontend/src/utils/mockGenerator";

describe("Zustand Store Slices", () => {
  beforeEach(() => {
    // Reseta o estado da store antes de cada teste
    useStore.setState({
      bids: [],
      asks: [],
      maxVolume: 1.0,
      trades: [],
      usdBalance: 150000.0,
      btcBalance: 2.458319,
      volatility: 0.15,
      rps: 75240,
    });
  });

  test("deve atualizar o livro de ofertas e calcular o maxVolume corretamente", () => {
    const bids: PriceLevel[] = [
      { price: 64900, quantity: 0.5, timestamp: 1000 },
      { price: 64800, quantity: 1.8, timestamp: 1001 },
    ];
    const asks: PriceLevel[] = [
      { price: 65100, quantity: 0.2, timestamp: 1000 },
      { price: 65200, quantity: 1.2, timestamp: 1001 },
    ];

    useStore.getState().updateOrderBook(bids, asks);

    const state = useStore.getState();
    expect(state.bids).toEqual(bids);
    expect(state.asks).toEqual(asks);
    expect(state.maxVolume).toBe(1.8); // Maior quantidade entre todas as ofertas
  });

  test("deve adicionar novos negócios ao histórico e limitar a 500 itens", () => {
    const state = useStore.getState();
    const trade: TradeEvent = {
      id: 1,
      price: 65000,
      quantity: 0.1,
      side: 0,
      timestamp: 1000,
    };

    state.addTrade(trade);
    expect(useStore.getState().trades).toHaveLength(1);
    expect(useStore.getState().trades[0]).toEqual(trade);

    // Testa limite de 500 itens
    for (let i = 2; i <= 510; i++) {
      useStore.getState().addTrade({
        id: i,
        price: 65000,
        quantity: 0.1,
        side: 0,
        timestamp: 1000 + i,
      });
    }

    expect(useStore.getState().trades).toHaveLength(500);
    // O mais recente deve estar no topo (id: 510)
    expect(useStore.getState().trades[0].id).toBe(510);
  });

  test("deve atualizar os saldos da carteira corretamente", () => {
    useStore.getState().updateBalances(120000.0, 3.5);
    const state = useStore.getState();
    expect(state.usdBalance).toBe(120000.0);
    expect(state.btcBalance).toBe(3.5);
  });

  test("deve atualizar as métricas do sistema corretamente", () => {
    useStore.getState().setSystemMetrics(0.85, 85000);
    const state = useStore.getState();
    expect(state.volatility).toBe(0.85);
    expect(state.rps).toBe(85000);
  });
});

describe("MockMarketGenerator", () => {
  let generator: MockMarketGenerator;

  beforeEach(() => {
    generator = new MockMarketGenerator();
    useStore.setState({
      bids: [],
      asks: [],
      trades: [],
    });
  });

  afterEach(() => {
    generator.stop();
  });

  test("deve iniciar a simulação e preencher a store com ofertas iniciais", () => {
    generator.start();
    
    const state = useStore.getState();
    expect(state.bids.length).toBeGreaterThan(0);
    expect(state.asks.length).toBeGreaterThan(0);
    expect(state.bids[0].price).toBeLessThan(state.asks[0].price); // Bids abaixo dos asks
  });
});
