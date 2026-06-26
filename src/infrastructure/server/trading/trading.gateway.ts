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
import * as fs from 'fs';
import * as path from 'path';
import { MetricsService } from '../metrics/metrics.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
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
    private readonly metricsService: MetricsService,
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
    try {
      const logPath = path.resolve(process.cwd(), 'gateway.log');
      
      // Log non-L2 events or a small fraction of L2 events to avoid disk spam
      if (msg.type !== 'L2_UPDATE') {
        const logMsg = `[${new Date().toISOString()}] msg: ${JSON.stringify(msg, (key, value) => typeof value === 'bigint' ? value.toString() : value)}\n`;
        fs.appendFileSync(logPath, logMsg);
      } else {
        if (Math.random() < 0.01) {
          const logMsg = `[${new Date().toISOString()}] msg: L2_UPDATE bids count = ${msg.data[0]}, asks count = ${msg.data[1]}\n`;
          fs.appendFileSync(logPath, logMsg);
        }
      }

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
        const price = Number(msg.price) / 100000000;
        const quantity = Number(msg.qty) / 100000000;
        
        // Map the takerSide (1 = BUY, 2 = SELL) to frontend representation (0 = COMPRA, 1 = VENDA)
        const side = msg.takerSide === 2 ? 1 : 0;

        // Broadcast Trade Event to all connected clients
        this.server.emit('TRADE', {
          id: Math.floor(Math.random() * 1000000),
          price,
          quantity,
          buyerId: msg.buyerId,
          sellerId: msg.sellerId,
          side,
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
      } else if (msg.type === 'METRICS') {
        const rps = Math.round(msg.count / 0.5); // aggregated every 500ms
        
        this.metricsService.recordMetrics(
          msg.count,
          rps,
          msg.p50,
          msg.p90,
          msg.p99,
          msg.volatility
        );

        this.server.emit('SYSTEM_METRICS', {
          volatility: msg.volatility,
          rps: rps,
          openInterest: Number((150.0 + msg.volatility * 150.0).toFixed(1)),
        });
      }
    } catch (err: any) {
      const logPath = path.resolve(process.cwd(), 'gateway.log');
      const errLine = `[${new Date().toISOString()}] ERROR in handleWorkerMessage: ${err.message}\n${err.stack}\n`;
      fs.appendFileSync(logPath, errLine);
      console.error("[Gateway Error] Exception in handleWorkerMessage:", err);
    }
  }

  @SubscribeMessage('PLACE_ORDER')
  handlePlaceOrder(socket: Socket, payload: { orderId: number; side: number; orderType: string; price: number; qty: number }) {
    const userId = this.connectedUsers.get(socket.id);
    const logPath = path.resolve(process.cwd(), 'gateway.log');
    
    if (!userId) {
      const errMsg = `[${new Date().toISOString()}] [Gateway WS] PLACE_ORDER rejected: Socket ${socket.id} not associated with any userId. Payload: ${JSON.stringify(payload)}\n`;
      fs.appendFileSync(logPath, errMsg);
      console.warn(`[Gateway] PLACE_ORDER rejected: Socket ${socket.id} not associated with any userId.`);
      return { error: 'Unauthorized' };
    }

    const { orderId, side, orderType, price, qty } = payload;
    
    const logMsg = `[${new Date().toISOString()}] [Gateway WS] PLACE_ORDER from User #${userId} (Socket ${socket.id}): ID: ${orderId}, Side: ${side}, Type: ${orderType}, Price: ${price}, Qty: ${qty}\n`;
    fs.appendFileSync(logPath, logMsg);

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
    const logPath = path.resolve(process.cwd(), 'gateway.log');
    
    if (!userId) {
      const errMsg = `[${new Date().toISOString()}] [Gateway WS] CANCEL_ORDER rejected: Socket ${socket.id} not associated with any userId. Payload: ${JSON.stringify(payload)}\n`;
      fs.appendFileSync(logPath, errMsg);
      console.warn(`[Gateway] CANCEL_ORDER rejected: Socket ${socket.id} not associated with any userId.`);
      return { error: 'Unauthorized' };
    }

    const { orderId } = payload;
    
    const logMsg = `[${new Date().toISOString()}] [Gateway WS] CANCEL_ORDER from User #${userId} (Socket ${socket.id}): ID: ${orderId}\n`;
    fs.appendFileSync(logPath, logMsg);

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
