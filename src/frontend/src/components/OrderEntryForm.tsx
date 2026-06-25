import React, { useState } from "react";
import { useStore, TradeEvent } from "../store/useStore";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export const OrderEntryForm: React.FC = () => {
  const [side, setSide] = useState<0 | 1>(0); // 0 = COMPRA, 1 = VENDA
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState<string>("65000.00");
  const [quantity, setQuantity] = useState<string>("0.1000");

  const { usdBalance, btcBalance, updateBalances, addTrade, bids, asks } = useStore();

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    const q = parseFloat(quantity);
    const p = orderType === "LIMIT" ? parseFloat(price) : (side === 0 ? asks[0]?.price || 65000 : bids[0]?.price || 65000);

    if (isNaN(q) || q <= 0) {
      showNotification("Quantidade inválida.", "error");
      return;
    }
    if (orderType === "LIMIT" && (isNaN(p) || p <= 0)) {
      showNotification("Preço inválido.", "error");
      return;
    }

    if (side === 0) {
      // COMPRA: Trava USD
      const totalCost = q * p;
      if (usdBalance < totalCost) {
        showNotification("Saldo USD insuficiente.", "error");
        return;
      }
      // Executa ordem de compra (simulação instantânea)
      updateBalances(usdBalance - totalCost, btcBalance + q);
      showNotification(`Ordem de Compra Executada: ${q.toFixed(4)} BTC @ ${p.toFixed(2)} USD`, "success");
      
      // Injeta trade instantâneo para feedback 3D imediato!
      triggerSimulatedTrade(p, q, 0);
    } else {
      // VENDA: Trava BTC
      if (btcBalance < q) {
        showNotification("Saldo BTC insuficiente.", "error");
        return;
      }
      // Executa ordem de venda (simulação instantânea)
      const totalCredit = q * p;
      updateBalances(usdBalance + totalCredit, btcBalance - q);
      showNotification(`Ordem de Venda Executada: ${q.toFixed(4)} BTC @ ${p.toFixed(2)} USD`, "success");
      
      // Injeta trade instantâneo para feedback 3D imediato!
      triggerSimulatedTrade(p, q, 1);
    }
  };

  const showNotification = (text: string, type: "success" | "error") => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const triggerSimulatedTrade = (price: number, qty: number, side: 0 | 1) => {
    const customTrade: TradeEvent = {
      id: Math.floor(Math.random() * 1000000) + 9000000,
      price,
      quantity: qty,
      side,
      timestamp: Date.now(),
    };
    addTrade(customTrade);
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full font-mono text-xs">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Seletor de Lado (Compra / Venda) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 border border-zinc-900 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setSide(0);
              setNotification(null);
            }}
            className={`py-2 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
              side === 0
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 shadow-inner"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>COMPRAR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSide(1);
              setNotification(null);
            }}
            className={`py-2 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
              side === 1
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/35 shadow-inner"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            <span>VENDER</span>
          </button>
        </div>

        {/* Tipo de Ordem */}
        <div className="flex items-center gap-4 text-[10px] text-zinc-500 border-b border-zinc-900 pb-2">
          <button
            type="button"
            onClick={() => setOrderType("LIMIT")}
            className={`font-bold pb-1 transition-all ${
              orderType === "LIMIT" ? "text-zinc-200 border-b border-zinc-200" : "hover:text-zinc-400"
            }`}
          >
            LIMITE
          </button>
          <button
            type="button"
            onClick={() => setOrderType("MARKET")}
            className={`font-bold pb-1 transition-all ${
              orderType === "MARKET" ? "text-zinc-200 border-b border-zinc-200" : "hover:text-zinc-400"
            }`}
          >
            MERCADO
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3">
          {orderType === "LIMIT" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-zinc-500 tracking-wide">PREÇO DE EXECUÇÃO (USD)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-black/60 border border-zinc-900 rounded-lg p-2.5 text-zinc-100 font-bold focus:outline-none focus:border-zinc-700 font-mono w-full"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] text-zinc-500 tracking-wide">QUANTIDADE DE ATIVO (BTC)</label>
            <input
              type="number"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-black/60 border border-zinc-900 rounded-lg p-2.5 text-zinc-100 font-bold focus:outline-none focus:border-zinc-700 font-mono w-full"
            />
          </div>
        </div>

        {/* Estimativa / Custos */}
        <div className="bg-black/25 border border-zinc-950/80 rounded-lg p-3 flex flex-col gap-1.5 text-[10px] font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>Subtotal Estimado:</span>
            <span className="text-zinc-300">
              {((parseFloat(quantity) || 0) * (orderType === "LIMIT" ? parseFloat(price) || 0 : 65000)).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-900/50 pt-1.5">
            <span>Taxa de Corretagem (0.0%):</span>
            <span className="text-emerald-500">0.00 USD</span>
          </div>
        </div>
      </form>

      {/* Notificações de Sucesso/Erro */}
      <div className="h-10 my-2 flex items-center justify-center">
        {notification && (
          <div
            className={`w-full text-center text-[10px] p-2 rounded border font-bold ${
              notification.type === "success"
                ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                : "bg-rose-950/20 border-rose-900/40 text-rose-400"
            }`}
          >
            {notification.text}
          </div>
        )}
      </div>

      {/* Botão de Envio */}
      <button
        onClick={handleSubmit}
        className={`w-full py-3 rounded-xl font-bold tracking-wider transition-all flex items-center justify-center gap-2 border shadow-lg ${
          side === 0
            ? "bg-emerald-500 hover:bg-emerald-600 text-black border-emerald-400 shadow-emerald-500/10"
            : "bg-rose-500 hover:bg-rose-600 text-black border-rose-400 shadow-rose-500/10"
        }`}
      >
        <span>ENVIAR ORDEM</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
