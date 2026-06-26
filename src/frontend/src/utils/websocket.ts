import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';

class WebSocketClient {
  private socket: Socket | null = null;
  private orderCounter = 1;

  public connect(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to NestJS backend WebSocket server
    this.socket = io('http://localhost:3001', {
      auth: {
        token: `Bearer ${token}`,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Successfully connected to Live WebSocket server');
      useStore.getState().setLiveConnected(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Live WebSocket server');
      useStore.getState().setLiveConnected(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
      useStore.getState().setLiveConnected(false);
    });

    // Listen to L2 order book updates
    this.socket.on('L2_UPDATE', (payload: { bids: any[]; asks: any[] }) => {
      useStore.getState().updateOrderBook(payload.bids, payload.asks);
    });

    // Listen to trades feed
    this.socket.on('TRADE', (trade: any) => {
      useStore.getState().addTrade(trade);
    });

    // Listen to personal balance updates
    this.socket.on('BALANCE_UPDATE', (balances: { usd: number; btc: number }) => {
      useStore.getState().updateBalances(balances.usd, balances.btc);
    });

    // Listen to order actions confirmation
    this.socket.on('ORDER_PLACED', (msg: any) => {
      console.log('Order placed successfully:', msg);
    });

    this.socket.on('ORDER_CANCELLED', (msg: any) => {
      console.log('Order cancelled successfully:', msg);
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
