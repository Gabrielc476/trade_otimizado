import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Cpu, Radio, ShieldCheck, DollarSign, Link2, Link2Off, LogIn, LogOut, UserPlus, User } from "lucide-react";
import { wsClient } from "../utils/websocket";

export const Header: React.FC = () => {
  const rps = useStore((state) => state.rps);
  const volatility = useStore((state) => state.volatility);
  const openInterest = useStore((state) => state.openInterest);

  // Live trading state
  const isLive = useStore((state) => state.isLive);
  const isLiveConnected = useStore((state) => state.isLiveConnected);
  const currentUser = useStore((state) => state.currentUser);
  const setIsLive = useStore((state) => state.setIsLive);
  const setCurrentUser = useStore((state) => state.setCurrentUser);

  // Auth form state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Removed handleModeToggle since simulator mode is retired

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    let loginId = parseInt(userId, 10);
    if (!isRegistering) {
      if (isNaN(loginId) || loginId <= 0) {
        setErrorMsg("ID do usuário deve ser um número positivo.");
        setLoading(false);
        return;
      }
    }

    try {
      if (isRegistering) {
        // 1. Register
        const regRes = await fetch("http://localhost:3001/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: username || "New User", password }),
        });

        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.message || "Erro no cadastro.");
        }

        const regData = await regRes.json();
        loginId = regData.userId;
      }

      // 2. Login
      const logRes = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loginId, password }),
      });

      if (!logRes.ok) {
        const errData = await logRes.json();
        throw new Error(errData.message || "Erro no login.");
      }

      const data = await logRes.json();
      
      if (isRegistering) {
        alert(`Cadastro realizado com sucesso! Seu ID único de login é: ${loginId}. Guarde este número.`);
      }

      setCurrentUser(data.user, data.accessToken);
      setShowAuthModal(false);
      
      // Reset form
      setUserId("");
      setUsername("");
      setPassword("");
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null, null);
    wsClient.disconnect();
  };

  return (
    <header className="col-span-12 min-h-16 bg-zinc-950/45 border border-zinc-800/40 backdrop-blur-md rounded-xl px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto shadow-2xl relative">
      {/* Lado Esquerdo: Identidade Visual e Seletor de Modo */}
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

      {/* Centro/Direita: Autenticação Inline ou Telemetria */}
      <div className="flex flex-wrap items-center gap-6 md:gap-8 text-xs font-mono text-zinc-400">
        {isLive && currentUser ? (
          <div className="flex items-center gap-4 border-r border-zinc-900 pr-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <User className="h-4 w-4" />
              <span>{currentUser.name.toUpperCase()} (#{currentUser.id})</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-zinc-500 hover:text-rose-400 font-bold text-[10px] bg-zinc-900/50 border border-zinc-800 hover:border-rose-900/40 px-2.5 py-1 rounded transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              SAIR
            </button>
          </div>
        ) : isLive && !currentUser ? (
          <div className="flex items-center gap-3 border-r border-zinc-900 pr-6">
            <span className="text-[10px] text-zinc-500 font-bold">LIVE MODE // AUTHENTICATION REQUIRED</span>
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold text-[10px] bg-emerald-950/20 border border-emerald-900/30 hover:border-emerald-500/40 px-3 py-1.5 rounded transition-all cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              ENTRAR / REGISTRAR
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

      {/* Modal de Autenticação Flutuante */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl font-mono relative">
            <h2 className="text-sm font-black text-zinc-100 tracking-wider uppercase border-b border-zinc-900 pb-3 mb-4 flex items-center gap-2">
              {isRegistering ? <UserPlus className="h-5 w-5 text-emerald-400" /> : <LogIn className="h-5 w-5 text-emerald-400" />}
              <span>{isRegistering ? "Criar Nova Conta" : "Entrar no Motor Real"}</span>
            </h2>

            {/* Abas Login/Cadastro */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black border border-zinc-900 rounded-lg mb-4 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => { setIsRegistering(false); setErrorMsg(null); }}
                className={`py-2 rounded-md transition-all cursor-pointer ${!isRegistering ? "bg-zinc-900 text-emerald-400" : "text-zinc-500 hover:text-zinc-400"}`}
              >
                LOGIN
              </button>
              <button
                type="button"
                onClick={() => { setIsRegistering(true); setErrorMsg(null); }}
                className={`py-2 rounded-md transition-all cursor-pointer ${isRegistering ? "bg-zinc-900 text-emerald-400" : "text-zinc-500 hover:text-zinc-400"}`}
              >
                CADASTRO
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              {!isRegistering && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold">ID DO USUÁRIO (NÚMERO)</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 1, 2, 100"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="bg-black border border-zinc-900 rounded-lg p-2.5 text-sm text-zinc-200 font-bold focus:outline-none focus:border-zinc-850 w-full"
                  />
                </div>
              )}

              {isRegistering && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-zinc-500 font-bold">NOME DE EXIBIÇÃO</label>
                  <input
                    type="text"
                    placeholder="Ex: Trader Alpha"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-black border border-zinc-900 rounded-lg p-2.5 text-sm text-zinc-200 font-bold focus:outline-none focus:border-zinc-850 w-full"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-zinc-500 font-bold">SENHA DE ACESSO</label>
                <input
                  type="password"
                  required
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black border border-zinc-900 rounded-lg p-2.5 text-sm text-zinc-200 font-bold focus:outline-none focus:border-zinc-850 w-full"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 font-bold bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-lg text-center">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setShowAuthModal(false); setIsLive(false); }}
                  className="flex-1 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 font-bold text-xs border border-zinc-900 hover:border-zinc-800 transition-all cursor-pointer text-center"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs border border-emerald-400 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? "PROCESSANDO..." : isRegistering ? "REGISTRAR E ENTRAR" : "ENTRAR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};


