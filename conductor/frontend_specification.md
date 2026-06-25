# Especificação Detalhada do Frontend: ApexTrade Terminal

Este documento apresenta a especificação técnica e visual ultra-detalhada do frontend do **ApexTrade**, projetado sob a metodologia **Clean Architecture** e otimizado para garantir **60 FPS constantes** no navegador, utilizando **Next.js (App Router)**, **React Three Fiber (R3F)**, **Zustand** e **Tailwind CSS**.

---

## 1. Arquitetura de Estados (Zustand State Architecture)

Para evitar gargalos de CPU decorrentes de re-renderizações em cascata no React sob uma enxurrada de dados WebSocket (snapshots L2 a cada 50ms), o gerenciamento de estado adota o padrão de **Slices** e **Subscrições Transientes**.

```
                           [ WebSocket Stream L2 / Trades ]
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │      Zustand Store Manager      │
                         └──────┬───────────────────┬──────┘
                                │                   │
             (Atualizações Reativas)             (Atualizações Transientes)
             useStore(state => ...)              useStore.subscribe(...)
                                │                   │
                                ▼                   ▼
                      ┌──────────────────┐ ┌──────────────────┐
                      │ React Components │ │  3D Canvas (R3F) │
                      │  - Wallet Balance│ │  - Reactor Core  │
                      │  - Form inputs   │ │  - Price Canopy  │
                      │  - DOM Tables    │ │  (Direct Ref)    │
                      └──────────────────┘ └──────────────────┘
```

### 1.1 Definição de Tipos e Interface da Store
A store global é dividida em fatias lógicas de domínio em `src/frontend/store/`:

```typescript
export interface PriceLevel {
  price: number;
  quantity: number;
  timestamp: number;
}

export interface TradeEvent {
  id: number;
  price: number;
  quantity: number;
  side: 0 | 1; // 0 = COMPRA (VERDE), 1 = VENDA (VERMELHO)
  timestamp: number;
}

export interface OrderBookSlice {
  bids: PriceLevel[];
  asks: PriceLevel[];
  maxVolume: number;
  updateOrderBook: (bids: PriceLevel[], asks: PriceLevel[]) => void;
}

export interface TradeHistorySlice {
  trades: TradeEvent[];
  addTrade: (trade: TradeEvent) => void;
}

export interface WalletSlice {
  usdBalance: number;
  btcBalance: number;
  updateBalances: (usd: number, btc: number) => void;
}

export interface SystemSlice {
  volatility: number; // Fator de 0.0 (calmo) a 1.0 (crítico)
  rps: number; // Carga de requisições do motor
  setSystemMetrics: (volatility: number, rps: number) => void;
}

export type StoreState = OrderBookSlice & TradeHistorySlice & WalletSlice & SystemSlice;
```

### 1.2 Otimização por Seletores Estritos
Componentes de interface de texto tradicionais assinam o estado usando seletores granulares. Isso garante que a alteração do saldo de USD, por exemplo, renderize **apenas** o painel da carteira, mantendo o restante do terminal estático.

```typescript
// Exemplo de Componente Reativo Otimizado
export const WalletPanel = () => {
  const usdBalance = useStore((state) => state.usdBalance);
  const btcBalance = useStore((state) => state.btcBalance);

  return (
    <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg backdrop-blur-md">
      <h3 className="text-zinc-400 text-xs font-mono">SALDOS DISPONÍVEIS</h3>
      <div className="mt-2 font-mono text-lg text-emerald-400">{usdBalance.toFixed(2)} USD</div>
      <div className="font-mono text-lg text-amber-500">{btcBalance.toFixed(6)} BTC</div>
    </div>
  );
};
```

### 1.3 Subscrições Transientes (Bypass do React DOM)
Para o canvas 3D (Three.js), as renderizações tradicionais do React são completamente ignoradas. O componente 3D assina as mudanças do estado diretamente na referência física do objeto tridimensional:

```typescript
// Exemplo de subscrição transiente no componente do Reactor Core 3D
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store";

export const VolatilityCoreMesh = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useEffect(() => {
    // Subscreve-se apenas à métrica de volatilidade sem disparar re-render no componente React
    const unsubscribe = useStore.subscribe(
      (state) => state.volatility,
      (volatility) => {
        if (materialRef.current) {
          // Atualiza diretamente a variável Uniform do Shader na GPU
          materialRef.current.uniforms.uVolatility.value = volatility;
        }
      }
    );
    return unsubscribe;
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[2, 64, 64]} />
      <customShaderMaterial ref={materialRef} />
    </mesh>
  );
};
```

---

## 2. O Motor Gráfico 3D (React Three Fiber & Shaders GLSL)

O Canvas 3D do terminal opera a **60 FPS** movendo o processamento geométrico e de partículas pesadas inteiramente para a GPU por meio de Shaders customizados e instância de malhas.

### 2.1 "Order Book Canopy": InstancedMesh e Mapeamento de Coordenadas
O livro de ofertas 3D renderiza até 1.000 barras individuais de preços usando **`instancedMesh`**. Cada barra de preço (*PriceLevel*) é mapeada matematicamente em coordenadas tridimensionais no espaço:

*   **Eixo X (Preço):** Mapeado linearmente em relação à distância do preço atual de mercado (spread).
    $$X_i = (Price_i - MidPrice) \times Scale_x$$
*   **Eixo Y (Volume):** Controla a altura da torre. A escala da matriz da instância é atualizada no eixo Y.
    $$Y_{scale} = \frac{Quantity_i}{MaxVolume} \times MaxHeight$$
*   **Eixo Z (Profundidade Temporal):** Representa a idade da ordem ou sua permanência.
    $$Z_i = (Timestamp_{now} - Timestamp_i) \times Scale_z$$

#### Código do Componente de Renderização do Livro 3D:
```typescript
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../../store";

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export const OrderBookCanopy3D = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;

    const { bids, asks, maxVolume } = useStore.getState();
    const totalInstances = bids.length + asks.length;
    
    let instanceId = 0;

    // Processa Compras (Bids) - Lado Esquerdo (Verde)
    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const x = (bid.price - bids[0].price) * 0.5 - 2; // Offset negativo para esquerda
      const height = (bid.quantity / maxVolume) * 5;
      
      tempObject.position.set(x, height / 2, 0);
      tempObject.scale.set(0.15, height, 0.15);
      tempObject.updateMatrix();
      
      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);
      
      // Cor neon verde brilhante com atenuação baseada na profundidade do volume
      tempColor.setHSL(0.35, 0.9, 0.3 + (bid.quantity / maxVolume) * 0.5);
      meshRef.current.setColorAt(instanceId, tempColor);
      
      instanceId++;
    }

    // Processa Vendas (Asks) - Lado Direito (Vermelho)
    for (let i = 0; i < asks.length; i++) {
      const ask = asks[i];
      const x = (ask.price - asks[0].price) * 0.5 + 2; // Offset positivo para direita
      const height = (ask.quantity / maxVolume) * 5;
      
      tempObject.position.set(x, height / 2, 0);
      tempObject.scale.set(0.15, height, 0.15);
      tempObject.updateMatrix();
      
      meshRef.current.setMatrixAt(instanceId, tempObject.matrix);
      
      // Cor neon vermelha/magenta brilhante
      tempColor.setHSL(0.95, 0.9, 0.3 + (ask.quantity / maxVolume) * 0.5);
      meshRef.current.setColorAt(instanceId, tempColor);
      
      instanceId++;
    }

    // Notifica a GPU que a matriz de instâncias e as cores mudaram
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 1000]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.1} metalness={0.8} toneMapped={false} />
    </instancedMesh>
  );
};
```

### 2.2 "The Volatility Reactor Core": Shaders Customizados (GLSL)
O núcleo central de volatilidade de plasma é implementado escrevendo códigos shader de vértice e fragmento puros, de forma que a CPU não processe a geometria tridimensional do plasma.

#### GLSL Vertex Shader (`reactor.vertex.glsl`):
```glsl
uniform float uTime;
uniform float uVolatility;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// Implementação Simples de Ruído 3D (Simplex/Classic Noise) na GPU
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  // Deformação harmônica de vértices com base na volatilidade
  float noise = snoise(position * 1.5 + uTime * 2.0) * uVolatility * 0.5;
  vec3 newPosition = position + normal * noise;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
```

#### GLSL Fragment Shader (`reactor.fragment.glsl`):
```glsl
uniform float uTime;
uniform float uVolatility;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Cálculo de efeito fresnel (brilho nas bordas da esfera)
  float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
  
  // Gradiente dinâmico de cores baseadas na volatilidade (Ciano para Roxo/Rosa)
  vec3 colorLow = vec3(0.0, 0.8, 1.0);  // Neon Ciano
  vec3 colorHigh = vec3(0.9, 0.0, 0.6); // Neon Roxo/Magenta
  
  vec3 baseColor = mix(colorLow, colorHigh, uVolatility);
  vec3 finalColor = baseColor * (fresnel + 0.2); // Intensidade de emissão
  
  // Adiciona pulsação de luz
  finalColor += vec3(0.1, 0.0, 0.1) * sin(uTime * 5.0) * uVolatility;

  gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 3. UI Layout e Bento Grid (Tailwind CSS)

A estrutura do terminal de trading organiza as informações em painéis modulares com efeito translúcido de vidro (*glassmorphism*), garantindo legibilidade do texto de dados mesmo sobrepondo a cena WebGL 3D do background.

```html
<!-- Estrutura Principal do Dashboard em Next.js -->
<div className="relative min-h-screen w-full bg-black text-zinc-50 overflow-hidden font-mono">
  
  <!-- Canvas 3D flutuando no Background -->
  <div className="absolute inset-0 z-0">
    <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <OrderBookCanopy3D />
      <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 2} />
    </Canvas>
  </div>

  <!-- Overlay UI Layout em Bento Grid (Z-Index 10) -->
  <div className="relative z-10 grid grid-cols-12 grid-rows-6 gap-4 p-4 h-screen w-full pointer-events-none">
    
    <!-- Header / Telemetria (Col 1 a 12, Row 1) -->
    <header className="col-span-12 row-span-1 bg-zinc-950/40 border border-zinc-800/50 backdrop-blur-md rounded-xl p-4 flex items-center justify-between pointer-events-auto">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
        <h1 className="text-sm font-bold tracking-wider">APEX_TRADE_v1.0.0</h1>
      </div>
      <div className="flex gap-6 text-xs text-zinc-400">
        <div>ENGINE_STATUS: <span className="text-emerald-400">ONLINE</span></div>
        <div>MATCHES: <span className="text-zinc-100 font-bold">85,420 RPS</span></div>
        <div>VOLATILITY: <span className="text-rose-400 font-bold">42%</span></div>
      </div>
    </header>

    <!-- Painel de Ordens / Formulário (Col 1 a 3, Row 2 a 6) -->
    <section className="col-span-3 row-span-5 bg-zinc-950/40 border border-zinc-800/50 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between pointer-events-auto">
      <!-- Formulário de Inputs (HTML puro com classes Tailwind) -->
      <OrderEntryForm />
    </section>

    <!-- Visualização Lateral de Carteira e Histórico (Col 9 a 12, Row 2 a 6) -->
    <section className="col-span-4 row-span-5 bg-zinc-950/40 border border-zinc-800/50 backdrop-blur-md rounded-xl p-4 flex flex-col gap-4 pointer-events-auto">
      <WalletPanel />
      <div className="flex-1 overflow-hidden">
        <h3 className="text-xs text-zinc-400 font-mono mb-2">NEGÓCIOS RECENTES</h3>
        <TradeHistoryVirtualizedList />
      </div>
    </section>
    
  </div>
</div>
```

---

## 4. Tabela Virtualizada de Histórico (Virtualização de DOM)

Para evitar re-renderizações e refluxos de layout (*reflows*) custosos ao listar milhares de negócios recebidos do WebSocket em tempo real, o histórico de trades utiliza a virtualização de DOM com **`@tanstack/react-virtual`**.

```typescript
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStore } from "../store";

export const TradeHistoryVirtualizedList = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const trades = useStore((state) => state.trades);

  const rowVirtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // Altura exata de cada linha em pixels
    overscan: 5, // Renderiza 5 itens extras fora da tela para suavizar rolagem
  });

  return (
    <div
      ref={parentRef}
      className="h-full w-full overflow-auto border border-zinc-900 rounded bg-black/30 scrollbar-none"
    >
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const trade = trades[virtualRow.index];
          return (
            <div
              key={trade.id}
              className="absolute top-0 left-0 w-full flex justify-between items-center px-3 text-xs font-mono border-b border-zinc-900/40"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <span className="text-zinc-500">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </span>
              <span className={trade.side === 0 ? "text-emerald-400" : "text-rose-500"}>
                {trade.price.toFixed(2)}
              </span>
              <span className="text-zinc-300 font-bold">
                {trade.quantity.toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 5. Integração com TradingView (Lightweight Charts)

Os gráficos de velas (*Candlestick*) históricos são renderizados sobre um Canvas 2D utilizando a biblioteca **Lightweight Charts** da TradingView. Ela permite atualizações incrementais com consumo mínimo de memória.

```typescript
import { useEffect, useRef } from "react";
import { createChart, ISeriesApi } from "lightweight-charts";
import { useStore } from "../store";

export const TradingViewChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Inicializa o gráfico 2D Canvas da TradingView
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#18181b" },
        horzLines: { color: "#18181b" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderDownColor: "#f43f5e",
      borderUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      wickUpColor: "#10b981",
    });

    candleSeriesRef.current = candleSeries;

    // Dados Iniciais do Histórico (Mockados para inicialização rápida)
    candleSeries.setData([
      { time: "2026-06-25 09:00", open: 65000, high: 65100, low: 64900, close: 65050 },
      // ...
    ]);

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    // Escuta transações em tempo real do WebSocket via Zustand e atualiza incrementalmente
    const unsubscribe = useStore.subscribe(
      (state) => state.trades[0], // Pega o último trade adicionado no topo do histórico
      (lastTrade) => {
        if (lastTrade && candleSeriesRef.current) {
          // Atualiza incrementalmente o gráfico de vela
          candleSeriesRef.current.update({
            time: Math.floor(lastTrade.timestamp / 1000) as any,
            open: lastTrade.price,
            high: lastTrade.price,
            low: lastTrade.price,
            close: lastTrade.price,
          });
        }
      }
    );
    return unsubscribe;
  }, []);

  return <div ref={chartContainerRef} className="w-full h-[300px]" />;
};
```
