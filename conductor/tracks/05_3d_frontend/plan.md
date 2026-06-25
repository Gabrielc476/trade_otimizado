# Track 5: O Motor WebGL/WebGPU 3D (Next.js / R3F / Shaders)

## Goal
Construir a interface do terminal de trading Next.js integrando elementos 3D imersivos de alta performance (Order Book Canopy, Volatility Reactor Core e Whale Stream) renderizados diretamente na GPU via React Three Fiber (R3F) e custom shaders em GLSL.

## Skills a Serem Utilizadas
*   `react-patterns`: Estruturação de componentes no Next.js (App Router), hooks customizados de performance e controle de ciclo de vida.
*   `threejs-skills` (sub-skills do plugin como `threejs-fundamentals` e `threejs-shaders`): Modelagem tridimensional de malhas, controle de matrizes em lote via `InstancedMesh` e desenvolvimento de shaders de vértices/fragmentos em GLSL.
*   `typescript-expert`: Tipagem correta de referências do Three.js e controle de memória (descarte de texturas e geometrias inativas).

## Tasks
*   [ ] **Task 1:** Configurar a estrutura do projeto Next.js no workspace com suporte ao Tailwind CSS e inicializar o Canvas de renderização do **React Three Fiber**.
    *   *Verificar:* Canvas 3D renderizando um objeto básico na tela com controles de órbita fluídos e sem vazamentos de render.
*   [ ] **Task 2:** Desenvolver o componente **Order Book Canopy** utilizando a classe **`InstancedMesh`** do R3F.
    *   *Verificar:* Renderização de 1.000 barras tridimensionais representando o livro de ofertas em **uma única draw call** na GPU. Otimização comprovada pelo inspetor do Three.js.
*   [ ] **Task 3:** Criar o **Volatility Reactor Core** (esfera de plasma em 3D) no centro do terminal utilizando um **Vertex Shader** customizado em GLSL de ruído 3D (Perlin Noise) para deformar a malha na GPU.
    *   *Verificar:* Esfera animando de forma orgânica e deformando sua geometria dinamicamente a 60 FPS estáveis.
*   [ ] **Task 4:** Implementar o **Fragment Shader** do Reactor Core para gerar o plasma de cores energéticas neon, mapeando-o para transicionar do azul/ciano (calmo) para o roxo/violeta elétrico de acordo com uma variável global de volatilidade do mercado.
    *   *Verificar:* Alterações na variável de volatilidade causam mutação suave de cor e velocidade do plasma em tempo de execução sem re-renderizar o componente React.
*   [ ] **Task 5:** Implementar o **Whale Stream** (canal lateral de partículas em 3D) e o shader de deformação da grade de fundo que reage com ondas físicas de choque ao receber a notificação de transações massivas ("whale trades").
    *   *Verificar:* Simulação de partículas operando de forma independente e estável a 60 FPS durante a recepção de eventos de trades.
*   [ ] **Task 6:** Otimizar a integração do Zustand: componentes R3F subscrevem-se ao Zustand de forma transiente (via refs e `useStore.getState()`), manipulando diretamente as propriedades dos objetos 3D no loop `useFrame` do R3F.
    *   *Verificar:* Atualizações de dados em alta frequência no WebSocket alimentam a cena 3D com **zero re-renderizações** no React DOM, mantendo CPU livre.

## Done When
*   *   [ ] Interface de trading híbrida (HTML/Tailwind semi-transparente sobre o canvas 3D) renderiza estável a **60 FPS constantes** em testes locais no Google Chrome.
*   [ ] O terminal 3D utiliza **menos de 3 chamadas de desenho (draw calls)** para renderizar todo o Order Book e o fluxo de partículas.
*   [ ] Garantia de limpeza absoluta de memória: trocar de tela ou destruir a aba remove 100% das texturas e instâncias da GPU sem gerar vazamento de memória (Memory Leaks).
