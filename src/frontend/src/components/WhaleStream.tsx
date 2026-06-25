import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useStore, TradeEvent } from "../store/useStore";
import { GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from "./shaders/reactorShaders";

// Configurações do pool de partículas
const MAX_PARTICLES = 250;

export const WhaleStream: React.FC = () => {
  // Referências para o Grid de Shockwave
  const gridMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const shockwavesRef = useRef<{ x: number; y: number; time: number }[]>([
    { x: 0, y: 0, time: -1 },
    { x: 0, y: 0, time: -1 },
    { x: 0, y: 0, time: -1 },
  ]);

  // Referências para as Partículas
  const pointsRef = useRef<THREE.Points>(null);
  const particlesData = useRef<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    size: number;
    color: THREE.Color;
    life: number;
    maxLife: number;
  }[]>(Array.from({ length: MAX_PARTICLES }, () => ({
    pos: new THREE.Vector3(0, -999, 0),
    vel: new THREE.Vector3(0, 0, 0),
    size: 0,
    color: new THREE.Color(),
    life: 0,
    maxLife: 0,
  })));

  // Refs de controle de DOM para o Alerta de Baleia em 3D
  const whaleAlertRef = useRef<HTMLDivElement>(null);
  const whaleTextRef = useRef<HTMLSpanElement>(null);
  const whaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscrição para novos trades
  useEffect(() => {
    let lastProcessedTradeId = 0;
    let lastTrades = useStore.getState().trades;

    const unsubscribe = useStore.subscribe((state) => {
      const trades = state.trades;
      if (trades === lastTrades) return;
      lastTrades = trades;

      if (trades.length === 0) return;
      const latestTrade = trades[0];
      
      // Evita reprocessar o mesmo trade
      if (latestTrade.id === lastProcessedTradeId) return;
      lastProcessedTradeId = latestTrade.id;

      const isWhale = latestTrade.quantity > 1.5; // Grande volume

      // 1. Se for uma baleia (Whale Trade), dispara onda de choque no grid de fundo
      if (isWhale) {
        // Encontra um slot livre de shockwave (tempo expirado ou inativo)
        const slotIdx = shockwavesRef.current.findIndex((s) => s.time < 0 || s.time >= 2.5);
        if (slotIdx !== -1) {
          // Posição aleatória na grade para o impacto
          shockwavesRef.current[slotIdx] = {
            x: (Math.random() - 0.5) * 16.0,
            y: (Math.random() - 0.5) * 10.0,
            time: 0.0,
          };
        }

        // Dispara rajada massiva de partículas violetas
        triggerParticlesBurst(latestTrade, true);

        // 2. Exibe o alerta holográfico 3D flutuante do Whale Trade no topo do canvas
        if (whaleAlertRef.current && whaleTextRef.current) {
          if (whaleTimeoutRef.current) clearTimeout(whaleTimeoutRef.current);
          
          whaleTextRef.current.innerText = `WHALE_BLOCK_TRADE: ${latestTrade.quantity.toFixed(4)} BTC @ $${latestTrade.price.toLocaleString("en-US")} USD`;
          
          // Fade-in e deslizamento
          whaleAlertRef.current.style.opacity = "1";
          whaleAlertRef.current.style.transform = "translateY(0)";
          
          // Agenda o fade-out após 2.5 segundos (tempo de duração da onda física de choque)
          whaleTimeoutRef.current = setTimeout(() => {
            if (whaleAlertRef.current) {
              whaleAlertRef.current.style.opacity = "0";
              whaleAlertRef.current.style.transform = "translateY(-12px)";
            }
          }, 2500);
        }
      } else {
        // Dispara partículas padrão (verdes ou vermelhas)
        triggerParticlesBurst(latestTrade, false);
      }
    });

    return () => {
      unsubscribe();
      if (whaleTimeoutRef.current) clearTimeout(whaleTimeoutRef.current);
    };
  }, []);

  // Função auxiliar para ativar partículas inativas
  const triggerParticlesBurst = (trade: TradeEvent, isWhale: boolean) => {
    const data = particlesData.current;
    const count = isWhale ? 45 : 6; // Quantidade de partículas
    let activated = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (activated >= count) break;
      const p = data[i];
      if (p.life <= 0) {
        // Ativa partícula
        // Posição inicial: Lado direito da tela
        p.pos.set(
          8.0 + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 2.0
        );

        // Velocidade: Esquerda (-X) com variação de dispersão
        const speed = isWhale ? 4.5 + Math.random() * 5.5 : 1.8 + Math.random() * 2.2;
        p.vel.set(-speed, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.2);

        // Tamanho e Cor
        p.size = isWhale ? 0.35 + Math.random() * 0.35 : 0.08 + Math.random() * 0.14;
        
        if (isWhale) {
          p.color.setRGB(0.55, 0.05, 1.0); // Violeta elétrico
        } else if (trade.side === 0) {
          p.color.setRGB(0.01, 0.95, 0.45); // Verde compra
        } else {
          p.color.setRGB(1.0, 0.01, 0.35);  // Vermelho venda
        }

        p.maxLife = isWhale ? 2.5 + Math.random() * 1.5 : 4.0 + Math.random() * 2.0;
        p.life = p.maxLife;

        activated++;
      }
    }
  };

  useFrame((state, delta) => {
    // 1. Atualiza as ondas de choque no material do grid
    if (gridMaterialRef.current) {
      const shockPositions: THREE.Vector2[] = [];
      const shockTimes: number[] = [];

      for (let i = 0; i < 3; i++) {
        const s = shockwavesRef.current[i];
        if (s.time >= 0) {
          s.time += delta;
        }
        shockPositions.push(new THREE.Vector2(s.x, s.y));
        shockTimes.push(s.time);
      }

      gridMaterialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      gridMaterialRef.current.uniforms.uShockwaves.value = shockPositions;
      gridMaterialRef.current.uniforms.uShockwaveTimes.value = shockTimes;
    }

    // 2. Atualiza a simulação das partículas
    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry;
      const positions = geometry.attributes.position.array as Float32Array;
      const colors = geometry.attributes.color.array as Float32Array;
      const sizes = geometry.attributes.size.array as Float32Array;

      const data = particlesData.current;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = data[i];
        const idx = i * 3;

        if (p.life > 0) {
          p.pos.addScaledVector(p.vel, delta);
          p.life -= delta;

          positions[idx] = p.pos.x;
          positions[idx + 1] = p.pos.y;
          positions[idx + 2] = p.pos.z;

          const alpha = p.life / p.maxLife;
          colors[idx] = p.color.r * alpha;
          colors[idx + 1] = p.color.g * alpha;
          colors[idx + 2] = p.color.b * alpha;

          sizes[i] = p.size * (0.3 + alpha * 0.7);
        } else {
          p.pos.set(0, -999, 0);
          positions[idx] = 0;
          positions[idx + 1] = -999;
          positions[idx + 2] = 0;
          sizes[i] = 0;
        }
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
    }
  });

  const gridUniforms = useRef({
    uTime: { value: 0 },
    uShockwaves: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
    uShockwaveTimes: { value: [-1, -1, -1] },
  });

  const initialPositions = useRef(new Float32Array(MAX_PARTICLES * 3));
  const initialColors = useRef(new Float32Array(MAX_PARTICLES * 3));
  const initialSizes = useRef(new Float32Array(MAX_PARTICLES));

  return (
    <group>
      {/* 1. Grade Deformável Tridimensional de Fundo (Shockwave Grid) */}
      <mesh position={[0, 0, -2]} rotation={[0, 0, 0]}>
        <planeGeometry args={[24, 15, 60, 40]} />
        <shaderMaterial
          ref={gridMaterialRef}
          vertexShader={GRID_VERTEX_SHADER}
          fragmentShader={GRID_FRAGMENT_SHADER}
          uniforms={gridUniforms.current}
          transparent={true}
          wireframe={true}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Sistema de Partículas Lateral Otimizado (Whale Stream) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[initialPositions.current, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[initialColors.current, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[initialSizes.current, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexColors={true}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={PARTICLE_VERTEX_SHADER}
          fragmentShader={PARTICLE_FRAGMENT_SHADER}
        />
      </points>

      {/* 3. Alerta Holográfico Flutuante 3D de Transações Massivas (Whale Trade Alert) */}
      <Html
        position={[0, 3.2, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div
          ref={whaleAlertRef}
          style={{
            opacity: 0,
            transform: "translateY(-12px)",
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="flex items-center gap-2.5 bg-rose-950/90 border border-rose-500/65 backdrop-blur-md rounded-lg p-2.5 px-5 shadow-[0_0_30px_rgba(244,63,94,0.4)] min-w-[260px] justify-center text-center font-mono text-[9px] text-rose-400 border-t-2 border-t-rose-400"
        >
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
          <span ref={whaleTextRef} className="font-bold tracking-wider">
            WHALE_BLOCK_TRADE: 0.0000 BTC @ $0.00 USD
          </span>
        </div>
      </Html>
    </group>
  );
};
