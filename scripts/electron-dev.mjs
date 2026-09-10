/**
 * Dev helper: starts `next dev` on :3000, waits for it, then launches
 * Electron pointed at the dev server. Both processes die together on Ctrl+C.
 * Run: npm run electron:dev
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronBin = require("electron");

const DEV_PORT = 3000;
const DEV_URL = `http://localhost:${DEV_PORT}`;

function waitForPort(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const socket = new net.Socket();
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error("next dev did not start"));
        else setTimeout(poll, 400);
      });
      socket.connect(port, "127.0.0.1");
    };
    poll();
  });
}

const nextProc = spawn("npx", ["next", "dev", "-p", String(DEV_PORT)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

try {
  await waitForPort(DEV_PORT);
} catch (err) {
  console.error(err.message);
  nextProc.kill();
  process.exit(1);
}

const electronProc = spawn(electronBin, ["."], {
  stdio: "inherit",
  env: { ...process.env, GAMEDNS_DEV: "1", GAMEDNS_DEV_URL: DEV_URL },
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  nextProc.kill();
  electronProc.kill();
  process.exit(0);
};

electronProc.on("exit", shutdown);
nextProc.on("exit", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
