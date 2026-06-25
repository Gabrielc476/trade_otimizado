import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OrderBookCanopy3D } from "./OrderBookCanopy3D";
import { VolatilityReactor } from "./VolatilityReactor";
import { WhaleStream } from "./WhaleStream";

export const MainCanvas3D: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-auto">
      <Canvas
        camera={{ position: [0, 2, 7.5], fov: 55, near: 0.1, far: 50 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
        }}
      >
        {/* Fundo preto da cena */}
        <color attach="background" args={["#030303"]} />

        {/* Efeito sutil de névoa escura para sumir com barras distantes */}
        <fog attach="fog" args={["#030303", 5, 20]} />

        {/* Iluminação da Cena */}
        <ambientLight intensity={0.15} />
        
        {/* Luz direcional que projeta brilhos especulares metálicos */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          color="#ffffff"
          castShadow
        />
        <directionalLight
          position={[-5, 5, -5]}
          intensity={0.4}
          color="#00ccff"
        />

        {/* Elementos Gráficos 3D Core */}
        <OrderBookCanopy3D />
        <VolatilityReactor />
        <WhaleStream />

        {/* Controles de Câmera */}
        <OrbitControls
          enableDamping={true}
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2} // Impede de passar para debaixo do chão
          minDistance={3.5}            // Impede aproximação excessiva do reator
          maxDistance={15}            // Limita o afastamento máximo da cena
        />
      </Canvas>
    </div>
  );
};
