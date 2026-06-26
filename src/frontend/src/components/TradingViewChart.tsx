import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useStore } from "../store/useStore";
import { LineChart } from "lucide-react";

export const TradingViewChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const chartRef = useRef<any>(null);

  // Armazena a última vela ativa para atualizações incrementais
  const lastCandleRef = useRef<{
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Inicializa o gráfico do TradingView Lightweight Charts
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "Space Mono, Courier New, monospace",
      },
      grid: {
        vertLines: { color: "#121214" },
        horzLines: { color: "#121214" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderDownColor: "#f43f5e",
      borderUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      wickUpColor: "#10b981",
    });

    candleSeriesRef.current = candleSeries;
    chartRef.current = chart;

    // 2. Gera dados históricos fictícios para povoar o gráfico inicialmente
    const initialData = [];
    let baseTime = Math.floor(Date.now() / 1000) - 100 * 60; // 100 minutos atrás
    let currentPrice = 65000.0;

    for (let i = 0; i < 100; i++) {
      const open = currentPrice;
      const close = currentPrice + (Math.random() - 0.5) * 150.0;
      const high = Math.max(open, close) + Math.random() * 40.0;
      const low = Math.min(open, close) - Math.random() * 40.0;

      initialData.push({
        time: (baseTime + i * 60) as UTCTimestamp,
        open,
        high,
        low,
        close,
      });

      currentPrice = close;
    }

    candleSeries.setData(initialData);
    
    // Armazena a última vela para atualizações incrementais em tempo real
    const last = initialData[initialData.length - 1];
    lastCandleRef.current = { ...last };

    // 3. Gerencia o redimensionamento da janela
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // 4. Escuta os negócios em tempo real e atualiza incrementalmente a vela ativa
  useEffect(() => {
    let lastTrades = useStore.getState().trades;
    const unsubscribe = useStore.subscribe((state) => {
      const trades = state.trades;
      if (trades === lastTrades) return;
      lastTrades = trades;

      if (trades.length === 0 || !candleSeriesRef.current || !lastCandleRef.current) return;
      const lastTrade = trades[0];

      const tradeTime = Math.floor(lastTrade.timestamp / 1000);
      const candleMinute = Math.floor(tradeTime / 60) * 60 as UTCTimestamp;
      const lastCandle = lastCandleRef.current;

      // Se o negócio pertence ao mesmo minuto da última vela, atualiza ela
      if (candleMinute === lastCandle.time) {
        lastCandle.close = lastTrade.price;
        if (lastTrade.price > lastCandle.high) lastCandle.high = lastTrade.price;
        if (lastTrade.price < lastCandle.low) lastCandle.low = lastTrade.price;
        candleSeriesRef.current.update(lastCandle);
      } else {
        // Caso contrário, inicia uma nova vela de minuto
        const newCandle = {
          time: candleMinute,
          open: lastTrade.price,
          high: lastTrade.price,
          low: lastTrade.price,
          close: lastTrade.price,
        };
        candleSeriesRef.current.update(newCandle);
        lastCandleRef.current = newCandle;
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-zinc-950/20 border border-zinc-900/35 backdrop-blur-sm rounded-xl p-4 flex flex-col gap-2 shadow-xl">
      <div className="flex items-center justify-between text-zinc-400 text-xs font-mono tracking-wider mb-2 font-bold">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-zinc-500" />
          <span>GRÁFICO DE NEGOCIAÇÃO (BTC/USD) - 1m</span>
        </div>
        <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800/50">
          REAL-TIME GRAPHICS
        </span>
      </div>
      <div ref={chartContainerRef} className="w-full h-[280px] rounded-lg overflow-hidden border border-zinc-900/30 bg-black/10" />
    </div>
  );
};
