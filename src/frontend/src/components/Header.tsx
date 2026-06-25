import React from "react";
import { useStore } from "../store/useStore";
import { Cpu, Radio, ShieldCheck, Eye, LineChart } from "lucide-react";

interface HeaderProps {
  activeTab: "3D" | "2D";
  setActiveTab: (tab: "3D" | "2D") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  // Seletores granulares do Zustand para evitar re-render desnecessário de outros painéis
  const rps = useStore((state) => state.rps);
  const volatility = useStore((state) => state.volatility);

  return (
    <header className="col-span-12 h-14 bg-zinc-950/45 border border-zinc-800/40 backdrop-blur-md rounded-xl px-6 flex items-center justify-between pointer-events-auto shadow-2xl">
      {/* Lado Esquerdo: Logo */}
      <div className="flex items-center gap-3 w-1/3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <h1 className="text-xs font-bold tracking-widest text-zinc-100 font-mono hidden lg:block">
          APEX_TRADE // ENGINE_CONTROL
        </h1>
        <h1 className="text-xs font-bold tracking-widest text-zinc-100 font-mono lg:hidden">
          APEX_TRADE
        </h1>
      </div>

      {/* Centro: Seletor de Abas (Navegação) */}
      <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-zinc-900 rounded-lg h-9 font-mono">
        <button
          onClick={() => setActiveTab("3D")}
          className={`px-3 py-1.5 rounded-md text-[9px] font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "3D"
              ? "bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-inner"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>HOLOGRAFIA 3D</span>
        </button>
        <button
          onClick={() => setActiveTab("2D")}
          className={`px-3 py-1.5 rounded-md text-[9px] font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "2D"
              ? "bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-inner"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <LineChart className="h-3.5 w-3.5" />
          <span>TERMINAL 2D</span>
        </button>
      </div>

      {/* Lado Direito: Métricas de Telemetria */}
      <div className="flex items-center justify-end gap-6 text-[9px] font-mono text-zinc-400 w-1/3">
        <div className="hidden md:flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>MOTOR: <span className="text-emerald-400 font-bold">ONLINE</span></span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-zinc-400" />
          <span>LOAD: <span className="text-zinc-100 font-bold">{rps.toLocaleString("en-US")} RPS</span></span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-zinc-400" />
          <span>VOLATILITY: <span className="text-violet-400 font-bold">{(volatility * 100).toFixed(1)}%</span></span>
        </div>
      </div>
    </header>
  );
};
