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

    if (side === OrderSide.BUY) {
      // Para compra: bloqueia saldo de quoteAsset
      const cost = (price * qty) / SCALE;
      const locked = this.wallet.lock(userId, this.quoteAsset, cost);
      if (!locked) {
        return [ErrorCode.INSUFFICIENT_BALANCE, []];
      }

      const buyOrder = this.pool.acquire(orderId, userId, this.symbol, side, type, price, qty);

      // Casamento contra o livro de vendas (asks)
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

          // Executa o trade
          buyOrder.filledQty += matchQty;
          sellOrder.filledQty += matchQty;

          const tradePrice = sellOrder.price;
          const tradeValue = (tradePrice * matchQty) / SCALE;

          // Atualizações financeiras
          // 1. Debita do vendedor o ativo base (que estava bloqueado)
          this.wallet.debitLocked(sellOrder.userId, this.baseAsset, matchQty);
          // 2. Debita do comprador o ativo de cotação correspondente ao valor real (tradeValue)
          const buyerLockedDebit = (buyOrder.price * matchQty) / SCALE;
          this.wallet.debitLocked(buyOrder.userId, this.quoteAsset, tradeValue);
          // 3. Reembolsa a diferença de preço para o comprador (desbloqueia o valor excedente)
          if (buyOrder.price > tradePrice) {
            const refund = buyerLockedDebit - tradeValue;
            if (refund > 0n) {
              this.wallet.unlock(buyOrder.userId, this.quoteAsset, refund);
            }
          }
          // 4. Credita o ativo base para o comprador
          this.wallet.credit(buyOrder.userId, this.baseAsset, matchQty);
          // 5. Credita o ativo de cotação para o vendedor
          this.wallet.credit(sellOrder.userId, this.quoteAsset, tradeValue);

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

      if (buyOrder.filledQty < buyOrder.qty) {
        if (buyOrder.type === OrderType.MARKET) {
          // Ordem a mercado: cancela o restante e devolve o saldo não gasto
          const remainingQty = buyOrder.qty - buyOrder.filledQty;
          const remainingCost = (buyOrder.price * remainingQty) / SCALE;
          if (remainingCost > 0n) {
            this.wallet.unlock(buyOrder.userId, this.quoteAsset, remainingCost);
          }
          this.pool.release(buyOrder);
        } else {
          // Ordem limite: insere o restante no livro de bids
          const bidQueue = this.bids.insert(buyOrder.price);
          bidQueue.append(buyOrder);
        }
      } else {
        // Ordem totalmente preenchida
        this.pool.release(buyOrder);
      }
    } else {
      // Para venda: bloqueia saldo de baseAsset
      const locked = this.wallet.lock(userId, this.baseAsset, qty);
      if (!locked) {
        return [ErrorCode.INSUFFICIENT_BALANCE, []];
      }

      const sellOrder = this.pool.acquire(orderId, userId, this.symbol, side, type, price, qty);

      // Casamento contra o livro de compras (bids)
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

          // Executa o trade
          sellOrder.filledQty += matchQty;
          buyOrder.filledQty += matchQty;

          const tradePrice = buyOrder.price;
          const tradeValue = (tradePrice * matchQty) / SCALE;

          // Atualizações financeiras
          // 1. Debita do comprador o ativo de cotação (que estava bloqueado)
          this.wallet.debitLocked(buyOrder.userId, this.quoteAsset, tradeValue);
          // 2. Debita do vendedor o ativo base (que estava bloqueado)
          this.wallet.debitLocked(sellOrder.userId, this.baseAsset, matchQty);
          // 3. Credita o ativo base para o comprador
          this.wallet.credit(buyOrder.userId, this.baseAsset, matchQty);
          // 4. Credita o ativo de cotação para o vendedor
          this.wallet.credit(sellOrder.userId, this.quoteAsset, tradeValue);

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

      if (sellOrder.filledQty < sellOrder.qty) {
        if (sellOrder.type === OrderType.MARKET) {
          // Ordem a mercado: cancela o restante e devolve o ativo base não vendido
          const remainingQty = sellOrder.qty - sellOrder.filledQty;
          if (remainingQty > 0n) {
            this.wallet.unlock(sellOrder.userId, this.baseAsset, remainingQty);
          }
          this.pool.release(sellOrder);
        } else {
          // Ordem limite: insere o restante no livro de asks
          const askQueue = this.asks.insert(sellOrder.price);
          askQueue.append(sellOrder);
        }
      } else {
        // Ordem totalmente preenchida
        this.pool.release(sellOrder);
      }
    }

    return [ErrorCode.SUCCESS, trades];
  }
}
