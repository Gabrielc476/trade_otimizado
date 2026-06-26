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

export interface LiquidationEvent {
  id: number;
  price: number;
  quantity: number;
  side: 0 | 1; // 0 = COMPRA (Shorts liquidando - Verde), 1 = VENDA (Longs liquidando - Vermelho)
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

export interface LiquidationSlice {
  liquidations: LiquidationEvent[];
  addLiquidation: (liq: LiquidationEvent) => void;
}

export interface WalletSlice {
  usdBalance: number;
  btcBalance: number;
  updateBalances: (usd: number, btc: number) => void;
}

export interface SystemSlice {
  volatility: number; // 0.0 a 1.0
  rps: number;
  openInterest: number; // Em milhões de USD (ex: 250.5)
  active3DMode: "CVD" | "RIDGES" | "TUNNEL" | "LIQUIDATIONS";
  setSystemMetrics: (volatility: number, rps: number, openInterest?: number) => void;
  setActive3DMode: (mode: "CVD" | "RIDGES" | "TUNNEL" | "LIQUIDATIONS") => void;
}

export interface OrderFormSlice {
  selectedPrice: string | null;
  selectedQuantity: string | null;
  setSelectedPrice: (price: string | null) => void;
  setSelectedQuantity: (qty: string | null) => void;
}

export interface LiveSlice {
  isLive: boolean;
  isLiveConnected: boolean;
  token: string | null;
  currentUser: { id: number; name: string } | null;
  setIsLive: (isLive: boolean) => void;
  setLiveConnected: (connected: boolean) => void;
  setCurrentUser: (user: { id: number; name: string } | null, token: string | null) => void;
}

export type StoreState = OrderBookSlice & TradeHistorySlice & LiquidationSlice & WalletSlice & SystemSlice & OrderFormSlice & LiveSlice;

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
      const newTrades = [trade, ...state.trades];
      if (newTrades.length > 500) {
        newTrades.pop();
      }
      return { trades: newTrades };
    }),

  // Liquidation History
  liquidations: [],
  addLiquidation: (liq) =>
    set((state) => {
      // Limita o histórico de liquidações a 50 para a constelação 3D
      const newLiqs = [liq, ...state.liquidations];
      if (newLiqs.length > 50) {
        newLiqs.pop();
      }
      return { liquidations: newLiqs };
    }),

  // Wallet
  usdBalance: 150000.0,
  btcBalance: 2.458319,
  updateBalances: (usd, btc) => set({ usdBalance: usd, btcBalance: btc }),

  // System Metrics & 3D Control
  volatility: 0.15,
  rps: 75240,
  openInterest: 185.5, // Padrão: 185.5 milhões de USD
  active3DMode: "CVD", // Padrão do Radar: CVD Vessel
  setSystemMetrics: (volatility, rps, openInterest) =>
    set((state) => ({
      volatility,
      rps,
      openInterest: openInterest !== undefined ? openInterest : state.openInterest,
    })),
  setActive3DMode: (mode) => set({ active3DMode: mode }),

  // Order Form Selection
  selectedPrice: null,
  selectedQuantity: null,
  setSelectedPrice: (price) => set({ selectedPrice: price }),
  setSelectedQuantity: (qty) => set({ selectedQuantity: qty }),

  // Live Trading Connection Slice
  isLive: false,
  isLiveConnected: false,
  token: null,
  currentUser: null,
  setIsLive: (isLive) => set({ isLive }),
  setLiveConnected: (connected) => set({ isLiveConnected: connected }),
  setCurrentUser: (user, token) => set({ currentUser: user, token }),
}));
