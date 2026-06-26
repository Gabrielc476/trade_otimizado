import { WorkerThreadDriver } from "../infrastructure/concurrency/WorkerThreadDriver";
import * as path from "path";

async function test() {
  const assets = ["BTC", "USDT"];
  const walPath = path.resolve(process.cwd(), "wal_test.log");
  
  console.log("Starting WorkerThreadDriver...");
  const driver = new WorkerThreadDriver(assets, walPath);

  driver.onMessage((msg) => {
    console.log("Message received from worker:", msg.type);
    if (msg.type === "L2_UPDATE") {
      console.log("L2_UPDATE data type:", typeof msg.data, msg.data.constructor?.name);
      console.log("L2_UPDATE data length:", msg.data.length);
      console.log("L2_UPDATE sample values:", Array.from(msg.data.slice(0, 10)));
    } else if (msg.type === "TRADE") {
      console.log("TRADE data:", msg);
    }
  });

  // Wait for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Terminating worker...");
  await driver.terminate();
  process.exit(0);
}

test().catch(console.error);
