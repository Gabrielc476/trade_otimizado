import { parentPort, workerData } from 'worker_threads';
import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { StaticFactory } from '../../application/factories/StaticFactory';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { WorkerThreadMessageAdapter } from '../../adapters/concurrency/WorkerThreadMessageAdapter';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

if (!parentPort) {
  throw new Error('engine.worker.ts must be run as a Worker Thread');
}

const { sab, assets } = workerData;

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
}

const eventPublisher = new WorkerEventPublisher();
const journalingPort = new WorkerJournalingPort();

// Create the MatchingEngine and Use Cases via StaticFactory
const symbol = `${assets[0]}/${assets[1]}`;
const { loopUseCase } = StaticFactory.createEngine(
  symbol,
  assets[0],
  assets[1],
  wallet,
  pool,
  journalingPort,
  eventPublisher
);

// Start the message adapter to listen for messages from the parent thread
const messageAdapter = new WorkerThreadMessageAdapter(loopUseCase);
messageAdapter.start();

// Notify the parent thread that the worker is ready
parentPort.postMessage({ type: 'READY' });
