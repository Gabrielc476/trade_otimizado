import { io, Socket } from "socket.io-client";

const BACKEND_URL = "http://localhost:3001";
const NUM_MARKET_MAKERS = 5;
const SIMULATION_INTERVAL_MS = 150;

interface MarketMaker {
  email: string;
  name: string;
  userId?: number;
  token?: string;
  socket?: Socket;
  activeOrders: number[];
}

const marketMakers: MarketMaker[] = Array.from({ length: NUM_MARKET_MAKERS }, (_, i) => ({
  email: `mm${i + 1}@apextrade.com`,
  name: `MarketMaker #${i + 1}`,
  activeOrders: [],
}));

let midPrice = 65000.0;
let globalOrderId = 1000000; // Offset global order ID to avoid conflicts with frontend

async function registerAndLogin(mm: MarketMaker): Promise<boolean> {
  const password = "marketmakersecurepassword123";
  
  try {
    // 1. Try to register
    console.log(`[Auth] Registrando ${mm.name} (${mm.email})...`);
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: mm.email, name: mm.name, password }),
    });

    if (regRes.ok) {
      const regData = await regRes.json();
      console.log(`[Auth] ${mm.name} registrado com sucesso! ID: #${regData.userId}`);
    } else {
      // If already exists (conflict), that's fine, we will just log in
      if (regRes.status === 409) {
        console.log(`[Auth] ${mm.name} já cadastrado no banco. Procedendo para o login.`);
      } else {
        const errText = await regRes.text();
        console.warn(`[Auth] Erro não crítico no cadastro de ${mm.name}:`, errText);
      }
    }

    // 2. Login
    console.log(`[Auth] Realizando login de ${mm.name}...`);
    const logRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: mm.email, password }),
    });

    if (!logRes.ok) {
      throw new Error(`Falha no login (HTTP ${logRes.status})`);
    }

    const logData = await logRes.json();
    mm.token = logData.accessToken;
    mm.userId = logData.user.id;
    console.log(`[Auth] ${mm.name} logado. Token obtido com sucesso.`);
    return true;
  } catch (err: any) {
    console.error(`[Auth Error] Falha na autenticação de ${mm.name}:`, err.message || err);
    return false;
  }
}

function connectWebSocket(mm: MarketMaker): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!mm.token) {
      return reject(new Error(`Nenhum token disponível para ${mm.name}`));
    }

    console.log(`[WS] Conectando socket para ${mm.name}...`);
    const socket = io(BACKEND_URL, {
      auth: {
        token: `Bearer ${mm.token}`,
      },
    });

    socket.on("connect", () => {
      console.log(`[WS] ${mm.name} conectado via WebSocket (ID: ${socket.id})`);
      mm.socket = socket;
      resolve();
    });

    socket.on("connect_error", (err) => {
      console.error(`[WS Error] Falha na conexão WebSocket de ${mm.name}:`, err.message);
      reject(err);
    });

    socket.on("ORDER_PLACED", (data) => {
      // Confirm placement
    });

    socket.on("ORDER_CANCELLED", (data) => {
      // Confirm cancellation
    });
  });
}

async function bootstrap() {
  console.log("==================================================");
  console.log("          APEX TRADE REAL-TIME MARKET FEEDER      ");
  console.log("==================================================");

  // 1. Authenticate all market makers
  let authenticatedCount = 0;
  for (const mm of marketMakers) {
    const success = await registerAndLogin(mm);
    if (success) authenticatedCount++;
  }

  if (authenticatedCount === 0) {
    console.error("[Fatal] Nenhum market maker pôde ser autenticado. Abortando simulação.");
    process.exit(1);
  }

  console.log(`\n[Status] ${authenticatedCount}/${NUM_MARKET_MAKERS} market makers autenticados.`);

  // 2. Connect all WebSockets
  console.log("\n[WS] Inicializando conexões WebSocket simultâneas...");
  const connectionPromises = marketMakers
    .filter((mm) => mm.token)
    .map((mm) => connectWebSocket(mm).catch(() => {}));
  
  await Promise.all(connectionPromises);
  
  const connectedCount = marketMakers.filter((mm) => mm.socket?.connected).length;
  console.log(`[Status] ${connectedCount}/${authenticatedCount} sockets ativos.\n`);

  if (connectedCount === 0) {
    console.error("[Fatal] Nenhuma conexão WebSocket ativa. Abortando simulação.");
    process.exit(1);
  }

  // 3. Start Market Feeder Simulation Loop
  console.log("[Simulation] Iniciando simulação de liquidez HFT...");
  console.log("[Simulation] Gerando ordens limites de bids/asks e provocando cruzamentos...");
  console.log("Aperte CTRL+C para encerrar.\n");

  setInterval(() => {
    // Random walk on midPrice to create volatility
    midPrice += (Math.random() - 0.5) * 12.0;
    
    // Choose a random connected market maker
    const activeMms = marketMakers.filter((mm) => mm.socket?.connected);
    if (activeMms.length === 0) return;
    const mm = activeMms[Math.floor(Math.random() * activeMms.length)];

    // 30% chance to cancel an existing order to maintain order book churn
    if (mm.activeOrders.length > 0 && Math.random() < 0.3) {
      const orderToCancel = mm.activeOrders.shift()!;
      mm.socket?.emit("CANCEL_ORDER", { orderId: orderToCancel });
      return;
    }

    // Otherwise, place a new order
    const side = Math.random() > 0.5 ? 1 : 2; // 1 = BUY, 2 = SELL
    const orderId = globalOrderId++;

    // Spread width varies between $2.00 and $10.00
    const spread = 2.0 + Math.random() * 8.0;
    
    let price: number;
    if (side === 1) {
      // Buy order: slightly below midPrice (or crossing it occasionally to trigger trade)
      const crossingTrade = Math.random() < 0.15; // 15% chance to cross spread and trigger match
      price = crossingTrade ? midPrice + spread / 4 : midPrice - spread / 2 - Math.random() * 40.0;
    } else {
      // Sell order: slightly above midPrice
      const crossingTrade = Math.random() < 0.15;
      price = crossingTrade ? midPrice - spread / 4 : midPrice + spread / 2 + Math.random() * 40.0;
    }

    // Limit price precision to 2 decimal places
    price = Number(price.toFixed(2));
    
    // Random quantity between 0.02 and 0.85 BTC
    const qty = Number((0.02 + Math.random() * 0.83).toFixed(4));

    // Send the order via WebSocket
    mm.socket?.emit("PLACE_ORDER", {
      orderId,
      side,
      orderType: "LIMIT",
      price,
      qty,
    });

    mm.activeOrders.push(orderId);
    if (mm.activeOrders.length > 50) {
      mm.activeOrders.shift(); // Limit tracked active orders size in memory
    }

    // Print a brief status log to stdout
    const sideText = side === 1 ? "\x1b[32mCOMPRA\x1b[0m" : "\x1b[31mVENDA\x1b[0m";
    process.stdout.write(
      `\r[FEED] ${mm.name} enviou: ${sideText} | Preço: $${price.toFixed(2)} | Qtd: ${qty.toFixed(4)} BTC | Preço Médio: $${midPrice.toFixed(2)}   `
    );

  }, SIMULATION_INTERVAL_MS);
}

bootstrap().catch((err) => {
  console.error("Fatal error during Market Feeder bootstrap:", err);
});
