import { MatchingEngine, SCALE } from '../domain/entities/MatchingEngine';
import { Wallet } from '../domain/entities/Wallet';
import { OrderPool } from '../domain/entities/OrderPool';
import { OrderSide } from '../domain/enums/OrderSide';
import { OrderType } from '../domain/enums/OrderType';

function runBenchmark() {
  const wallet = new Wallet();
  const pool = new OrderPool(200000);
  const engine = new MatchingEngine('BTC/USDT', 'BTC', 'USDT', wallet, pool);

  const numOrders = 100000;
  const numUsers = 100;

  // Pre-credita saldos abundantes para evitar erros de falta de saldo no benchmark
  for (let i = 1; i <= numUsers; i++) {
    wallet.credit(i, 'USDT', 10000000n * SCALE); // 10M USDT
    wallet.credit(i, 'BTC', 1000n * SCALE); // 1000 BTC
  }

  console.log(`Iniciando benchmark de alta performance com ${numOrders} ordens...`);

  const start = process.hrtime.bigint();

  let orderId = 1;
  for (let i = 0; i < numOrders; i++) {
    const userId = (i % numUsers) + 1;
    
    // Alterna compra e venda em torno do preço médio de 50.000 USDT para provocar cruzamentos constantes
    const side = i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL;
    
    // Variações de preço controladas para cruzamentos e inserções no livro
    const priceOffset = BigInt((i % 20) - 10) * 10n * SCALE; // -100 a +90 USDT
    const price = 50000n * SCALE + priceOffset;
    const qty = 1n * SCALE; // 1 BTC

    engine.processOrder(orderId++, userId, side, OrderType.LIMIT, price, qty);
  }

  const end = process.hrtime.bigint();
  const durationNs = end - start;
  const durationMs = Number(durationNs) / 1_000_000;
  const avgUs = Number(durationNs) / numOrders / 1000;
  const rps = (numOrders / durationMs) * 1000;

  console.log('\n==================================================');
  console.log('            APEX TRADE BENCHMARK RESULTS          ');
  console.log('==================================================');
  console.log(`Total de Ordens Processadas : ${numOrders}`);
  console.log(`Tempo Total Decorrido       : ${durationMs.toFixed(2)} ms`);
  console.log(`Latência Média por Ordem    : ${avgUs.toFixed(3)} microssegundos`);
  console.log(`Throughput Estimado         : ${rps.toFixed(0)} ordens/segundo (RPS)`);
  console.log('==================================================\n');
}

runBenchmark();
