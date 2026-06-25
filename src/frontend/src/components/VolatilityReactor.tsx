import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import { REACTOR_VERTEX_SHADER, REACTOR_FRAGMENT_SHADER } from "./shaders/reactorShaders";

export const VolatilityReactor: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

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
    if (materialRef.current) {
      // Passa os valores de tempo e volatilidade diretamente para a GPU
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      materialRef.current.uniforms.uVolatility.value = volatilityRef.current;
    }

    if (meshRef.current) {
      // Rotação sutil da esfera de plasma para dar profundidade espacial
      const speed = 0.1 + volatilityRef.current * 0.4;
      meshRef.current.rotation.y += 0.003 * speed;
      meshRef.current.rotation.x += 0.001 * speed;
    }
  });

  // Definição dos uniforms que serão passados para o shader GLSL
  const uniforms = useRef({
    uTime: { value: 0 },
    uVolatility: { value: 0.15 },
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Esfera de plasma interna */}
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
