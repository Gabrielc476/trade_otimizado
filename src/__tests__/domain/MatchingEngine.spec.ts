import { MatchingEngine, SCALE } from '../../domain/entities/MatchingEngine';
import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { ErrorCode } from '../../domain/enums/ErrorCode';

describe('MatchingEngine', () => {
  let wallet: Wallet;
  let pool: OrderPool;
  let engine: MatchingEngine;

  beforeEach(() => {
    wallet = new Wallet();
    pool = new OrderPool(100);
    engine = new MatchingEngine('BTC/USDT', 'BTC', 'USDT', wallet, pool);

    // Provide initial funds
    // User 1: Buyer
    wallet.credit(1, 'USDT', 100000n * SCALE); // 100,000 USDT
    // User 2: Seller
    wallet.credit(2, 'BTC', 10n * SCALE); // 10 BTC
  });

  it('should validate inputs correctly', () => {
    // Zero or negative quantity
    const [code1] = engine.processOrder(1, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 0n);
    expect(code1).toBe(ErrorCode.INVALID_QTY);

    // Limit order with zero or negative price
    const [code2] = engine.processOrder(1, 1, OrderSide.BUY, OrderType.LIMIT, 0n, 1n * SCALE);
    expect(code2).toBe(ErrorCode.INVALID_PRICE);

    // Insufficient balance
    const [code3] = engine.processOrder(1, 1, OrderSide.BUY, OrderType.LIMIT, 200000n * SCALE, 1n * SCALE);
    expect(code3).toBe(ErrorCode.INSUFFICIENT_BALANCE);
  });

  it('should execute exact limit order match', () => {
    // 1. Place sell order at 50,000 USDT for 1 BTC
    const [sellCode, sellTrades] = engine.processOrder(
      100,
      2,
      OrderSide.SELL,
      OrderType.LIMIT,
      50000n * SCALE,
      1n * SCALE
    );
    expect(sellCode).toBe(ErrorCode.SUCCESS);
    expect(sellTrades.length).toBe(0);
    // Vendedor teve 1 BTC bloqueado
    expect(wallet.getBalance(2, 'BTC').locked).toBe(1n * SCALE);

    // 2. Place buy order at 50,000 USDT for 1 BTC
    const [buyCode, buyTrades] = engine.processOrder(
      101,
      1,
      OrderSide.BUY,
      OrderType.LIMIT,
      50000n * SCALE,
      1n * SCALE
    );
    expect(buyCode).toBe(ErrorCode.SUCCESS);
    expect(buyTrades.length).toBe(1);

    const trade = buyTrades[0];
    expect(trade.buyerId).toBe(1);
    expect(trade.sellerId).toBe(2);
    expect(trade.price).toBe(50000n * SCALE);
    expect(trade.qty).toBe(1n * SCALE);

    // Balances check
    // Comprador: -50,000 USDT, +1 BTC
    expect(wallet.getBalance(1, 'USDT').available).toBe(50000n * SCALE);
    expect(wallet.getBalance(1, 'BTC').available).toBe(1n * SCALE);

    // Vendedor: -1 BTC, +50,000 USDT
    expect(wallet.getBalance(2, 'BTC').available).toBe(9n * SCALE);
    expect(wallet.getBalance(2, 'USDT').available).toBe(50000n * SCALE);

    // Pools check: as ordens devem ter sido devolvidas ao pool
    expect(pool.getAvailableCount()).toBe(100);
  });

  it('should handle partial match correctly', () => {
    // Vendedor coloca 2 ordens de venda pequenas:
    // Ordem A: 0.5 BTC a 50,000 USDT
    engine.processOrder(100, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 50000000n); // 0.5 BTC
    // Ordem B: 0.5 BTC a 51,000 USDT
    engine.processOrder(101, 2, OrderSide.SELL, OrderType.LIMIT, 51000n * SCALE, 50000000n); // 0.5 BTC

    // Comprador envia ordem de compra grande: 1.5 BTC a 52,000 USDT
    // Deve casar com as duas ordens de 0.5 BTC e o restante (0.5 BTC) sentar no livro de bids a 52,000 USDT
    const [code, trades] = engine.processOrder(
      102,
      1,
      OrderSide.BUY,
      OrderType.LIMIT,
      52000n * SCALE,
      150000000n // 1.5 BTC
    );

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(2);

    expect(trades[0].price).toBe(50000n * SCALE);
    expect(trades[0].qty).toBe(50000000n);

    expect(trades[1].price).toBe(51000n * SCALE);
    expect(trades[1].qty).toBe(50000000n);

    // Verificar saldos
    // Comprador gastou (50,000 * 0.5) + (51,000 * 0.5) = 25,000 + 25,500 = 50,500 USDT
    // Também tem 0.5 BTC restante a 52,000 USDT bloqueado na wallet (0.5 * 52,000 = 26,000 USDT)
    // Saldo disponível do comprador: 100,000 - 50,500 - 26,000 = 23,500 USDT
    // Saldo bloqueado do comprador: 26,000 USDT
    // Ativo base do comprador: 1.0 BTC disponível (casou 0.5 + 0.5)
    expect(wallet.getBalance(1, 'USDT').available).toBe(23500n * SCALE);
    expect(wallet.getBalance(1, 'USDT').locked).toBe(26000n * SCALE);
    expect(wallet.getBalance(1, 'BTC').available).toBe(1n * SCALE);
  });

  it('should execute market buy order and refund excess cost', () => {
    // Vendedor coloca 1 BTC a 50,000 USDT
    engine.processOrder(100, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);

    // Comprador envia ordem a mercado de 1.5 BTC.
    // Ele especifica um preço de cap (slippage limit) de 55,000 USDT.
    // Bloqueará 1.5 * 55,000 = 82,500 USDT.
    // Deverá casar 1 BTC a 50,000 USDT.
    // O restante de 0.5 BTC será cancelado e os 0.5 * 55,000 = 27,500 USDT + o desconto de 1 * 5,000 = 5,000 USDT (total 32,500 USDT) serão devolvidos.
    const [code, trades] = engine.processOrder(
      101,
      1,
      OrderSide.BUY,
      OrderType.MARKET,
      55000n * SCALE,
      150000000n // 1.5 BTC
    );

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(1);
    expect(trades[0].price).toBe(50000n * SCALE);
    expect(trades[0].qty).toBe(1n * SCALE);

    // Comprador deve ter 1 BTC disponível
    expect(wallet.getBalance(1, 'BTC').available).toBe(1n * SCALE);
    // Saldo USDT do comprador: 100,000 - 50,000 = 50,000 USDT disponível, 0 bloqueado.
    expect(wallet.getBalance(1, 'USDT').available).toBe(50000n * SCALE);
    expect(wallet.getBalance(1, 'USDT').locked).toBe(0n);
  });

  it('should execute market sell order and refund excess base asset', () => {
    // Comprador coloca bid de 1 BTC a 50,000 USDT
    engine.processOrder(100, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);

    // Vendedor envia ordem a mercado de venda de 2 BTC.
    // Deverá casar 1 BTC a 50,000 USDT.
    // O restante de 1 BTC será cancelado e desbloqueado de sua wallet.
    const [code, trades] = engine.processOrder(
      101,
      2,
      OrderSide.SELL,
      OrderType.MARKET,
      0n, // Preço irrelevante para venda a mercado no processamento
      2n * SCALE
    );

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(1);
    expect(trades[0].price).toBe(50000n * SCALE);
    expect(trades[0].qty).toBe(1n * SCALE);

    // Vendedor deve ter 9 BTC disponíveis (10 originais - 1 vendido)
    expect(wallet.getBalance(2, 'BTC').available).toBe(9n * SCALE);
    expect(wallet.getBalance(2, 'BTC').locked).toBe(0n);
    // Vendedor deve ter 50,000 USDT disponíveis
    expect(wallet.getBalance(2, 'USDT').available).toBe(50000n * SCALE);
  });

  it('should reject sell order with insufficient balance', () => {
    // User 3 has no BTC
    const [code] = engine.processOrder(105, 3, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    expect(code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
  });

  it('should handle buy order matching part of a larger sell order', () => {
    // 1. Vendedor coloca venda grande: 2 BTC a 50,000 USDT
    engine.processOrder(100, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 2n * SCALE);

    // 2. Comprador coloca compra pequena: 0.5 BTC a 50,000 USDT
    // Deve casar totalmente, deixando a ordem de venda com 1.5 BTC restante no livro (fila não vazia)
    const [code, trades] = engine.processOrder(101, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 50000000n);

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(1);
    expect(trades[0].qty).toBe(50000000n);
  });

  it('should handle sell order matching part of a larger buy order', () => {
    // 1. Comprador coloca compra grande: 2 BTC a 50,000 USDT
    engine.processOrder(100, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 2n * SCALE);

    // 2. Vendedor coloca venda pequena: 0.5 BTC a 50,000 USDT
    // Deve casar totalmente, deixando a ordem de compra com 1.5 BTC restante no livro (fila não vazia)
    const [code, trades] = engine.processOrder(101, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 50000000n);

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(1);
    expect(trades[0].qty).toBe(50000000n);
  });
});
