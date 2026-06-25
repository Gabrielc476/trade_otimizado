import { create } from "zustand";

export interface PriceLevel {
  price: number;
  quantity: number;
  timestamp: number;
}

export interface TradeEvent {
  id: number;
  price: number;
  quantity: number;
  side: 0 | 1; // 0 = COMPRA (VERDE), 1 = VENDA (VERMELHO)
  timestamp: number;
}

export interface OrderBookSlice {
  bids: PriceLevel[];
  asks: PriceLevel[];
  maxVolume: number;
  updateOrderBook: (bids: PriceLevel[], asks: PriceLevel[]) => void;
}

export interface TradeHistorySlice {
  trades: TradeEvent[];
  addTrade: (trade: TradeEvent) => void;
}

export interface WalletSlice {
  usdBalance: number;
  btcBalance: number;
  updateBalances: (usd: number, btc: number) => void;
}

export interface SystemSlice {
  volatility: number; // 0.0 a 1.0
  rps: number;
  setSystemMetrics: (volatility: number, rps: number) => void;
}

export type StoreState = OrderBookSlice & TradeHistorySlice & WalletSlice & SystemSlice;

export const useStore = create<StoreState>((set) => ({
  // Order Book
  bids: [],
  asks: [],
  maxVolume: 1.0,
  updateOrderBook: (bids, asks) => {
    let maxVol = 0.1;
    for (let i = 0; i < bids.length; i++) {
      if (bids[i].quantity > maxVol) maxVol = bids[i].quantity;
    }
    for (let i = 0; i < asks.length; i++) {
      if (asks[i].quantity > maxVol) maxVol = asks[i].quantity;
    }
    set({ bids, asks, maxVolume: maxVol });
  },

  // Trade History
  trades: [],
  addTrade: (trade) =>
    set((state) => {
      // Limita o histórico de trades a 500 itens para evitar vazamento de memória DOM
      const newTrades = [trade, ...state.trades];
      if (newTrades.length > 500) {
        newTrades.pop();
      }
      return { trades: newTrades };
    }),

  // Wallet
  usdBalance: 150000.0,
  btcBalance: 2.458319,
  updateBalances: (usd, btc) => set({ usdBalance: usd, btcBalance: btc }),

  // System Metrics
  volatility: 0.15,
  rps: 75240,
  setSystemMetrics: (volatility, rps) => set({ volatility, rps }),
}));
