"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../components/Header";
import { WalletPanel } from "../components/WalletPanel";
import { OrderEntryForm } from "../components/OrderEntryForm";
import { TradeHistoryList } from "../components/TradeHistoryList";
import { TradingViewChart } from "../components/TradingViewChart";
import { OrderBook2D } from "../components/OrderBook2D";
import { wsClient } from "../utils/websocket";
import { useStore } from "../store/useStore";
import { Shield, Cpu, RefreshCw, BarChart2 } from "lucide-react";

export default function TerminalPage() {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  // Seletores de estado global do livro para cálculos analíticos em tempo real na interface
  const bids = useStore((state) => state.bids);
  const asks = useStore((state) => state.asks);

  // Calcula métricas analíticas sobre a liquidez total do livro
  const totalBidsQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const totalAsksQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const totalQty = totalBidsQty + totalAsksQty;
  const buyRatio = totalQty > 0 ? (totalBidsQty / totalQty) * 100 : 50;
  const sellRatio = 100 - buyRatio;

  // Encontra as maiores ordens (Walls) dinamicamente para exibição no painel
  let buyWall = { price: 0, quantity: 0 };
  let sellWall = { price: 0, quantity: 0 };

  let maxBidQty = 0;
  for (let i = 0; i < bids.length; i++) {
    if (bids[i].quantity > maxBidQty) {
      maxBidQty = bids[i].quantity;
      buyWall = { price: bids[i].price, quantity: bids[i].quantity };
    }
  }

  let maxAskQty = 0;
  for (let i = 0; i < asks.length; i++) {
    if (asks[i].quantity > maxAskQty) {
      maxAskQty = asks[i].quantity;
      sellWall = { price: asks[i].price, quantity: asks[i].quantity };
    }
  }

  // Filtra as últimas baleias (Whale Trades) para o painel
  const trades = useStore((state) => state.trades);
  const whaleTrades = trades.filter((t) => t.quantity > 1.5).slice(0, 3);

  const token = useStore((state) => state.token);
  const currentUser = useStore((state) => state.currentUser);
  const hydrateAuth = useStore((state) => state.hydrateAuth);

  // Inicializa o estado montado e hidrata a autenticação do localStorage
  useEffect(() => {
    setMounted(true);
    hydrateAuth();
  }, [hydrateAuth]);

  // Guard de autenticação: redireciona se não estiver logado
  useEffect(() => {
    if (mounted && !currentUser) {
      router.push("/login");
    }
  }, [mounted, currentUser, router]);

  // Conecta/desconecta o websocket client baseado no token
  useEffect(() => {
    if (!mounted) return;

    if (token) {
      wsClient.connect(token);
    } else {
      wsClient.disconnect();
    }

    return () => {
      wsClient.disconnect();
    };
  }, [mounted, token]);

  if (!mounted || !currentUser) {
    return <div className="min-h-screen w-full bg-[#030303]" />;
  }

  return (
    <main className="relative min-h-screen w-full bg-[#030303] text-zinc-50 select-none p-4 flex flex-col gap-4 overflow-x-hidden">
      {/* CABEÇALHO / TELEMETRIA */}
      <Header />

      {/* PAINEL PRINCIPAL: GRID BENTO DE 3 COLUNAS */}
      <div className="w-full grid grid-cols-12 gap-4 flex-1">
        
        {/* COLUNA ESQUERDA: CARTEIRA + TERMINAL DE ORDENS (Col 1 a 3 - 3 Colunas) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-4 bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 shadow-2xl h-full">
          <div className="flex flex-col gap-1.5 font-mono border-b border-zinc-900 pb-3">
            <h2 className="text-xs font-bold tracking-wider text-zinc-100 flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              <span>TERMINAL DE ORDENS</span>
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
              ENVIE ORDENS DIRETAS AO MOTOR FIFO EM MEMÓRIA
            </p>
          </div>
          
          <WalletPanel />
          
          <div className="flex-1">
            <OrderEntryForm />
          </div>
        </section>

        {/* COLUNA CENTRAL: GRÁFICO CANDLESTICK + HISTÓRICO DE NEGÓCIOS (Col 4 a 8 - 5 Colunas) */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-4 h-full">
          {/* Gráfico Candlestick */}
          <div className="flex-1">
            <TradingViewChart />
          </div>
          
          {/* Histórico de Negócios Recentes */}
          <div className="bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-3 shadow-2xl overflow-hidden h-[290px]">
            <div className="flex items-center justify-between font-mono">
              <div className="flex flex-col gap-1">
                <h2 className="text-xs font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-zinc-400" />
                  <span>NEGÓCIOS RECENTES</span>
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold">
                  FEED DE EXECUÇÕES EM ALTA VELOCIDADE DA EX-ENGINE
                </p>
              </div>
              <RefreshCw className="h-4 w-4 text-zinc-500 animate-spin" style={{ animationDuration: "3s" }} />
            </div>

            <div className="flex-1 overflow-hidden">
              <TradeHistoryList />
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: LIVRO DE OFERTAS 2D + MÉTRIAS DE LIQUIDEZ E BALEIAS (Col 9 a 12 - 4 Colunas) */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-4 h-full">
          {/* Livro de Ofertas L2 */}
          <OrderBook2D />

          {/* Perfil de Mercado e Liquidez */}
          <div className="bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-4 shadow-2xl font-mono">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
              <span className="text-xs font-bold text-zinc-100 tracking-wider flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-violet-400" />
                <span>PERFIL DE LIQUIDEZ</span>
              </span>
              <span className="text-[9px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 font-bold uppercase">
                Liquidity Walls
              </span>
            </div>

            {/* Suporte e Resistência (Walls) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-xl p-3 flex flex-col gap-1 shadow-inner">
                <div className="text-[9px] text-emerald-400 font-bold tracking-wider flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  BUY WALL (SUPORTE)
                </div>
                <div className="text-xs font-bold text-zinc-200 mt-1 flex flex-col">
                  <span>${buyWall.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-emerald-400 font-bold mt-0.5">{buyWall.quantity.toFixed(2)} BTC</span>
                </div>
              </div>

              <div className="bg-rose-950/10 border border-rose-900/20 rounded-xl p-3 flex flex-col gap-1 shadow-inner">
                <div className="text-[9px] text-rose-400 font-bold tracking-wider flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                  SELL WALL (RESISTÊNCIA)
                </div>
                <div className="text-xs font-bold text-zinc-200 mt-1 flex flex-col">
                  <span>${sellWall.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-rose-400 font-bold mt-0.5">{sellWall.quantity.toFixed(2)} BTC</span>
                </div>
              </div>
            </div>

            {/* Pressão de Compra vs Venda (Imbalance) */}
            <div className="flex flex-col gap-1.5 bg-black/30 border border-zinc-900 rounded-xl p-3">
              <div className="flex justify-between text-[9px] font-bold text-zinc-400">
                <span>IMBALANCE COMPRADOR: {buyRatio.toFixed(0)}%</span>
                <span>VENDEDOR: {sellRatio.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-rose-500/25 rounded-full overflow-hidden flex border border-zinc-900">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${buyRatio}%` }} />
              </div>
            </div>

            {/* Feed de Grandes Blocos (Whale Trades) */}
            <div className="flex flex-col gap-2">
              <div className="text-[9px] text-zinc-500 font-bold tracking-wider uppercase border-b border-zinc-900/50 pb-1.5 flex items-center gap-1.5">
                <span>🐋 GRANDES ORDENS EXECUTADAS</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[70px]">
                {whaleTrades.length === 0 ? (
                  <span className="text-[9px] text-zinc-600 text-center py-2.5 italic">AGUARDANDO ATIVIDADE DE BALEIAS...</span>
                ) : (
                  whaleTrades.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-[9px] bg-black/40 border border-zinc-900 px-3 py-2 rounded-lg font-mono">
                      <span className="text-zinc-500">
                        {new Date(t.timestamp).toLocaleTimeString(undefined, { hour12: false })}
                      </span>
                      <span className={t.side === 0 ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                        {t.quantity.toFixed(2)} BTC
                      </span>
                      <span className="text-zinc-300 font-bold">${t.price.toLocaleString("en-US")}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
