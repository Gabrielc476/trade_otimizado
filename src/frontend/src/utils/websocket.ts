import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';

class WebSocketClient {
  private socket: Socket | null = null;
  private orderCounter = 1;

  public connect(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    console.log('[WS Client] Attempting to connect to http://localhost:3001 with token...');

    this.socket = io('http://localhost:3001', {
      auth: {
        token: `Bearer ${token}`,
      },
    });

    this.socket.on('connect', () => {
      console.log('[WS Client] Successfully connected to Live WebSocket server. Socket ID:', this.socket?.id);
      useStore.getState().setLiveConnected(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS Client] Disconnected from Live WebSocket server. Reason:', reason);
      useStore.getState().setLiveConnected(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[WS Client] WebSocket connection error detailed:', err.message, err);
      useStore.getState().setLiveConnected(false);
    });

    // Listen to L2 order book updates
    this.socket.on('L2_UPDATE', (payload: { bids: any[]; asks: any[] }) => {
      console.log(`[WS Client] Received L2_UPDATE. Bids count: ${payload.bids?.length}, Asks count: ${payload.asks?.length}`);
      if (payload.bids?.length > 0 || payload.asks?.length > 0) {
        console.log('[WS Client] L2_UPDATE sample bids:', payload.bids?.slice(0, 2), 'asks:', payload.asks?.slice(0, 2));
      }
      useStore.getState().updateOrderBook(payload.bids, payload.asks);
    });

    // Listen to trades feed
    this.socket.on('TRADE', (trade: any) => {
      console.log('[WS Client] Received TRADE event:', trade);
      useStore.getState().addTrade(trade);
    });

    // Listen to personal balance updates
    this.socket.on('BALANCE_UPDATE', (balances: { usd: number; btc: number }) => {
      console.log('[WS Client] Received BALANCE_UPDATE:', balances);
      useStore.getState().updateBalances(balances.usd, balances.btc);
    });

    // Listen to order actions confirmation
    this.socket.on('ORDER_PLACED', (msg: any) => {
      console.log('[WS Client] Order placed confirmation received:', msg);
    });

    this.socket.on('ORDER_CANCELLED', (msg: any) => {
      console.log('[WS Client] Order cancelled confirmation received:', msg);
    });

    // Listen to system metrics from the engine
    this.socket.on('SYSTEM_METRICS', (payload: { volatility: number; rps: number; openInterest: number }) => {
      console.log('[WS Client] Received SYSTEM_METRICS:', payload);
      useStore.getState().setSystemMetrics(payload.volatility, payload.rps, payload.openInterest);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    useStore.getState().setLiveConnected(false);
  }

  public placeOrder(side: number, orderType: 'LIMIT' | 'MARKET', price: number, qty: number): number {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot place order: WebSocket not connected');
      return -1;
    }

    // Generate unique order ID in 32-bit int range (maximum 2,147,483,647)
    // Date.now() seconds is around 1,770,000,000 which fits perfectly!
    const timestampSec = Math.floor(Date.now() / 1000);
    const orderId = timestampSec * 100 + (this.orderCounter++ % 100);

    this.socket.emit('PLACE_ORDER', {
      orderId,
      side,
      orderType,
      price,
      qty,
    });

    return orderId;
  }

  public cancelOrder(orderId: number) {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot cancel order: WebSocket not connected');
      return;
    }

    this.socket.emit('CANCEL_ORDER', { orderId });
  }
}

export const wsClient = new WebSocketClient();
