"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../store/useStore";
import { Mail, Lock, User, ShieldAlert, ArrowRight, Cpu } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const token = useStore((state) => state.token);
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const hydrateAuth = useStore((state) => state.hydrateAuth);

  const [mounted, setMounted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize and check auth
  useEffect(() => {
    setMounted(true);
    hydrateAuth();
  }, [hydrateAuth]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (mounted && currentUser) {
      router.push("/");
    }
  }, [mounted, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(false);

    if (!email || !password || (isRegistering && !name)) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // 1. Register
        const regRes = await fetch("http://localhost:3001/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, password }),
        });

        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.message || "Falha ao realizar o cadastro.");
        }
      }

      // 2. Login
      const logRes = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!logRes.ok) {
        const errData = await logRes.json();
        throw new Error(errData.message || "E-mail ou senha incorretos.");
      }

      const data = await logRes.json();
      setCurrentUser(data.user, data.accessToken);
      
      // Redirect to dashboard
      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de autenticação.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || currentUser) {
    return <div className="min-h-screen w-full bg-[#030303]" />;
  }

  return (
    <main className="relative min-h-screen w-full bg-[#030303] flex items-center justify-center p-4 overflow-hidden font-mono select-none">
      {/* Luzes de Fundo Ambientais (Glow) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "6s" }} />

      {/* Painel de Autenticação */}
      <div className="relative z-10 w-full max-w-md bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-xl rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
        
        {/* Identidade Visual */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-emerald-400 shadow-inner">
            <Cpu className="h-6 w-6 animate-pulse" />
          </div>
          <h1 className="text-lg font-black tracking-widest text-zinc-100 uppercase mt-2">
            APEX_TRADE <span className="text-zinc-500 font-normal">// PORTAL</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-wider">
            SISTEMA DE NEGOCIAÇÃO DE ALTA PERFORMANCE
          </p>
        </div>

        {/* Abas Login vs Cadastro */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 border border-zinc-900 rounded-lg text-[11px] font-bold">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false);
              setErrorMsg(null);
            }}
            className={`py-2.5 rounded-md transition-all cursor-pointer ${
              !isRegistering
                ? "bg-zinc-900 text-emerald-400 border border-zinc-800/20"
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            ENTRAR (LOGIN)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              setErrorMsg(null);
            }}
            className={`py-2.5 rounded-md transition-all cursor-pointer ${
              isRegistering
                ? "bg-zinc-900 text-emerald-400 border border-zinc-800/20"
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            CRIAR CONTA
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {isRegistering && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-zinc-500 font-bold">NOME COMPLETO</label>
              <div className="relative w-full">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gabriel Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/80 border border-zinc-900 focus:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 font-bold focus:outline-none w-full transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 font-bold">ENDEREÇO DE E-MAIL</label>
            <div className="relative w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/80 border border-zinc-900 focus:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 font-bold focus:outline-none w-full transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 font-bold">SENHA DE ACESSO</label>
            <div className="relative w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/80 border border-zinc-900 focus:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 font-bold focus:outline-none w-full transition-all"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 text-xs text-rose-400 font-bold bg-rose-950/15 border border-rose-900/30 p-3 rounded-lg leading-relaxed">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800/40 text-black font-black text-xs border border-emerald-400 disabled:border-transparent shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? (
              "AUTENTICANDO..."
            ) : (
              <>
                <span>{isRegistering ? "CONFIRMAR CADASTRO" : "ENTRAR NO SISTEMA"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

        </form>

        <div className="text-center text-[9px] text-zinc-600 font-bold leading-relaxed border-t border-zinc-900/60 pt-4">
          PROTEÇÃO CRIPTOGRÁFICA END-TO-END // MOTOR DE CASAMENTO DE ALTA PERFORMANCE FIFO L2 AGGREGATOR
        </div>
      </div>
    </main>
  );
}
