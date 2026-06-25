import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { REACTOR_VERTEX_SHADER, REACTOR_FRAGMENT_SHADER } from "./shaders/reactorShaders";

export const VolatilityReactor: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  // Refs de controle de DOM para atualização direta ultraveloz (zero-render no React)
  const statusTextRef = useRef<HTMLSpanElement>(null);
  const voltReadoutRef = useRef<HTMLSpanElement>(null);
  const rpsReadoutRef = useRef<HTMLSpanElement>(null);
  const borderIndicatorRef = useRef<HTMLDivElement>(null);

  // Referência local para guardar o valor de volatilidade sem causar re-render no React
  const volatilityRef = useRef<number>(0.15);

  useEffect(() => {
    // Subscrição transiente ao Zustand (bypass no React DOM e no Three.js)
    const unsubscribe = useStore.subscribe((state) => {
      volatilityRef.current = state.volatility;

      // 1. Atualiza as informações do HUD tridimensional diretamente via DOM Refs
      if (statusTextRef.current) {
        let text = "STABLE";
        let colorClass = "text-cyan-400";
        if (state.volatility > 0.65) {
          text = "CRITICAL PANIC";
          colorClass = "text-rose-500 animate-pulse";
        } else if (state.volatility > 0.35) {
          text = "VOLATILE FLOW";
          colorClass = "text-violet-400";
        }
        statusTextRef.current.innerText = text;
        statusTextRef.current.className = `font-bold ${colorClass}`;
      }

      if (voltReadoutRef.current) {
        voltReadoutRef.current.innerText = `${(state.volatility * 100).toFixed(1)}%`;
      }

      if (rpsReadoutRef.current) {
        rpsReadoutRef.current.innerText = `${state.rps.toLocaleString("en-US")} RPS`;
      }

      // 2. Muda a cor de borda do HUD com base na criticidade
      if (borderIndicatorRef.current) {
        let borderColorClass = "border-t-cyan-500/80";
        if (state.volatility > 0.65) {
          borderColorClass = "border-t-rose-500/90";
        } else if (state.volatility > 0.35) {
          borderColorClass = "border-t-violet-500/80";
        }
        borderIndicatorRef.current.className = `flex flex-col items-center bg-black/85 border border-zinc-800/60 backdrop-blur-md rounded-lg p-2.5 px-3.5 shadow-2xl min-w-[170px] font-mono text-[9px] text-zinc-400 gap-1.5 border-t-2 ${borderColorClass}`;
      }
    });

    // Carrega valores iniciais
    const initialState = useStore.getState();
    if (voltReadoutRef.current) voltReadoutRef.current.innerText = `${(initialState.volatility * 100).toFixed(1)}%`;
    if (rpsReadoutRef.current) rpsReadoutRef.current.innerText = `${initialState.rps.toLocaleString("en-US")} RPS`;

    return () => unsubscribe();
  }, []);

  useFrame((state) => {
    const { clock } = state;
    const speed = 0.1 + volatilityRef.current * 0.4;
    const time = clock.getElapsedTime();

    if (materialRef.current) {
      // Passa os valores de tempo e volatilidade diretamente para a GPU
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uVolatility.value = volatilityRef.current;
    }

    if (meshRef.current) {
      // Rotação sutil da esfera de plasma para dar profundidade espacial
      meshRef.current.rotation.y += 0.003 * speed;
      meshRef.current.rotation.x += 0.001 * speed;
    }

    if (outerRef.current) {
      // Rotação contrária do escudo de contenção externo para efeito de paralaxe
      outerRef.current.rotation.y -= 0.005 * speed;
      outerRef.current.rotation.z += 0.002 * speed;
    }
  });

  // Definição dos uniforms que serão passados para o shader GLSL
  const uniforms = useRef({
    uTime: { value: 0 },
    uVolatility: { value: 0.15 },
  });

  // Escolhe a cor do escudo baseado na volatilidade
  const outerColor = volatilityRef.current > 0.55 ? "#ff0055" : "#00ccff";

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Esfera de plasma interna (Core) */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[1.5, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={REACTOR_VERTEX_SHADER}
          fragmentShader={REACTOR_FRAGMENT_SHADER}
          uniforms={uniforms.current}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2. Escudo de contenção holográfico externo (Icosaedro em Wireframe) */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.72, 2]} />
        <meshBasicMaterial
          color={outerColor}
          wireframe={true}
          transparent={true}
          opacity={0.16 + volatilityRef.current * 0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Painel de Diagnóstico Holográfico em 3D (HUD) */}
      <Html
        position={[0, -2.3, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div
          ref={borderIndicatorRef}
          className="flex flex-col items-center bg-black/85 border border-zinc-800/60 backdrop-blur-md rounded-lg p-2.5 px-3.5 shadow-2xl min-w-[170px] font-mono text-[9px] text-zinc-400 gap-1.5 border-t-2 border-t-cyan-500/80"
        >
          <div className="flex justify-between w-full border-b border-zinc-900/50 pb-1 text-zinc-500 font-bold tracking-wider">
            <span>DIAGNOSTIC_CORE_HUD</span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          </div>
          <div className="flex justify-between w-full gap-4">
            <span>SYSTEM_METRIC:</span>
            <span ref={statusTextRef} className="font-bold text-cyan-400">STABLE</span>
          </div>
          <div className="flex justify-between w-full">
            <span>VOLATILITY_IDX:</span>
            <span ref={voltReadoutRef} className="font-bold text-zinc-200">15.0%</span>
          </div>
          <div className="flex justify-between w-full">
            <span>MATCH_THROUGHPUT:</span>
            <span ref={rpsReadoutRef} className="font-bold text-zinc-200">75,240 RPS</span>
          </div>
        </div>
      </Html>

      {/* Brilho externo sutil de apoio (PointLight dinâmico) */}
      <pointLight
        position={[0, 0, 0]}
        intensity={2.0 + volatilityRef.current * 8.0}
        distance={6}
        color={volatilityRef.current > 0.5 ? "#ff007f" : "#00ccff"}
      />
    </group>
  );
};
