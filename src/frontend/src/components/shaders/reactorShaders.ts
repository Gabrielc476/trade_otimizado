// Shaders GLSL embutidos em strings TypeScript para evitar configurações complexas de bundlers.

export const REACTOR_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uVolatility;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  // Algoritmo Simplex Noise 3D clássico na GPU
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

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

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

    // Deformação harmônica baseada na volatilidade do mercado
    // uVolatility escalona a força da deformação e a velocidade
    float speed = 1.0 + uVolatility * 3.0;
    float noise = snoise(position * 2.0 + uTime * speed) * uVolatility * 0.45;
    vec3 newPosition = position + normal * noise;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

export const REACTOR_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uVolatility;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Efeito Fresnel: Brilho forte nas bordas da esfera de plasma
    vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0)); // Direção simplificada da câmera
    float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.5);

    // Paleta de cores baseada em HSL e tons neon:
    // Ciano / Azul Elétrico (baixa volatilidade) -> Roxo / Magenta (alta volatilidade)
    vec3 colorLow = vec3(0.0, 0.8, 1.0);   // Neon Cyan (#00ccff)
    vec3 colorHigh = vec3(0.9, 0.0, 0.55); // Neon Magenta/Pink (#e6008c)

    // Mistura de cor baseada no fator de volatilidade
    vec3 baseColor = mix(colorLow, colorHigh, uVolatility);

    // Efeito de pulsação interna do reator
    float pulse = sin(uTime * (3.0 + uVolatility * 6.0)) * 0.12 * uVolatility;
    
    // Combina brilho do Fresnel, cor base e pulsação
    vec3 finalColor = baseColor * (fresnel * 1.5 + 0.25 + pulse);

    // Adiciona brilho extra de calor branco-azulado no centro quando a volatilidade estiver no máximo
    if (uVolatility > 0.6) {
      float centerGlow = pow(max(dot(vNormal, viewDirection), 0.0), 6.0);
      finalColor += vec3(0.8, 0.9, 1.0) * centerGlow * (uVolatility - 0.5) * 0.8;
    }

    gl_FragColor = vec4(finalColor, 0.9);
  }
`;

export const GRID_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uShockwaves[3];       // Posições X e Y dos impactos das baleias
  uniform float uShockwaveTimes[3];  // Tempo decorrido de cada impacto
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 newPosition = position;
    float elevation = 0.0;

    // Processa até 3 ondas de choque simultâneas
    for (int i = 0; i < 3; i++) {
      float t = uShockwaveTimes[i];
      if (t > 0.0 && t < 2.5) {
        // Distância do vértice ao ponto do choque
        float dist = distance(position.xy, uShockwaves[i]);
        
        // Onda se propaga em formato de anel físico
        float waveSpeed = 8.0;
        float waveRadius = t * waveSpeed;
        float width = 1.5;
        
        // Intensidade decai com o tempo e com a distância
        float amplitude = 0.8 / (1.0 + t * 2.0);
        
        // Senóide que cria a crista e o vale da onda
        float wave = sin((dist - waveRadius) * 4.0) * amplitude;
        
        // Limita a onda à vizinhança do raio de propagação (envelope)
        float envelope = exp(-pow(dist - waveRadius, 2.0) / (2.0 * width * width));
        
        elevation += wave * envelope;
      }
    }

    // Deforma a grade verticalmente (eixo Z na geometria plana)
    newPosition.z += elevation;
    vElevation = elevation;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

export const GRID_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Cor base do grid brutalista (grafite escuro)
    vec3 gridColor = vec3(0.12, 0.12, 0.15);

    // Se o vértice estiver elevado por uma onda de choque, ele brilha em neon violeta
    if (abs(vElevation) > 0.01) {
      vec3 glowColor = vec3(0.6, 0.1, 1.0); // Violeta elétrico
      float factor = min(abs(vElevation) * 1.8, 1.0);
      gridColor = mix(gridColor, glowColor, factor);
    }

    // Linhas de borda atenuadas
    float border = 0.03;
    float lineX = smoothstep(0.0, border, vUv.x) * smoothstep(1.0, 1.0 - border, vUv.x);
    float lineY = smoothstep(0.0, border, vUv.y) * smoothstep(1.0, 1.0 - border, vUv.y);
    float gridLine = 1.0 - (lineX * lineY);

    // Transparência baseada na presença de ondas
    float alpha = mix(0.15, 0.8, min(abs(vElevation) * 2.0, 1.0));

    gl_FragColor = vec4(gridColor, alpha);
  }
`;

export const PARTICLE_VERTEX_SHADER = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Ajusta o tamanho do ponto baseado na distância à câmera para dar perspectiva
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const PARTICLE_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    // Distância do pixel ao centro do ponto
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    // Atenuação suave (fade) da borda para criar um aspecto de brilho circular macio
    float alpha = smoothstep(0.5, 0.1, dist);
    
    // Cor final brilhante
    gl_FragColor = vec4(vColor, alpha * 0.95);
  }
`;
