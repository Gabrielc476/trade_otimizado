# Diretrizes de Produto e Comunicação: ApexTrade

Este documento estabelece a voz de marca, as diretrizes de design visual e as convenções de comunicação para o desenvolvimento do **ApexTrade**.

---

## 1. Voz de Marca e Tom de Comunicação
O ApexTrade é uma plataforma de engenharia de ponta. Sua comunicação deve refletir isso de forma direta, técnica e estritamente profissional:
*   **Tom:** Técnico, preciso, minimalista e brutalista. Evitamos rodeios ou termos excessivamente comerciais. O produto fala pela sua performance.
*   **Terminologia (Glossário Rígido):**
    *   *Matching Engine:* Sempre referido como "Motor de Casamento".
    *   *Order Book:* Sempre referido como "Livro de Ofertas".
    *   *Trades:* Referidos como "Negócios" ou "Casamentos".
    *   *RPS:* Requisições por Segundo (Throughput).
    *   *SAB:* SharedArrayBuffer.
    *   *WAL:* Write-Ahead Log.

---

## 2. Padrões de Mensagens de Erro e Logs
Sob alta concorrência, a geração dinâmica de strings para logs e mensagens de erro é uma das principais fontes de alocação de memória indevida na V8.
*   **Convenções de Erro no Loop Crítico:**
    *   Não crie objetos de erro (`new Error()`) no fluxo crítico. Use códigos de erro numéricos (Enums) pré-definidos.
    *   *Exemplo:* Em vez de `throw new Error("Saldo Insuficiente")`, retorne um código numérico como `ErrorCode.INSUFFICIENT_BALANCE` (que é tratado de forma barata em instruções switch).
*   **Convenções de Logs (Main Thread):**
    *   Utilize logs estruturados em formato JSON para facilitar a ingestão e leitura automática em produção.
    *   Evite interpolar strings nos logs (ex: `logger.info("User " + id + " logged in")`). Prefira passar objetos estruturados: `logger.info({ userId: id }, "User login event")`.

---

## 3. Diretrizes de Design e Estética Visual
A interface do terminal web (Next.js) deve impressionar o usuário no primeiro olhar através de uma estética moderna, técnica e imersiva:
*   **Tema Visual:** Dark Mode absoluto. Paleta baseada em pretos profundos (`#09090b`, `#030303`), cinzas grafite e contornos brilhantes em neon.
*   **Cores de Ação:**
    *   *Compra (Bids):* Neon Verde Ciano / Esmeralda (`#10b981` ou `#059669`).
    *   *Venda (Asks):* Neon Vermelho Magenta / Rosa Choque (`#f43f5e` ou `#e11d48`).
    *   *Acentos/Destaques:* Neon Violeta / Roxo Elétrico para o reator de volatilidade e elementos de telemetria.
*   **Tipografia:** Fontes de largura fixa (monofontes) ou sem serifa limpas (como *Space Mono*, *JetBrains Mono* ou *Inter*) para reforçar a estética tech-brutalista.
*   **Layout:** Grid modular estilo Bento Grid com bordas finas, efeito de vidro fosco (glassmorphism via Tailwind `backdrop-blur-md bg-opacity-20`) e cantos levemente arredondados.
