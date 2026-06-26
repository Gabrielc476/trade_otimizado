import { parentPort, workerData } from 'worker_threads';
import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { StaticFactory } from '../../application/factories/StaticFactory';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { WorkerThreadMessageAdapter } from '../../adapters/concurrency/WorkerThreadMessageAdapter';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { SwitchableEventPublisherPort, SwitchableJournalingPort } from './SwitchablePorts';
import { BinaryWALJournalAdapter } from '../../adapters/journaling/BinaryWALJournalAdapter';

if (!parentPort) {
  throw new Error('engine.worker.ts must be run as a Worker Thread');
}

const { sab, assets, walPath } = workerData;

// Create the Wallet using the SharedArrayBuffer
const wallet = new Wallet(sab, assets);

// Create the OrderPool (100,000 orders max size for recycling)
const pool = new OrderPool(100000);

// Implement the outward ports to send messages back to the parent thread
class WorkerEventPublisher implements EventPublisherPort {
  public publishTrade(buyerId: number, sellerId: number, price: bigint, qty: bigint): void {
    parentPort!.postMessage({
      type: 'TRADE',
      buyerId,
      sellerId,
      price,
      qty,
    });
  }

  public publishOrderPlaced(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    parentPort!.postMessage({
      type: 'ORDER_PLACED',
      orderId,
      userId,
      side,
      orderType: type,
      price,
      qty,
    });
  }

  public publishOrderCancelled(
    orderId: number,
    userId: number,
    price: bigint,
    qty: bigint,
    side: OrderSide
  ): void {
    parentPort!.postMessage({
      type: 'ORDER_CANCELLED',
      orderId,
      userId,
      price,
      qty,
      side,
    });
  }
}

class WorkerJournalingPort implements JournalingPort {
  public writeEntry(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    parentPort!.postMessage({
      type: 'JOURNAL_ENTRY',
      orderId,
      userId,
      side,
      orderType: type,
      price,
      qty,
    });
  }

  public writeCancelEntry(orderId: number): void {
    parentPort!.postMessage({
      type: 'JOURNAL_CANCEL',
      orderId,
    });
  }

  public writeDepositEntry(userId: number, asset: string, amount: bigint): void {
    // Deposits are logged by the main thread before sending, no-op in worker
  }

  public writeWithdrawEntry(userId: number, asset: string, amount: bigint): void {
    // Withdrawals are logged by the main thread before sending, no-op in worker
  }
}

const rawEventPublisher = new WorkerEventPublisher();
const rawJournalingPort = new WorkerJournalingPort();

const eventPublisher = new SwitchableEventPublisherPort(rawEventPublisher);
const journalingPort = new SwitchableJournalingPort(rawJournalingPort);

// Create the MatchingEngine and Use Cases via StaticFactory
const symbol = `${assets[0]}/${assets[1]}`;
const {
  engine,
  placeOrderUseCase,
  cancelOrderUseCase,
  depositUseCase,
  withdrawUseCase,
  loopUseCase
} = StaticFactory.createEngine(
  symbol,
  assets[0],
  assets[1],
  wallet,
  pool,
  journalingPort,
  eventPublisher
);

// Perform WAL Crash Recovery if a WAL file is specified and exists
if (walPath) {
  eventPublisher.setEnabled(false);
  journalingPort.setEnabled(false);

  try {
    const recoveredEvents = BinaryWALJournalAdapter.readWAL(walPath);
    for (let i = 0; i < recoveredEvents.length; i++) {
      const event = recoveredEvents[i];
      if (event.type === 'PLACE_ORDER') {
        placeOrderUseCase.execute(
          event.orderId,
          event.userId,
          event.side,
          event.orderType,
          event.price,
          event.qty
        );
      } else if (event.type === 'CANCEL_ORDER') {
        cancelOrderUseCase.execute(event.orderId);
      } else if (event.type === 'DEPOSIT') {
        depositUseCase.execute(event.userId, event.asset, event.amount);
      } else if (event.type === 'WITHDRAW') {
        withdrawUseCase.execute(event.userId, event.asset, event.amount);
      }
    }
  } catch (err) {
    console.error('Error during WAL crash recovery in worker thread:', err);
  }

  eventPublisher.setEnabled(true);
  journalingPort.setEnabled(true);
}

// Start the message adapter to listen for messages from the parent thread
const messageAdapter = new WorkerThreadMessageAdapter(loopUseCase);
messageAdapter.start();

// Helper functions for BST traversal in RedBlackTree
function getSuccessor(node: any, nil: any): any {
  if (node.right !== nil) {
    let current = node.right;
    while (current.left !== nil) {
      current = current.left;
    }
    return current;
  }
  let p = node.parent;
  let current = node;
  while (p !== nil && current === p.right) {
    current = p;
    p = p.parent;
  }
  return p === nil ? null : p;
}

function getPredecessor(node: any, nil: any): any {
  if (node.left !== nil) {
    let current = node.left;
    while (current.right !== nil) {
      current = current.right;
    }
    return current;
  }
  let p = node.parent;
  let current = node;
  while (p !== nil && current === p.left) {
    current = p;
    p = p.parent;
  }
  return p === nil ? null : p;
}

// L2 Depth Aggregator (50ms)
setInterval(() => {
  // Pre-allocate Float64Array
  // Index 0: bids count
  // Index 1: asks count
  // Indices 2-21: bid prices (up to 20)
  // Indices 22-41: bid quantities (up to 20)
  // Indices 42-61: ask prices (up to 20)
  // Indices 62-81: ask quantities (up to 20)
  const l2Data = new Float64Array(82);

  const nil = engine.bids.getNIL();

  // 1. Collect Bids (Highest to Lowest price)
  let bidCount = 0;
  let currentBidNode = engine.bids.getMaxNode();
  while (currentBidNode !== null && currentBidNode !== nil && bidCount < 20) {
    let totalQty: bigint = 0n;
    let currentOrder = currentBidNode.list.head;
    while (currentOrder !== null) {
      totalQty += (BigInt(currentOrder.qty) - BigInt(currentOrder.filledQty));
      currentOrder = currentOrder.next;
    }

    if (totalQty > 0n) {
      l2Data[2 + bidCount] = Number(currentBidNode.price) / 100000000;
      l2Data[22 + bidCount] = Number(totalQty) / 100000000;
      bidCount++;
    }

    currentBidNode = getPredecessor(currentBidNode, nil);
  }
  l2Data[0] = bidCount;

  // 2. Collect Asks (Lowest to Highest price)
  let askCount = 0;
  let currentAskNode = engine.asks.getMinNode();
  while (currentAskNode !== null && currentAskNode !== nil && askCount < 20) {
    let totalQty: bigint = 0n;
    let currentOrder = currentAskNode.list.head;
    while (currentOrder !== null) {
      totalQty += (BigInt(currentOrder.qty) - BigInt(currentOrder.filledQty));
      currentOrder = currentOrder.next;
    }

    if (totalQty > 0n) {
      l2Data[42 + askCount] = Number(currentAskNode.price) / 100000000;
      l2Data[62 + askCount] = Number(totalQty) / 100000000;
      askCount++;
    }

    currentAskNode = getSuccessor(currentAskNode, nil);
  }
  l2Data[1] = askCount;

  // Transfer the buffer using postMessage Transferable Objects
  parentPort!.postMessage(
    {
      type: 'L2_UPDATE',
      data: l2Data,
    },
    [l2Data.buffer]
  );
}, 50);

// Notify the parent thread that the worker is ready
parentPort!.postMessage({ type: 'READY' });
