import React from "react";
import { useStore } from "../store/useStore";
import { Wallet, Coins } from "lucide-react";

export const WalletPanel: React.FC = () => {
  const usdBalance = useStore((state) => state.usdBalance);
  const btcBalance = useStore((state) => state.btcBalance);

  return (
    <div className="bg-zinc-950/40 border border-zinc-800/40 backdrop-blur-md rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-mono tracking-wider">
        <Wallet className="h-3.5 w-3.5 text-zinc-500" />
        <span>SALDOS DISPONÍVEIS (CARTEIRA)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 font-mono">
        <div className="bg-black/40 border border-zinc-900/50 rounded-lg p-3">
          <div className="text-[9px] text-zinc-500 mb-1">FIAT BALANCE</div>
          <div className="text-sm font-bold text-emerald-400">
            {usdBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-[10px] text-zinc-400">USD</span>
          </div>
        </div>

        <div className="bg-black/40 border border-zinc-900/50 rounded-lg p-3">
          <div className="text-[9px] text-zinc-500 mb-1">CRYPTO ASSET</div>
          <div className="text-sm font-bold text-amber-500 flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-500/80 inline" />
            <span>
              {btcBalance.toFixed(6)}{" "}
              <span className="text-[10px] text-zinc-400">BTC</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
