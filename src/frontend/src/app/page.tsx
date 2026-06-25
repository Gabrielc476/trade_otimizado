"use client";

import React, { useEffect } from "react";
import { MainCanvas3D } from "../components/MainCanvas3D";
import { Header } from "../components/Header";
import { WalletPanel } from "../components/WalletPanel";
import { OrderEntryForm } from "../components/OrderEntryForm";
import { TradeHistoryList } from "../components/TradeHistoryList";
import { TradingViewChart } from "../components/TradingViewChart";
import { MockMarketGenerator } from "../utils/mockGenerator";
import { Eye, Shield, Cpu, RefreshCw, BarChart2 } from "lucide-react";

export default function TerminalPage() {
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"3D" | "2D">("3D");

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
      
      {/* 1. MOTOR GRÁFICO 3D - Renderizado apenas na aba 3D para economizar 100% de GPU na aba 2D */}
      {activeTab === "3D" && <MainCanvas3D />}

      {/* 2. OVERLAY DA INTERFACE DO USUÁRIO (Bento Grid Modular em Z-Index 10) */}
      {/* Usando pointer-events-none nas grades externas e pointer-events-auto nos painéis */}
      <div className="relative z-10 w-full min-h-screen p-4 grid grid-cols-12 gap-4 pointer-events-none flex flex-col md:grid md:grid-rows-6 md:h-screen">
        
        {/* CABEÇALHO / TELEMETRIA E SELETOR DE ABAS (Col 1 a 12, Row 1) */}
        <div className="col-span-12 md:row-span-1 flex items-center">
          <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* =========================================================
            ABA 1: HOLOGRAFIA 3D (Foco na imersão e análise visual HUD)
            ========================================================= */}
        {activeTab === "3D" && (
          <>
            {/* LADO ESQUERDO: FORMULÁRIO DE ORDENS (Col 1 a 3, Row 2 a 6) */}
            <section className="col-span-12 md:col-span-3 md:row-span-5 bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between pointer-events-auto shadow-2xl">
              <div className="flex flex-col gap-1.5 mb-4 font-mono">
                <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-400" />
                  <span>TERMINAL DE ORDENS</span>
                </h2>
                <p className="text-[9px] text-zinc-500">
                  ENVIE ORDENS DIRETAS AO MOTOR DE CASAMENTO FIFO EM MEMÓRIA
                </p>
              </div>
              <OrderEntryForm />
            </section>

            {/* CENTRO: ESPAÇO TRANSPARENTE DA CENA WebGL (Col 4 a 8, Row 2 a 6) */}
            <div className="col-span-12 md:col-span-5 md:row-span-5 flex flex-col justify-between pointer-events-none h-full">
              {/* Rótulo informativo sobre a órbita 3D */}
              <div className="flex-1 flex flex-col justify-start items-center p-4">
                <div className="bg-black/55 border border-zinc-900/35 px-3.5 py-2 rounded-full flex items-center gap-2 text-[9px] font-mono text-zinc-400 pointer-events-auto backdrop-blur-sm shadow-xl">
                  <Eye className="h-3.5 w-3.5 text-zinc-500 animate-pulse" />
                  <span>VISUALIZAÇÃO HOLOGRÁFICA 3D ATIVA // CLIQUE E ARRASTE PARA ORBITAR A CENA</span>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: CARTEIRA E ESPAÇO DE RENDERIZAÇÃO (Col 9 a 12, Row 2 a 6) */}
            <section className="col-span-12 md:col-span-4 md:row-span-5 flex flex-col gap-4 pointer-events-none h-full">
              {/* Carteira do Usuário */}
              <div className="pointer-events-auto">
                <WalletPanel />
              </div>
              
              {/* Deixa o espaço inferior vazio e transparente para visualização total do fluxo de partículas e grid */}
              <div className="flex-1" />
            </section>
          </>
        )}

        {/* =========================================================
            ABA 2: TERMINAL 2D (Foco em dados numéricos e análise técnica)
            ========================================================= */}
        {activeTab === "2D" && (
          <>
            {/* LADO ESQUERDO: FORMULÁRIO DE ORDENS (Col 1 a 3, Row 2 a 6) */}
            <section className="col-span-12 md:col-span-3 md:row-span-5 bg-zinc-950/45 border border-zinc-800/45 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between pointer-events-auto shadow-2xl">
              <div className="flex flex-col gap-1.5 mb-4 font-mono">
                <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-400" />
                  <span>TERMINAL DE ORDENS</span>
                </h2>
                <p className="text-[9px] text-zinc-500">
                  ENVIE ORDENS DIRETAS AO MOTOR DE CASAMENTO FIFO EM MEMÓRIA
                </p>
              </div>
              <OrderEntryForm />
            </section>

            {/* CENTRO: GRÁFICO CANDLESTICK AMPLIADO (Col 4 a 8, Row 2 a 6) */}
            <div className="col-span-12 md:col-span-5 md:row-span-5 pointer-events-auto flex flex-col justify-start h-full gap-4">
              <TradingViewChart />
              
              {/* Rótulo estético no rodapé do gráfico */}
              <div className="bg-zinc-950/20 border border-zinc-900/35 backdrop-blur-sm rounded-xl p-3 flex items-center gap-2.5 text-[9px] font-mono text-zinc-500">
                <BarChart2 className="h-4 w-4 text-zinc-600" />
                <span>TERMINAL TÉCNICO: ATUALIZAÇÕES INCREMENTAIS DE BAIXA LATÊNCIA SÃO PROCESSADAS VIA CANVAS 2D</span>
              </div>
            </div>

            {/* LADO DIREITO: CARTEIRA E TABELA VIRTUALIZADA (Col 9 a 12, Row 2 a 6) */}
            <section className="col-span-12 md:col-span-4 md:row-span-5 flex flex-col gap-4 pointer-events-none h-full">
              {/* Carteira do Usuário */}
              <div className="pointer-events-auto">
                <WalletPanel />
              </div>

              {/* Tabela de Negócios Recentes (Ocupa o espaço restante) */}
              <div className="flex-1 bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-4 pointer-events-auto shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between font-mono">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-zinc-400" />
                      <span>NEGÓCIOS RECENTES</span>
                    </h2>
                    <p className="text-[9px] text-zinc-500">
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
          </>
        )}

      </div>
    </main>
  );
}
