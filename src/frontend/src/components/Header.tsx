import React from "react";
import { useStore } from "../store/useStore";
import { Cpu, Radio, ShieldCheck } from "lucide-react";

export const Header: React.FC = () => {
  // Seletores granulares do Zustand para evitar re-render desnecessário de outros painéis
  const rps = useStore((state) => state.rps);
  const volatility = useStore((state) => state.volatility);

  return (
    <header className="col-span-12 h-14 bg-zinc-950/45 border border-zinc-800/40 backdrop-blur-md rounded-xl px-6 flex items-center justify-between pointer-events-auto shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <h1 className="text-xs font-bold tracking-widest text-zinc-100 font-mono">
          APEX_TRADE // ENGINE_CONTROL_TERMINAL
        </h1>
      </div>

      <div className="flex items-center gap-8 text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>MOTOR: <span className="text-emerald-400 font-bold">ONLINE</span></span>
        </div>
        
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-zinc-400" />
          <span>THROUGHPUT: <span className="text-zinc-100 font-bold">{rps.toLocaleString()} RPS</span></span>
        </div>

        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-zinc-400" />
          <span>VOLATILIDADE: <span className="text-violet-400 font-bold">{(volatility * 100).toFixed(1)}%</span></span>
        </div>
      </div>
    </header>
  );
};
