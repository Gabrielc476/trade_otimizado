"use client";

import React, { useEffect } from "react";
import { MainCanvas3D } from "../components/MainCanvas3D";
import { Header } from "../components/Header";
import { WalletPanel } from "../components/WalletPanel";
import { OrderEntryForm } from "../components/OrderEntryForm";
import { TradeHistoryList } from "../components/TradeHistoryList";
import { TradingViewChart } from "../components/TradingViewChart";
import { MockMarketGenerator } from "../utils/mockGenerator";
import { Eye, Shield, Cpu, RefreshCw, Layout, EyeOff } from "lucide-react";

export default function TerminalPage() {
  const [mounted, setMounted] = React.useState(false);
  const [isHudMode, setIsHudMode] = React.useState(false);

  // Inicializa o gerador de dados de mercado em alta frequência no cliente
  useEffect(() => {
    setMounted(true);
    const generator = new MockMarketGenerator();
    generator.start();

    return () => {
      generator.stop();
    };
  }, []);

  if (!mounted) {
    return <div className="min-h-screen w-full bg-[#030303]" />;
  }

  return (
    <main className="relative min-h-screen w-full bg-[#030303] text-zinc-50 overflow-hidden select-none">
      
      {/* 1. MOTOR GRÁFICO 3D (R3F Canvas flutuando no background) */}
      <MainCanvas3D />

      {/* 2. OVERLAY DA INTERFACE DO USUÁRIO (Bento Grid Modular em Z-Index 10) */}
      {/* Usando pointer-events-none nas grades externas e pointer-events-auto nos painéis */}
      <div className="relative z-10 w-full min-h-screen p-4 grid grid-cols-12 gap-4 pointer-events-none flex flex-col md:grid md:grid-rows-6 md:h-screen">
        
        {/* CABEÇALHO / TELEMETRIA DO SISTEMA (Col 1 a 12, Row 1) */}
        <div className="col-span-12 md:row-span-1 flex items-center">
          <Header />
        </div>

        {/* LADO ESQUERDO: PAINEL DE OPERAÇÃO E CONTROLE (Col 1 a 3, Row 2 a 6) */}
        <section
          className={`col-span-12 md:col-span-3 md:row-span-5 bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between pointer-events-auto shadow-2xl transition-all duration-500 ease-in-out ${
            isHudMode ? "opacity-0 translate-x-[-60px] pointer-events-none" : "opacity-100 translate-x-0"
          }`}
        >
          <div className="flex flex-col gap-1.5 mb-4">
            <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              <span>TERMINAL DE ORDENS</span>
            </h2>
            <p className="text-[9px] text-zinc-500 font-mono leading-relaxed">
              ENVIE ORDENS DIRETAS AO MOTOR DE CASAMENTO FIFO EM MEMÓRIA
            </p>
          </div>
          <OrderEntryForm />
        </section>

        {/* CENTRO DA TELA (Col 4 a 8, Row 2 a 6): GRÁFICO 2D EMBAIXO E REACTOR 3D VISÍVEL NO TOPO */}
        <div className="col-span-12 md:col-span-5 md:row-span-5 flex flex-col justify-between pointer-events-none h-full gap-4">
          
          {/* Espaço transparente no topo (Row 2 a 3) para visualização total do Volatility Reactor Core 3D */}
          <div className="flex-1 flex flex-col justify-start items-center p-4 gap-3">
            <div className="bg-black/55 border border-zinc-900/35 px-3 py-1.5 rounded-full flex items-center gap-2 text-[9px] font-mono text-zinc-400 pointer-events-auto backdrop-blur-sm shadow-xl">
              <Eye className="h-3 w-3 text-zinc-500" />
              <span>REACTOR VOLATILIDADE 3D // CLIQUE & ARRASTE PARA GIRAR A CENA</span>
            </div>

            {/* Botão de alternar visualizações (HUD puro vs Dashboard Completo) */}
            <button
              onClick={() => setIsHudMode(!isHudMode)}
              className="bg-zinc-950/85 border border-violet-500/50 hover:border-violet-400 text-violet-400 font-bold tracking-wider rounded-lg px-4 py-2 text-[9px] font-mono pointer-events-auto shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:shadow-[0_0_20px_rgba(139,92,246,0.30)] transition-all cursor-pointer flex items-center gap-2"
            >
              {isHudMode ? (
                <>
                  <Layout className="h-3.5 w-3.5" />
                  <span>MOSTRAR PAINÉIS COMPLETOS (2D)</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>ATIVAR APENAS HUD HOLOGRÁFICO (3D)</span>
                </>
              )}
            </button>
          </div>

          {/* Gráfico 2D no rodapé (Row 4 a 6) */}
          <div
            className={`pointer-events-auto transition-all duration-500 ease-in-out ${
              isHudMode ? "opacity-0 translate-y-[60px] pointer-events-none" : "opacity-100 translate-y-0"
            }`}
          >
            <TradingViewChart />
          </div>
        </div>

        {/* LADO DIREITO: CARTEIRA E HISTÓRICO DE NEGÓCIOS (Col 9 a 12, Row 2 a 6) */}
        <section
          className={`col-span-12 md:col-span-4 md:row-span-5 flex flex-col gap-4 pointer-events-none h-full transition-all duration-500 ease-in-out ${
            isHudMode ? "opacity-0 translate-x-[60px]" : "opacity-100 translate-x-0"
          }`}
        >
          {/* Painel da Carteira (USD / BTC) */}
          <div className="pointer-events-auto">
            <WalletPanel />
          </div>

          {/* Histórico de Negócios Recentes */}
          <div className="flex-1 bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-4 pointer-events-auto shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-zinc-400" />
                  <span>NEGÓCIOS RECENTES</span>
                </h2>
                <p className="text-[9px] text-zinc-500 font-mono">
                  FEED DE EXECUÇÕES EM ALTA VELOCIDADE DA EX-ENGINE
                </p>
              </div>
              <RefreshCw className="h-3.5 w-3.5 text-zinc-500 animate-spin" style={{ animationDuration: "3s" }} />
            </div>

            <div className="flex-1 overflow-hidden">
              <TradeHistoryList />
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
