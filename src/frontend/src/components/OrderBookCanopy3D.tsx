import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";

// Objetos temporários reutilizados para evitar alocação de lixo (GC) no loop crítico a 60 FPS
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export const OrderBookCanopy3D: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;

    const { bids, asks, maxVolume } = useStore.getState();
    const totalBids = bids.length;
    const totalAsks = asks.length;
    const totalRendered = totalBids + totalAsks;

    let instanceId = 0;

    // 1. Renderiza Ofertas de Compra (Bids) - Esquerda, Tons Verdes/Ciano
    for (let i = 0; i < totalBids; i++) {
      if (instanceId >= 1000) break;

      const bid = bids[i];
      // Mapeamento X: Preço relativo ao spread central (bids[0].price). Afasta-se para a esquerda.
      const spreadOffset = bids[0] ? (bid.price - bids[0].price) * 0.12 : 0;
      const x = -1.5 + spreadOffset - 0.2; // Offset inicial à esquerda do centro
      
      // Mapeamento Y (Altura): Proporcional ao volume da oferta
      const height = (bid.quantity / (maxVolume || 1.0)) * 4.0 + 0.1;
      
      // Z: Mapeia o envelhecimento/profundidade (tempo de vida da oferta na fila)
      const z = -(i * 0.25);

      tempObject.position.set(x, height / 2.0 - 1.5, z);
      tempObject.scale.set(0.12, height, 0.12);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);

      // Cor: Neon verde vibrante atenuado pelo volume
      const intensity = 0.3 + (bid.quantity / (maxVolume || 1.0)) * 0.7;
      tempColor.setRGB(0.02 * intensity, 0.9 * intensity, 0.5 * intensity); // Verde neon
      meshRef.current.setColorAt(instanceId, tempColor);

      instanceId++;
    }

    // 2. Renderiza Ofertas de Venda (Asks) - Direita, Tons Vermelhos/Magenta
    for (let i = 0; i < totalAsks; i++) {
      if (instanceId >= 1000) break;

      const ask = asks[i];
      // Mapeamento X: Preço relativo ao spread central (asks[0].price). Afasta-se para a direita.
      const spreadOffset = asks[0] ? (ask.price - asks[0].price) * 0.12 : 0;
      const x = 1.5 + spreadOffset + 0.2; // Offset inicial à direita do centro
      
      const height = (ask.quantity / (maxVolume || 1.0)) * 4.0 + 0.1;
      const z = -(i * 0.25);

      tempObject.position.set(x, height / 2.0 - 1.5, z);
      tempObject.scale.set(0.12, height, 0.12);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);

      // Cor: Neon vermelho/magenta vibrante
      const intensity = 0.3 + (ask.quantity / (maxVolume || 1.0)) * 0.7;
      tempColor.setRGB(1.0 * intensity, 0.02 * intensity, 0.38 * intensity); // Magenta neon
      meshRef.current.setColorAt(instanceId, tempColor);

      instanceId++;
    }

    // 3. Reseta a escala de todas as instâncias restantes não utilizadas
    for (let i = instanceId; i < 1000; i++) {
      tempObject.position.set(0, -999, 0); // Joga para longe da tela
      tempObject.scale.set(0, 0, 0);       // Escala zero
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }

    // Notifica a GPU de que as matrizes de instâncias e cores foram atualizadas neste frame
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]}>
      <boxGeometry args={[1, 1, 1]} />
      {/* Material auto-iluminado neon para visual futurista cyberpunk */}
      <meshBasicMaterial
        toneMapped={false}
      />
    </instancedMesh>
  );
};
