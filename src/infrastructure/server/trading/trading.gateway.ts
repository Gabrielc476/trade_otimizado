import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { EngineService } from '../engine.service';
import { SharedMemoryWalletReader } from '../../../adapters/concurrency/SharedMemoryWalletReader';
import { OrderSide } from '../../../domain/enums/OrderSide';
import { OrderType } from '../../../domain/enums/OrderType';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TradingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private walletReader!: SharedMemoryWalletReader;
  private connectedUsers = new Map<string, number>(); // socketId -> userId
  private balanceInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly engineService: EngineService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    // Instantiate the SharedMemoryWalletReader once the engine service is initialized
    const sab = this.engineService.getWorkerDriver().getSharedArrayBuffer();
    this.walletReader = new SharedMemoryWalletReader(sab, ['BTC', 'USDT']);

    // Listen for worker messages to broadcast L2 updates and Trades
    this.engineService.onWorkerMessage((msg) => {
      this.handleWorkerMessage(msg);
    });

    // Start periodic balance updates for all connected clients to guarantee real-time sync
    this.balanceInterval = setInterval(() => {
      this.pushBalancesToAll();
    }, 200);
  }

  async handleConnection(socket: Socket) {
    try {
      // Handshake-only authentication: validate JWT in auth token or query
      const token = socket.handshake.auth?.token?.split(' ')[1] || socket.handshake.query?.token as string;
      if (!token) {
        console.log('WS Connection rejected: Missing token');
        socket.disconnect();
        return;
      }

      const decoded = await this.jwtService.verifyAsync(token);
      const userId = decoded.userId;

      this.connectedUsers.set(socket.id, userId);
      socket.join(`user_${userId}`);
      console.log(`WS Client connected: User #${userId} (Socket ${socket.id})`);

      // Push initial balance immediately
      this.pushBalance(userId);
    } catch (err) {
      console.log('WS Connection rejected: Invalid token');
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = this.connectedUsers.get(socket.id);
    this.connectedUsers.delete(socket.id);
    console.log(`WS Client disconnected: User #${userId} (Socket ${socket.id})`);
  }

  private handleWorkerMessage(msg: any) {
    if (msg.type === 'L2_UPDATE') {
      const l2Data: Float64Array = msg.data;
      const numBids = l2Data[0];
      const numAsks = l2Data[1];

      const bids: { price: number; quantity: number; timestamp: number }[] = [];
      const asks: { price: number; quantity: number; timestamp: number }[] = [];

      for (let i = 0; i < numBids; i++) {
        bids.push({
          price: l2Data[2 + i],
          quantity: l2Data[22 + i],
          timestamp: Date.now(),
        });
      }

      for (let i = 0; i < numAsks; i++) {
        asks.push({
          price: l2Data[42 + i],
          quantity: l2Data[62 + i],
          timestamp: Date.now(),
        });
      }

      // Broadcast L2 Snapshot to all connected clients
      this.server.emit('L2_UPDATE', { bids, asks });
    } else if (msg.type === 'TRADE') {
      // Broadcast Trade Event to all connected clients
      const price = Number(msg.price) / 100000000;
      const quantity = Number(msg.qty) / 100000000;
      
      this.server.emit('TRADE', {
        id: Math.floor(Math.random() * 1000000),
        price,
        quantity,
        buyerId: msg.buyerId,
        sellerId: msg.sellerId,
        side: 0, // Compra/Venda representation
        timestamp: Date.now(),
      });

      // Instantly trigger private balance updates for the involved buyer and seller
      this.pushBalance(msg.buyerId);
      this.pushBalance(msg.sellerId);
    } else if (msg.type === 'ORDER_PLACED') {
      this.server.to(`user_${msg.userId}`).emit('ORDER_PLACED', {
        orderId: msg.orderId,
        price: Number(msg.price) / 100000000,
        qty: Number(msg.qty) / 100000000,
        side: msg.side,
      });
    } else if (msg.type === 'ORDER_CANCELLED') {
      this.server.to(`user_${msg.userId}`).emit('ORDER_CANCELLED', {
        orderId: msg.orderId,
        price: Number(msg.price) / 100000000,
        qty: Number(msg.qty) / 100000000,
        side: msg.side,
      });
    }
  }

  @SubscribeMessage('PLACE_ORDER')
  handlePlaceOrder(socket: Socket, payload: { orderId: number; side: number; orderType: string; price: number; qty: number }) {
    const userId = this.connectedUsers.get(socket.id);
    if (!userId) return { error: 'Unauthorized' };

    const { orderId, side, orderType, price, qty } = payload;
    const priceBigInt = BigInt(Math.round(price * 100000000));
    const qtyBigInt = BigInt(Math.round(qty * 100000000));

    const driver = this.engineService.getWorkerDriver();
    driver.sendOrder(
      orderId,
      userId,
      side as OrderSide,
      (orderType === 'LIMIT' ? OrderType.LIMIT : OrderType.MARKET) as OrderType,
      priceBigInt,
      qtyBigInt
    );

    return { success: true };
  }

  @SubscribeMessage('CANCEL_ORDER')
  handleCancelOrder(socket: Socket, payload: { orderId: number }) {
    const userId = this.connectedUsers.get(socket.id);
    if (!userId) return { error: 'Unauthorized' };

    const { orderId } = payload;
    const driver = this.engineService.getWorkerDriver();
    driver.cancelOrder(orderId);

    return { success: true };
  }

  private pushBalance(userId: number) {
    try {
      const btcBal = this.walletReader.getBalance(userId, 'BTC');
      const usdBal = this.walletReader.getBalance(userId, 'USDT');

      const btc = Number(btcBal.available) / 100000000;
      const usd = Number(usdBal.available) / 100000000;

      this.server.to(`user_${userId}`).emit('BALANCE_UPDATE', { usd, btc });
    } catch (err) {
      console.error(`Failed to push balance for user #${userId}:`, err);
    }
  }

  private pushBalancesToAll() {
    const activeUserIds = Array.from(new Set(this.connectedUsers.values()));
    for (const userId of activeUserIds) {
      this.pushBalance(userId);
    }
  }
}
