import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useStore } from "../store/useStore";

// Objetos temporários reutilizados para evitar alocação de lixo (GC) no loop crítico a 60 FPS
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export const OrderBookCanopy3D: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Refs de controle DOM para atualização direta do HUD tridimensional (zero React re-renders)
  const midPriceRef = useRef<HTMLSpanElement>(null);
  const spreadRef = useRef<HTMLSpanElement>(null);
  const totalBidsVolumeRef = useRef<HTMLSpanElement>(null);
  const totalAsksVolumeRef = useRef<HTMLSpanElement>(null);
  const bestBidPriceRef = useRef<HTMLSpanElement>(null);
  const bestAskPriceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Inscreve-se nas mudanças do livro para atualizar as etiquetas do HUD 3D de forma transiente
    const unsubscribe = useStore.subscribe((state) => {
      const { bids, asks } = state;
      if (bids.length === 0 || asks.length === 0) return;

      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      const midPrice = (bestBid + bestAsk) / 2.0;
      const spreadValue = bestAsk - bestBid;

      // 1. Calcula os volumes totais das ofertas visíveis no livro
      let bidsVol = 0;
      for (let i = 0; i < bids.length; i++) bidsVol += bids[i].quantity;
      let asksVol = 0;
      for (let i = 0; i < asks.length; i++) asksVol += asks[i].quantity;

      // 2. Escreve diretamente no DOM dos elementos HUD em 3D
      if (midPriceRef.current) {
        midPriceRef.current.innerText = `$${midPrice.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
      if (spreadRef.current) {
        spreadRef.current.innerText = `SPREAD: $${spreadValue.toFixed(2)}`;
      }
      if (totalBidsVolumeRef.current) {
        totalBidsVolumeRef.current.innerText = `${bidsVol.toFixed(2)} BTC`;
      }
      if (totalAsksVolumeRef.current) {
        totalAsksVolumeRef.current.innerText = `${asksVol.toFixed(2)} BTC`;
      }
      if (bestBidPriceRef.current) {
        bestBidPriceRef.current.innerText = `$${bestBid.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`;
      }
      if (bestAskPriceRef.current) {
        bestAskPriceRef.current.innerText = `$${bestAsk.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`;
      }
    });

    return () => unsubscribe();
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;

    const { bids, asks, maxVolume } = useStore.getState();
    const totalBids = bids.length;
    const totalAsks = asks.length;

    let instanceId = 0;

    // 1. Renderiza Ofertas de Compra (Bids) - Esquerda, Tons Verdes/Ciano
    for (let i = 0; i < totalBids; i++) {
      if (instanceId >= 1000) break;

      const bid = bids[i];
      const spreadOffset = bids[0] ? (bid.price - bids[0].price) * 0.12 : 0;
      const x = -1.5 + spreadOffset - 0.25;
      const height = (bid.quantity / (maxVolume || 1.0)) * 4.0 + 0.1;
      const z = -(i * 0.25);

      tempObject.position.set(x, height / 2.0 - 1.5, z);
      tempObject.scale.set(0.12, height, 0.12);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);

      // Cor auto-iluminada: Verde neon atenuado pelo volume
      const intensity = 0.35 + (bid.quantity / (maxVolume || 1.0)) * 0.65;
      tempColor.setRGB(0.01 * intensity, 0.95 * intensity, 0.45 * intensity);
      meshRef.current.setColorAt(instanceId, tempColor);

      instanceId++;
    }

    // 2. Renderiza Ofertas de Venda (Asks) - Direita, Tons Vermelhos/Magenta
    for (let i = 0; i < totalAsks; i++) {
      if (instanceId >= 1000) break;

      const ask = asks[i];
      const spreadOffset = asks[0] ? (ask.price - asks[0].price) * 0.12 : 0;
      const x = 1.5 + spreadOffset + 0.25;
      const height = (ask.quantity / (maxVolume || 1.0)) * 4.0 + 0.1;
      const z = -(i * 0.25);

      tempObject.position.set(x, height / 2.0 - 1.5, z);
      tempObject.scale.set(0.12, height, 0.12);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);

      // Cor auto-iluminada: Magenta neon
      const intensity = 0.35 + (ask.quantity / (maxVolume || 1.0)) * 0.65;
      tempColor.setRGB(1.0 * intensity, 0.01 * intensity, 0.35 * intensity);
      meshRef.current.setColorAt(instanceId, tempColor);

      instanceId++;
    }

    // 3. Reseta a escala de todas as instâncias restantes não utilizadas
    for (let i = instanceId; i < 1000; i++) {
      tempObject.position.set(0, -999, 0);
      tempObject.scale.set(0, 0, 0);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* O Livro de Ofertas Tridimensional Instanciado */}
      <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* ==========================================
          PAINEIS DE LEITURA HOLOGRÁFICA (HUD 3D)
          ========================================== */}

      {/* 1. SPREAD / PREÇO MÉDIO (HUD Central) */}
      <Html
        position={[0, 0.7, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div className="flex flex-col items-center bg-black/85 border border-zinc-850 rounded p-1.5 px-3.5 font-mono text-[8px] text-zinc-400 border-l-2 border-l-amber-500 shadow-2xl min-w-[130px]">
          <span className="text-zinc-500 font-bold tracking-wider">MID_PRICE_SPREAD</span>
          <span ref={midPriceRef} className="text-amber-400 font-bold text-[10px] mt-0.5">
            $65,000.00
          </span>
          <span ref={spreadRef} className="text-[7px] text-zinc-500 mt-0.5">
            SPREAD: $0.00
          </span>
        </div>
      </Html>

      {/* 2. PROFUNDIDADE DE COMPRA (HUD Esquerdo) */}
      <Html
        position={[-3.6, 0.5, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div className="flex flex-col items-start bg-black/85 border border-zinc-850 rounded p-2 px-3 font-mono text-[8px] text-zinc-400 border-l-2 border-l-emerald-500 shadow-2xl min-w-[125px]">
          <span className="text-emerald-400 font-bold tracking-wider text-[9px] mb-1">
            BIDS_CANOPY
          </span>
          <div className="flex justify-between w-full gap-2">
            <span className="text-zinc-500">BEST_BID:</span>
            <span ref={bestBidPriceRef} className="text-zinc-200 font-bold">
              $64,990.00
            </span>
          </div>
          <div className="flex justify-between w-full gap-2">
            <span className="text-zinc-500">DEPTH_VOL:</span>
            <span ref={totalBidsVolumeRef} className="text-emerald-400 font-bold">
              0.00 BTC
            </span>
          </div>
        </div>
      </Html>

      {/* 3. PROFUNDIDADE DE VENDA (HUD Direito) */}
      <Html
        position={[3.6, 0.5, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div className="flex flex-col items-start bg-black/85 border border-zinc-850 rounded p-2 px-3 font-mono text-[8px] text-zinc-400 border-l-2 border-l-rose-500 shadow-2xl min-w-[125px]">
          <span className="text-rose-400 font-bold tracking-wider text-[9px] mb-1">
            ASKS_CANOPY
          </span>
          <div className="flex justify-between w-full gap-2">
            <span className="text-zinc-500">BEST_ASK:</span>
            <span ref={bestAskPriceRef} className="text-zinc-200 font-bold">
              $65,010.00
            </span>
          </div>
          <div className="flex justify-between w-full gap-2">
            <span className="text-zinc-500">DEPTH_VOL:</span>
            <span ref={totalAsksVolumeRef} className="text-rose-400 font-bold">
              0.00 BTC
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
};
