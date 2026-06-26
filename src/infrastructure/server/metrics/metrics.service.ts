import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly ordersProcessedCounter: Counter;
  private readonly engineRpsGauge: Gauge;
  private readonly latencyP50Gauge: Gauge;
  private readonly latencyP90Gauge: Gauge;
  private readonly latencyP99Gauge: Gauge;
  private readonly volatilityGauge: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // Collect default process and system metrics (CPU, memory, heap, event loop, etc.)
    collectDefaultMetrics({ register: this.registry });

    // Custom metrics for the ApexTrade matching engine
    this.ordersProcessedCounter = new Counter({
      name: 'engine_processed_orders_total',
      help: 'Total number of orders processed by the matching engine',
      registers: [this.registry],
    });

    this.engineRpsGauge = new Gauge({
      name: 'engine_rps',
      help: 'Current throughput of the engine (Requests per Second)',
      registers: [this.registry],
    });

    this.latencyP50Gauge = new Gauge({
      name: 'engine_latency_p50_seconds',
      help: 'p50 latency of the engine in seconds',
      registers: [this.registry],
    });

    this.latencyP90Gauge = new Gauge({
      name: 'engine_latency_p90_seconds',
      help: 'p90 latency of the engine in seconds',
      registers: [this.registry],
    });

    this.latencyP99Gauge = new Gauge({
      name: 'engine_latency_p99_seconds',
      help: 'p99 latency of the engine in seconds',
      registers: [this.registry],
    });

    this.volatilityGauge = new Gauge({
      name: 'engine_volatility_ratio',
      help: 'Current relative price volatility index (0.05 to 1.0)',
      registers: [this.registry],
    });
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  public recordMetrics(count: number, rps: number, p50Ms: number, p90Ms: number, p99Ms: number, volatility: number) {
    if (count > 0) {
      this.ordersProcessedCounter.inc(count);
    }
    this.engineRpsGauge.set(rps);
    this.latencyP50Gauge.set(p50Ms / 1000); // convert milliseconds to seconds
    this.latencyP90Gauge.set(p90Ms / 1000);
    this.latencyP99Gauge.set(p99Ms / 1000);
    this.volatilityGauge.set(volatility);
  }
}
