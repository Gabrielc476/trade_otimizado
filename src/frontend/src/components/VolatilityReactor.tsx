import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import { REACTOR_VERTEX_SHADER, REACTOR_FRAGMENT_SHADER } from "./shaders/reactorShaders";

export const VolatilityReactor: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  // Referência local para guardar o valor de volatilidade sem causar re-render no React
  const volatilityRef = useRef<number>(0.15);

  useEffect(() => {
    // Subscrição transiente ao Zustand (bypass no React DOM)
    const unsubscribe = useStore.subscribe((state) => {
      volatilityRef.current = state.volatility;
    });
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
