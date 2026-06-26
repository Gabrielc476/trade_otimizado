import { io } from "socket.io-client";

const BACKEND_URL = "http://localhost:3001";

async function test() {
  const email = "mm1@apextrade.com";
  const password = "marketmakersecurepassword123";

  console.log("Logging in...");
  const logRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!logRes.ok) {
    console.error("Login failed:", await logRes.text());
    return;
  }

  const logData = await logRes.json();
  const token = logData.accessToken;
  console.log("Token obtained:", token);

  console.log("Connecting to WS...");
  const socket = io(BACKEND_URL, {
    auth: {
      token: `Bearer ${token}`,
    },
  });

  socket.on("connect", () => {
    console.log("Connected! ID:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err.message);
  });

  socket.on("L2_UPDATE", (data) => {
    console.log("L2_UPDATE received. Bids:", data.bids?.length, "Asks:", data.asks?.length);
    console.log("Sample bids:", data.bids?.slice(0, 3));
    console.log("Sample asks:", data.asks?.slice(0, 3));
  });

  socket.on("TRADE", (data) => {
    console.log("TRADE received:", data);
  });

  socket.on("BALANCE_UPDATE", (data) => {
    console.log("BALANCE_UPDATE received:", data);
  });
  
  // Keep running for 10 seconds, then disconnect
  setTimeout(() => {
    console.log("Disconnecting...");
    socket.disconnect();
    process.exit(0);
  }, 10000);
}

test().catch(console.error);
