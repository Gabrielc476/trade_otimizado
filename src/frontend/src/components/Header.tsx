import React from "react";
import { useStore } from "../store/useStore";
import { Cpu, Radio, ShieldCheck, DollarSign } from "lucide-react";

export const Header: React.FC = () => {
  // Seletores granulares do Zustand para evitar re-render desnecessário
  const rps = useStore((state) => state.rps);
  const volatility = useStore((state) => state.volatility);
  const openInterest = useStore((state) => state.openInterest);

  return (
    <header className="col-span-12 h-16 bg-zinc-950/45 border border-zinc-800/40 backdrop-blur-md rounded-xl px-6 flex items-center justify-between pointer-events-auto shadow-2xl">
      {/* Lado Esquerdo: Identidade Visual e Status */}
      <div className="flex items-center gap-3.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex flex-col font-mono">
          <h1 className="text-sm font-black tracking-widest text-zinc-100 uppercase">
            APEX_TRADE <span className="text-zinc-500 font-normal">// CONTROL_PANEL</span>
          </h1>
          <span className="text-[9px] text-zinc-500 font-bold tracking-wider">FIFO MEMORY MATCH ENGINE</span>
        </div>
      </div>

      {/* Lado Direito: Métricas de Telemetria Técnica */}
      <div className="flex items-center gap-6 md:gap-8 text-xs font-mono text-zinc-400">
        <div className="hidden sm:flex items-center gap-2 border-r border-zinc-900 pr-6">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-[11px] font-bold">ENGINE: <span className="text-emerald-400 uppercase">ONLINE</span></span>
        </div>
        
        <div className="flex items-center gap-2 border-r border-zinc-900 pr-6">
          <Cpu className="h-4 w-4 text-zinc-400" />
          <span className="text-[11px] font-bold">THROUGHPUT: <span className="text-zinc-100">{rps.toLocaleString("en-US")} RPS</span></span>
        </div>

        <div className="hidden md:flex items-center gap-2 border-r border-zinc-900 pr-6">
          <Radio className="h-4 w-4 text-zinc-400 animate-pulse" />
          <span className="text-[11px] font-bold">VOLATILITY: <span className="text-violet-400">{(volatility * 100).toFixed(1)}%</span></span>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-zinc-400" />
          <span className="text-[11px] font-bold">OPEN INTEREST: <span className="text-amber-500">${openInterest.toFixed(1)}M</span></span>
        </div>
      </div>
    </header>
  );
};

