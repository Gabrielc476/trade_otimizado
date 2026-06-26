import React from "react";
import { useStore } from "../store/useStore";
import { Cpu, Radio, ShieldCheck, DollarSign, Link2, Link2Off, LogOut, User } from "lucide-react";
import { wsClient } from "../utils/websocket";
import { useRouter } from "next/navigation";

export const Header: React.FC = () => {
  const router = useRouter();
  
  const rps = useStore((state) => state.rps);
  const volatility = useStore((state) => state.volatility);
  const openInterest = useStore((state) => state.openInterest);

  const isLiveConnected = useStore((state) => state.isLiveConnected);
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);

  const handleLogout = () => {
    setCurrentUser(null, null);
    wsClient.disconnect();
    router.push("/login");
  };

  return (
    <header className="col-span-12 min-h-16 bg-zinc-950/45 border border-zinc-800/40 backdrop-blur-md rounded-xl px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto shadow-2xl relative">
      {/* Lado Esquerdo: Identidade Visual */}
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLiveConnected ? "bg-emerald-400" : "bg-amber-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLiveConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
          </span>
          <div className="flex flex-col font-mono">
            <h1 className="text-sm font-black tracking-widest text-zinc-100 uppercase">
              APEX_TRADE <span className="text-zinc-500 font-normal">// CONTROL_PANEL</span>
            </h1>
            <span className="text-[9px] text-zinc-500 font-bold tracking-wider">FIFO MEMORY MATCH ENGINE</span>
          </div>
        </div>

        {/* Badge de Conexão com o Motor Real */}
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-lg">
          {isLiveConnected ? <Link2 className="h-3.5 w-3.5 text-emerald-400" /> : <Link2Off className="h-3.5 w-3.5 text-zinc-500 animate-pulse" />}
          <span>MOTOR REAL (LIVE)</span>
        </div>
      </div>

      {/* Lado Direito: Telemetria e Dados do Usuário */}
      <div className="flex flex-wrap items-center gap-6 md:gap-8 text-xs font-mono text-zinc-400">
        
        {currentUser ? (
          <div className="flex items-center gap-4 border-r border-zinc-900 pr-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <User className="h-4 w-4" />
              <span className="tracking-wide">
                {currentUser.name.toUpperCase()} ({currentUser.email})
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-zinc-500 hover:text-rose-400 font-bold text-[10px] bg-zinc-900/50 border border-zinc-800 hover:border-rose-900/40 px-2.5 py-1.5 rounded transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              SAIR
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 border-r border-zinc-900 pr-6">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-bold">ENGINE: <span className="text-emerald-400 uppercase">ONLINE</span></span>
          </div>
        )}

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
