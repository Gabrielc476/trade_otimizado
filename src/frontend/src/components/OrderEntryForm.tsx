import React, { useState, useEffect } from "react";
import { useStore, TradeEvent } from "../store/useStore";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { wsClient } from "../utils/websocket";

export const OrderEntryForm: React.FC = () => {
  const [side, setSide] = useState<0 | 1>(0); // 0 = COMPRA, 1 = VENDA
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState<string>("65000.00");
  const [quantity, setQuantity] = useState<string>("0.1000");

  const {
    usdBalance,
    btcBalance,
    updateBalances,
    addTrade,
    bids,
    asks,
    selectedPrice,
    selectedQuantity,
    setSelectedPrice,
    setSelectedQuantity,
    isLive,
    isLiveConnected,
  } = useStore();

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Escuta cliques reativos vindos do Livro de Ofertas 2D
  useEffect(() => {
    if (selectedPrice !== null) {
      setPrice(selectedPrice);
      setOrderType("LIMIT"); // Auto-seleciona LIMIT para expor o preço carregado
      setSelectedPrice(null); // Reseta a seleção na store
    }
  }, [selectedPrice, setSelectedPrice]);

  useEffect(() => {
    if (selectedQuantity !== null) {
      // Popula a quantidade sugerida se disponível, mas permite ajuste livre
      setQuantity(selectedQuantity);
      setSelectedQuantity(null); // Reseta a seleção na store
    }
  }, [selectedQuantity, setSelectedQuantity]);

  // Função para cálculo rápido de quantidade com base em porcentagens do saldo
  const handlePercentClick = (percent: number) => {
    const activePrice =
      orderType === "LIMIT"
        ? parseFloat(price) || 65000.0
        : side === 0
        ? asks[0]?.price || 65000
        : bids[0]?.price || 65000;

    if (activePrice <= 0) return;

    if (side === 0) {
      // COMPRA: Calcula quanto de BTC pode comprar com X% do saldo USD
      const targetCost = usdBalance * percent;
      const calculatedQty = targetCost / activePrice;
      // Trunca para 4 casas decimais
      setQuantity(calculatedQty.toFixed(4));
    } else {
      // VENDA: Vende X% do saldo BTC disponível
      const calculatedQty = btcBalance * percent;
      setQuantity(calculatedQty.toFixed(4));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    const q = parseFloat(quantity);
    const p =
      orderType === "LIMIT"
        ? parseFloat(price)
        : side === 0
        ? asks[0]?.price || 65000
        : bids[0]?.price || 65000;

    if (isNaN(q) || q <= 0) {
      showNotification("Quantidade inválida.", "error");
      return;
    }
    if (orderType === "LIMIT" && (isNaN(p) || p <= 0)) {
      showNotification("Preço inválido.", "error");
      return;
    }

    if (isLive) {
      if (!isLiveConnected) {
        showNotification("Erro: WebSocket desconectado do motor real.", "error");
        return;
      }
      
      // Verify balance limits on the client side before dispatching
      if (side === 0) {
        const totalCost = q * p;
        if (usdBalance < totalCost) {
          showNotification("Saldo USD insuficiente.", "error");
          return;
        }
      } else {
        if (btcBalance < q) {
          showNotification("Saldo BTC insuficiente.", "error");
          return;
        }
      }

      const wsSide = side === 0 ? 1 : 2; // 1 = BUY, 2 = SELL in engine enums
      const orderId = wsClient.placeOrder(wsSide, orderType, p, q);
      if (orderId !== -1) {
        showNotification(`Ordem enviada ao motor: ID #${orderId}`, "success");
      } else {
        showNotification("Falha ao enviar ordem via WebSocket.", "error");
      }
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
      showNotification(`Compra efetuada: ${q.toFixed(4)} BTC a $${p.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "success");

      // Injeta trade instantâneo para feedback imediato na tela!
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
      showNotification(`Venda efetuada: ${q.toFixed(4)} BTC a $${p.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "success");

      // Injeta trade instantâneo para feedback imediato na tela!
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

  // Preço ativo para exibição reativa de custos
  const activeDisplayPrice =
    orderType === "LIMIT"
      ? parseFloat(price) || 0
      : side === 0
      ? asks[0]?.price || 65000
      : bids[0]?.price || 65000;
  
  const estimatedSubtotal = (parseFloat(quantity) || 0) * activeDisplayPrice;

  return (
    <div className="flex-1 flex flex-col justify-between h-full font-mono text-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Seletor de Lado (Compra / Venda) */}
        <div className="grid grid-cols-2 gap-2.5 p-1 bg-black/60 border border-zinc-900 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setSide(0);
              setNotification(null);
            }}
            className={`py-2.5 rounded-md text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              side === 0
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 shadow-inner"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>COMPRAR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSide(1);
              setNotification(null);
            }}
            className={`py-2.5 rounded-md text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              side === 1
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/35 shadow-inner"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            <span>VENDER</span>
          </button>
        </div>

        {/* Tipo de Ordem */}
        <div className="flex items-center gap-5 text-xs text-zinc-500 border-b border-zinc-900 pb-2">
          <button
            type="button"
            onClick={() => setOrderType("LIMIT")}
            className={`font-bold pb-1 transition-all cursor-pointer ${
              orderType === "LIMIT" ? "text-zinc-200 border-b border-zinc-200" : "hover:text-zinc-400"
            }`}
          >
            LIMITE
          </button>
          <button
            type="button"
            onClick={() => setOrderType("MARKET")}
            className={`font-bold pb-1 transition-all cursor-pointer ${
              orderType === "MARKET" ? "text-zinc-200 border-b border-zinc-200" : "hover:text-zinc-400"
            }`}
          >
            MERCADO
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3.5">
          {orderType === "LIMIT" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-zinc-500 tracking-wider font-bold uppercase">PREÇO DE EXECUÇÃO (USD)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-black/60 border border-zinc-900 rounded-lg p-3 text-sm text-zinc-100 font-bold focus:outline-none focus:border-zinc-800 font-mono w-full"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 tracking-wider font-bold uppercase">QUANTIDADE DE ATIVO (BTC)</label>
            <div className="relative flex flex-col gap-2">
              <input
                type="number"
                step="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-black/60 border border-zinc-900 rounded-lg p-3 text-sm text-zinc-100 font-bold focus:outline-none focus:border-zinc-800 font-mono w-full"
              />
              
              {/* Botões de Porcentagem Rápida */}
              <div className="grid grid-cols-4 gap-1.5">
                {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                  <button
                    key={`pct-${pct}`}
                    type="button"
                    onClick={() => handlePercentClick(pct)}
                    className="py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-900 hover:border-zinc-800 text-[9px] font-bold text-zinc-400 hover:text-zinc-200 rounded transition-all font-mono cursor-pointer"
                  >
                    {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Estimativa / Custos */}
        <div className="bg-black/25 border border-zinc-900 rounded-lg p-3 flex flex-col gap-2 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>Subtotal Estimado:</span>
            <span className="text-zinc-200 font-bold">
              {estimatedSubtotal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-900/50 pt-2">
            <span>Taxa de Corretagem (0.0%):</span>
            <span className="text-emerald-500 font-bold">0.00 USD</span>
          </div>
        </div>
      </form>

      {/* Notificações de Sucesso/Erro */}
      <div className="h-10 my-2 flex items-center justify-center">
        {notification && (
          <div
            className={`w-full text-center text-xs p-2 rounded border font-bold transition-all duration-300 ${
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
        className={`w-full py-3.5 rounded-xl font-bold tracking-wider transition-all flex items-center justify-center gap-2 border shadow-lg text-xs cursor-pointer ${
          side === 0
            ? "bg-emerald-500 hover:bg-emerald-600 text-black border-emerald-400 shadow-emerald-500/10"
            : "bg-rose-500 hover:bg-rose-600 text-black border-rose-400 shadow-rose-500/10"
        }`}
      >
        <span>ENVIAR ORDEM DE {side === 0 ? "COMPRA" : "VENDA"}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
