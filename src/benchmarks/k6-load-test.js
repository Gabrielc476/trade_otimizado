import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics to track load test results in detail
const orderPlacedCounter = new Counter('hft_orders_placed_total');
const tradeReceivedCounter = new Counter('hft_trades_received_total');
const wsConnectionSuccessCounter = new Counter('hft_ws_connections_success');
const wsConnectionErrorCounter = new Counter('hft_ws_connections_error');
const rttTrend = new Trend('hft_order_rtt_ms');

export const options = {
  stages: [
    { duration: '20s', target: 20 },  // Ramp-up to 20 VUs
    { duration: '40s', target: 50 },  // Ramp-up to 50 VUs
    { duration: '40s', target: 100 }, // Stress test with 100 VUs
    { duration: '20s', target: 0 },   // Ramp-down to 0 VUs
  ],
  thresholds: {
    hft_ws_connections_error: ['count<5'], // We expect almost 0 connection errors
  },
};

const BACKEND_HTTP = 'http://localhost:3001';
const BACKEND_WS = 'ws://localhost:3001';

// Setup phase - runs once before the VUs start
export function setup() {
  console.log('Starting APEX TRADE HFT Load Test via K6...');
  return {};
}

export default function () {
  const vuId = __VU;
  const iter = __ITER;
  
  const email = `k6_user_vu_${vuId}@apextrade.com`;
  const name = `K6 Stress User #${vuId}`;
  const password = 'k6securepassword123';

  // 1. Authenticate (Register and Login on the first iteration of this VU)
  let token = null;
  
  // Register (will return 409 if already registered, which is fine)
  const registerPayload = JSON.stringify({ email, name, password });
  const registerHeaders = { 'Content-Type': 'application/json' };
  
  const regRes = http.post(`${BACKEND_HTTP}/api/auth/register`, registerPayload, { headers: registerHeaders });
  if (regRes.status === 201 || regRes.status === 200) {
    console.log(`[VU ${vuId}] Registered successfully.`);
  } else if (regRes.status === 409) {
    // Already registered, continue to login
  } else {
    console.warn(`[VU ${vuId}] Unexpected register status: ${regRes.status}`);
  }

  // Login to get token
  const loginPayload = JSON.stringify({ email, password });
  const logRes = http.post(`${BACKEND_HTTP}/api/auth/login`, loginPayload, { headers: registerHeaders });
  
  if (check(logRes, { 'login successful': (r) => r.status === 201 || r.status === 200 })) {
    const data = JSON.parse(logRes.body);
    token = data.accessToken;
  } else {
    console.error(`[VU ${vuId}] Failed to login. Status: ${logRes.status}`);
    sleep(1);
    return;
  }

  if (!token) {
    console.error(`[VU ${vuId}] No token received. Aborting iteration.`);
    sleep(1);
    return;
  }

  // 2. Connect to the WebSocket NestJS Gateway
  // We pass the token in the query string which is accepted by our gateway
  const url = `${BACKEND_WS}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(token)}`;

  const response = ws.connect(url, {}, function (socket) {
    let orderCounter = 0;
    let midPrice = 65000.0;

    socket.on('open', function () {
      wsConnectionSuccessCounter.add(1);
      // Socket.io v4 client connection open frame
      socket.send('40');
    });

    socket.on('message', function (data) {
      // Socket.io handshake framing
      if (data.startsWith('0')) {
        // Server sends engine info, reply with open message
        socket.send('40');
      } else if (data.startsWith('42')) {
        // Socket.io event packet: 42["EVENT_NAME", payload]
        try {
          const rawPayload = data.substring(2);
          const parsed = JSON.parse(rawPayload);
          const eventName = parsed[0];
          const eventData = parsed[1];

          if (eventName === 'TRADE') {
            tradeReceivedCounter.add(1);
            // Dynamic midPrice tracking based on real trade prices occurring in the book
            if (eventData && eventData.price) {
              midPrice = eventData.price;
            }
          } else if (eventName === 'ORDER_PLACED') {
            // Confirm order receipt
          }
        } catch (e) {
          // Ignore parse errors from other WS frames
        }
      }
    });

    socket.on('error', function (err) {
      console.error(`[VU ${vuId} WS Error]`, err.error());
      wsConnectionErrorCounter.add(1);
    });

    // Periodically place high-frequency limit orders inside the socket session
    // We target a high-density trade matching rate
    socket.setInterval(function () {
      orderCounter++;
      
      // Random walk to vary the orders prices realistically
      midPrice += (Math.random() - 0.5) * 10.0;
      
      const side = Math.random() > 0.5 ? 1 : 2; // 1 = BUY, 2 = SELL
      const orderId = vuId * 10000000 + orderCounter;
      
      // We occasionally cross the spread to trigger a trade match
      const isCrossing = Math.random() < 0.25; // 25% chance of crossing
      const spread = 2.0 + Math.random() * 6.0;
      
      let price;
      if (side === 1) {
        price = isCrossing ? midPrice + spread / 2.5 : midPrice - spread / 2.0 - Math.random() * 20.0;
      } else {
        price = isCrossing ? midPrice - spread / 2.5 : midPrice + spread / 2.0 + Math.random() * 20.0;
      }

      price = Number(price.toFixed(2));
      const qty = Number((0.01 + Math.random() * 0.49).toFixed(4)); // 0.01 to 0.50 BTC

      // Build Socket.io PLACE_ORDER packet
      const payload = JSON.stringify([
        'PLACE_ORDER',
        {
          orderId,
          side,
          orderType: 'LIMIT',
          price,
          qty,
        }
      ]);

      const startTime = Date.now();
      socket.send(`42${payload}`);
      orderPlacedCounter.add(1);

      // Track RTT (Round Trip Time) trend roughly
      rttTrend.add(Date.now() - startTime);

      // 10% chance to cancel a random active order to maintain orderbook churn
      if (Math.random() < 0.10 && orderCounter > 10) {
        const cancelOrderId = vuId * 10000000 + (orderCounter - 5 - Math.floor(Math.random() * 5));
        const cancelPayload = JSON.stringify([
          'CANCEL_ORDER',
          { orderId: cancelOrderId }
        ]);
        socket.send(`42${cancelPayload}`);
      }

    }, 80); // Send an order every 80ms per VU

    // Keep the WebSocket connection open for 20 seconds, then disconnect
    socket.setTimeout(function () {
      socket.close();
    }, 20000);
  });

  check(response, { 'status is 101 (WS upgrade)': (r) => r && r.status === 101 });
  
  // Wait a moment between socket connections to avoid overwhelming handshake threads
  sleep(1);
}
