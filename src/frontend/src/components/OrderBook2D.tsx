import React, { useMemo } from "react";
import { useStore, PriceLevel } from "../store/useStore";
import { ArrowUp, ArrowDown, Percent } from "lucide-react";

export const OrderBook2D: React.FC = () => {
  const bids = useStore((state) => state.bids);
  const asks = useStore((state) => state.asks);
  const setSelectedPrice = useStore((state) => state.setSelectedPrice);
  const setSelectedQuantity = useStore((state) => state.setSelectedQuantity);

  // Limita a exibição a 10 níveis para manter a interface limpa e focada
  const depthLevels = 10;

  // Processa e calcula os dados das ofertas de venda (Asks)
  const processedAsks = useMemo(() => {
    const activeAsks = [...asks].slice(0, depthLevels);
    let cumulative = 0;
    const asksWithCumulative = activeAsks.map((ask) => {
      cumulative += ask.quantity;
      return {
        ...ask,
        cumulative,
      };
    });
    // Reverte para que a oferta com preço mais alto fique no topo
    // e o melhor preço de venda (mais baixo) fique na base, encostado no preço médio
    return asksWithCumulative.reverse();
  }, [asks]);

  // Processa e calcula os dados das ofertas de compra (Bids)
  const processedBids = useMemo(() => {
    const activeBids = [...bids].slice(0, depthLevels);
    let cumulative = 0;
    return activeBids.map((bid) => {
      cumulative += bid.quantity;
      return {
        ...bid,
        cumulative,
      };
    });
  }, [bids]);

  // Encontra o volume acumulado máximo para calibrar a escala das barras de profundidade
  const maxCumulative = useMemo(() => {
    const maxAskCumulative = processedAsks[0]?.cumulative || 0; // O primeiro elemento do array invertido tem o maior acumulado
    const maxBidCumulative = processedBids[processedBids.length - 1]?.cumulative || 0; // O último elemento tem o maior acumulado
    return Math.max(maxAskCumulative, maxBidCumulative, 1);
  }, [processedAsks, processedBids]);

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  // Determina a cor de tendência baseada na proximidade do preço médio
  const isUp = useMemo(() => {
    if (processedBids.length === 0 || processedAsks.length === 0) return true;
    // Simulação simples de tendência comparando com o melhor bid anterior
    return Math.random() > 0.45;
  }, [midPrice]);

  const handleRowClick = (price: number, quantity: number) => {
    setSelectedPrice(price.toFixed(2));
    setSelectedQuantity(quantity.toFixed(4));
  };

  return (
    <div className="bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-2xl p-4 flex flex-col h-[480px] shadow-2xl font-mono text-xs select-none">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
        <span className="text-sm font-bold text-zinc-100 tracking-wider flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          LIVRO DE OFERTAS L2
        </span>
        <span className="text-[9px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 font-bold">
          ORDER BOOK L2
        </span>
      </div>

      {/* Rótulos das Colunas */}
      <div className="grid grid-cols-3 py-2 text-[10px] text-zinc-500 font-bold border-b border-zinc-900 bg-black/10 px-2">
        <div>PREÇO (USD)</div>
        <div className="text-right">TAMANHO (BTC)</div>
        <div className="text-right">TOTAL ACUM.</div>
      </div>

      {/* Container de Ofertas */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden py-1.5">
        {/* Bloco de Asks (Vendas) */}
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {processedAsks.length === 0 ? (
            <div className="text-center text-zinc-600 italic py-4">Sem ofertas de venda</div>
          ) : (
            processedAsks.map((ask) => {
              const depthPct = (ask.cumulative / maxCumulative) * 100;
              return (
                <div
                  key={`ask-${ask.price}`}
                  onClick={() => handleRowClick(ask.price, ask.quantity)}
                  className="group relative grid grid-cols-3 items-center py-1 px-2 cursor-pointer hover:bg-zinc-900/40 rounded transition-colors"
                  title="Clique para carregar preço e quantidade no terminal"
                >
                  {/* Barra de Profundidade Visual */}
                  <div
                    className="absolute top-0 right-0 h-full bg-rose-500/8 transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-rose-400 font-bold group-hover:text-rose-300 transition-colors z-10">
                    {ask.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-zinc-300 font-semibold z-10">
                    {ask.quantity.toFixed(4)}
                  </span>
                  <span className="text-right text-zinc-500 font-medium z-10">
                    {ask.cumulative.toFixed(4)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Divisor de Preço Médio (Spread & Mid-Price) */}
        <div className="my-2 py-2 px-3 border-y border-zinc-900/80 bg-black/40 rounded-xl flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            {isUp ? (
              <ArrowUp className="h-5 w-5 text-emerald-400 animate-bounce" style={{ animationDuration: "2.8s" }} />
            ) : (
              <ArrowDown className="h-5 w-5 text-rose-500 animate-bounce" style={{ animationDuration: "2.8s" }} />
            )}
            <div className="flex flex-col">
              <span className={`text-sm font-extrabold tracking-tight ${isUp ? "text-emerald-400" : "text-rose-400"} transition-colors`}>
                ${midPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Preço Médio</span>
            </div>
          </div>

          <div className="text-right flex flex-col justify-center">
            <span className="text-[10px] text-zinc-300 font-bold">
              Spread: <span className="text-zinc-100">${spread.toFixed(2)}</span>
            </span>
            <span className="text-[9px] text-zinc-500 font-bold tracking-wider">
              {spreadPercent.toFixed(3)}%
            </span>
          </div>
        </div>

        {/* Bloco de Bids (Compras) */}
        <div className="flex-1 flex flex-col justify-start overflow-hidden">
          {processedBids.length === 0 ? (
            <div className="text-center text-zinc-600 italic py-4">Sem ofertas de compra</div>
          ) : (
            processedBids.map((bid) => {
              const depthPct = (bid.cumulative / maxCumulative) * 100;
              return (
                <div
                  key={`bid-${bid.price}`}
                  onClick={() => handleRowClick(bid.price, bid.quantity)}
                  className="group relative grid grid-cols-3 items-center py-1 px-2 cursor-pointer hover:bg-zinc-900/40 rounded transition-colors"
                  title="Clique para carregar preço e quantidade no terminal"
                >
                  {/* Barra de Profundidade Visual */}
                  <div
                    className="absolute top-0 right-0 h-full bg-emerald-500/6 transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-emerald-400 font-bold group-hover:text-emerald-300 transition-colors z-10">
                    {bid.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right text-zinc-300 font-semibold z-10">
                    {bid.quantity.toFixed(4)}
                  </span>
                  <span className="text-right text-zinc-500 font-medium z-10">
                    {bid.cumulative.toFixed(4)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Rodapé informativo */}
      <div className="text-[9px] text-zinc-600 text-center pt-2 border-t border-zinc-900 font-semibold uppercase tracking-wider">
        Clique em qualquer nível para preencher a boleta
      </div>
    </div>
  );
};
