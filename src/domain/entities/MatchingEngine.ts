import { Order } from './Order';
import { OrderPool } from './OrderPool';
import { RedBlackTree } from './RedBlackTree';
import { Wallet } from './Wallet';
import { OrderSide } from '../enums/OrderSide';
import { OrderType } from '../enums/OrderType';
import { ErrorCode } from '../enums/ErrorCode';

export interface Trade {
  buyerId: number;
  sellerId: number;
  price: bigint;
  qty: bigint;
  timestamp: number;
}

export const SCALE = 100000000n; // 8 casas decimais (10^8)

export class MatchingEngine {
  public symbol: string;
  public baseAsset: string;
  public quoteAsset: string;
  public bids: RedBlackTree;
  public asks: RedBlackTree;
  public wallet: Wallet;
  public pool: OrderPool;

  constructor(
    symbol: string,
    baseAsset: string,
    quoteAsset: string,
    wallet: Wallet,
    pool: OrderPool
  ) {
    this.symbol = symbol;
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.wallet = wallet;
    this.pool = pool;
    this.bids = new RedBlackTree();
    this.asks = new RedBlackTree();
  }

  public processOrder(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): [ErrorCode, Trade[]] {
    if (qty <= 0n) {
      return [ErrorCode.INVALID_QTY, []];
    }
    if (type === OrderType.LIMIT && price <= 0n) {
      return [ErrorCode.INVALID_PRICE, []];
    }

    const trades: Trade[] = [];
    let code = ErrorCode.SUCCESS;

    if (side === OrderSide.BUY) {
      code = this.processBuy(orderId, userId, type, price, qty, trades);
    } else {
      code = this.processSell(orderId, userId, type, price, qty, trades);
    }

    return [code, trades];
  }

  private processBuy(
    orderId: number,
    userId: number,
    type: OrderType,
    price: bigint,
    qty: bigint,
    trades: Trade[]
  ): ErrorCode {
    const cost = (price * qty) / SCALE;
    const locked = this.wallet.lock(userId, this.quoteAsset, cost);
    if (!locked) {
      return ErrorCode.INSUFFICIENT_BALANCE;
    }

    const buyOrder = this.pool.acquire(orderId, userId, this.symbol, OrderSide.BUY, type, price, qty);

    let askNode = this.asks.getMinNode();
    while (
      askNode !== null &&
      (buyOrder.type === OrderType.MARKET || askNode.price <= buyOrder.price) &&
      buyOrder.qty > buyOrder.filledQty
    ) {
      const queue = askNode.list;
      while (!queue.isEmpty() && buyOrder.qty > buyOrder.filledQty) {
        const sellOrder = queue.head!;
        const remainingBuy = buyOrder.qty - buyOrder.filledQty;
        const remainingSell = sellOrder.qty - sellOrder.filledQty;
        const matchQty = remainingBuy < remainingSell ? remainingBuy : remainingSell;

        buyOrder.filledQty += matchQty;
        sellOrder.filledQty += matchQty;

        const tradePrice = sellOrder.price;
        this.executeTrade(buyOrder.userId, sellOrder.userId, tradePrice, matchQty, buyOrder.price);

        trades.push({
          buyerId: buyOrder.userId,
          sellerId: sellOrder.userId,
          price: tradePrice,
          qty: matchQty,
          timestamp: Date.now(),
        });

        if (sellOrder.filledQty === sellOrder.qty) {
          queue.remove(sellOrder);
          this.pool.release(sellOrder);
        }
      }

      const priceToDelete = askNode.price;
      if (queue.isEmpty()) {
        this.asks.delete(priceToDelete);
        askNode = this.asks.getMinNode();
      } else {
        break;
      }
    }

    this.settleRemaining(buyOrder);
    return ErrorCode.SUCCESS;
  }

  private processSell(
    orderId: number,
    userId: number,
    type: OrderType,
    price: bigint,
    qty: bigint,
    trades: Trade[]
  ): ErrorCode {
    const locked = this.wallet.lock(userId, this.baseAsset, qty);
    if (!locked) {
      return ErrorCode.INSUFFICIENT_BALANCE;
    }

    const sellOrder = this.pool.acquire(orderId, userId, this.symbol, OrderSide.SELL, type, price, qty);

    let bidNode = this.bids.getMaxNode();
    while (
      bidNode !== null &&
      (sellOrder.type === OrderType.MARKET || bidNode.price >= sellOrder.price) &&
      sellOrder.qty > sellOrder.filledQty
    ) {
      const queue = bidNode.list;
      while (!queue.isEmpty() && sellOrder.qty > sellOrder.filledQty) {
        const buyOrder = queue.head!;
        const remainingSell = sellOrder.qty - sellOrder.filledQty;
        const remainingBuy = buyOrder.qty - buyOrder.filledQty;
        const matchQty = remainingSell < remainingBuy ? remainingSell : remainingBuy;

        sellOrder.filledQty += matchQty;
        buyOrder.filledQty += matchQty;

        const tradePrice = buyOrder.price;
        this.executeTrade(buyOrder.userId, sellOrder.userId, tradePrice, matchQty, buyOrder.price);

        trades.push({
          buyerId: buyOrder.userId,
          sellerId: sellOrder.userId,
          price: tradePrice,
          qty: matchQty,
          timestamp: Date.now(),
        });

        if (buyOrder.filledQty === buyOrder.qty) {
          queue.remove(buyOrder);
          this.pool.release(buyOrder);
        }
      }

      const priceToDelete = bidNode.price;
      if (queue.isEmpty()) {
        this.bids.delete(priceToDelete);
        bidNode = this.bids.getMaxNode();
      } else {
        break;
      }
    }

    this.settleRemaining(sellOrder);
    return ErrorCode.SUCCESS;
  }

  private settleRemaining(order: Order): void {
    if (order.filledQty < order.qty) {
      if (order.type === OrderType.MARKET) {
        const remainingQty = order.qty - order.filledQty;
        if (order.side === OrderSide.BUY) {
          const remainingCost = (order.price * remainingQty) / SCALE;
          if (remainingCost > 0n) {
            this.wallet.unlock(order.userId, this.quoteAsset, remainingCost);
          }
        } else {
          if (remainingQty > 0n) {
            this.wallet.unlock(order.userId, this.baseAsset, remainingQty);
          }
        }
        this.pool.release(order);
      } else {
        const tree = order.side === OrderSide.BUY ? this.bids : this.asks;
        const queue = tree.insert(order.price);
        queue.append(order);
      }
    } else {
      this.pool.release(order);
    }
  }

  private executeTrade(
    buyerId: number,
    sellerId: number,
    tradePrice: bigint,
    matchQty: bigint,
    buyPriceCap: bigint
  ): void {
    const tradeValue = (tradePrice * matchQty) / SCALE;

    this.wallet.debitLocked(buyerId, this.quoteAsset, tradeValue);
    this.wallet.debitLocked(sellerId, this.baseAsset, matchQty);

    if (buyPriceCap > tradePrice) {
      const buyerLockedDebit = (buyPriceCap * matchQty) / SCALE;
      const refund = buyerLockedDebit - tradeValue;
      if (refund > 0n) {
        this.wallet.unlock(buyerId, this.quoteAsset, refund);
      }
    }

    this.wallet.credit(buyerId, this.baseAsset, matchQty);
    this.wallet.credit(sellerId, this.quoteAsset, tradeValue);
  }
}
