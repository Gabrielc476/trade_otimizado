import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStore } from "../store/useStore";

export const TradeHistoryList: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const trades = useStore((state) => state.trades);

  // Virtualização do DOM para manter a renderização a 60 FPS consistentes
  const rowVirtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // Altura exata de cada linha em pixels
    overscan: 5,            // Itens adicionais renderizados fora da janela para suavizar rolagem
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Cabeçalho da Tabela */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-mono text-zinc-500 border-b border-zinc-900 bg-black/30 tracking-wider">
        <div>HORÁRIO</div>
        <div className="text-right">PREÇO (USD)</div>
        <div className="text-right">VOLUME (BTC)</div>
      </div>

      {/* Lista Virtualizada */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden border border-zinc-900/50 rounded bg-black/15 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-transparent"
      >
        {trades.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] font-mono">
            AGUARDANDO NEGÓCIOS...
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const trade = trades[virtualRow.index];
              if (!trade) return null;

              return (
                <div
                  key={trade.id}
                  className="absolute top-0 left-0 w-full grid grid-cols-3 items-center px-3 text-[10px] font-mono border-b border-zinc-900/30 hover:bg-zinc-900/10 transition-colors"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="text-zinc-500">
                    {new Date(trade.timestamp).toLocaleTimeString(undefined, {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  
                  <span
                    className={`text-right font-bold ${
                      trade.side === 0 ? "text-emerald-400" : "text-rose-500"
                    }`}
                  >
                    {trade.price.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>

                  <span className="text-right text-zinc-300 font-bold">
                    {trade.quantity.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
