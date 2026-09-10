/**
 * Game DNS Tester — Electron main process
 *
 * Architecture:
 *  - Production: an embedded Next.js standalone server is spawned as a pure
 *    Node child process (ELECTRON_RUN_AS_NODE=1) listening on 127.0.0.1:<free-port>.
 *    The window loads that URL, so /api/dns and every page work fully offline.
 *  - Development: the window loads http://localhost:3000 (started by
 *    `npm run electron:dev`), so hot reload works.
 *
 * Window: frameless (frame: false) with a custom in-app titlebar
 * (drag region + min/max/close via IPC). See src/components/titlebar.tsx.
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");

const FORCE_EMBEDDED = process.env.GAMEDNS_EMBEDDED === "1";
const SMOKE_TEST = process.env.GAMEDNS_SMOKE === "1";
const IS_DEV = FORCE_EMBEDDED ? false : !app.isPackaged;
const DEV_URL = process.env.GAMEDNS_DEV_URL || "http://localhost:3000";

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import("node:child_process").ChildProcess | null} */
let nextProc = null;
let quitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}

/* ------------------------------------------------------------------ */

function bootstrap() {
  registerIpc();

  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    killNextServer();
  });

  app.on("window-all-closed", () => {
    killNextServer();
    app.quit();
  });

  app.whenReady().then(async () => {
    try {
      let url = DEV_URL;
      if (!IS_DEV) {
        url = await startEmbeddedServer();
        await waitForHttp(url, 20000);
      }
      createWindow(url);
    } catch (err) {
      // Nothing sensible to show if the embedded server can't boot — log and exit.
      console.error("[gamedns] fatal:", err);
      app.quit();
    }
  });
}

/* ------------------------- embedded server ------------------------- */

function findFreePort(startAt) {
  return new Promise((resolve, reject) => {
    let port = startAt;
    const tryPort = () => {
      if (port > startAt + 200) {
        reject(new Error("no free port"));
        return;
      }
      const srv = net.createServer();
      srv.once("error", () => {
        port += 1;
        tryPort();
      });
      srv.once("listening", () => {
        srv.close(() => resolve(port));
      });
      srv.listen(port, "127.0.0.1");
    };
    tryPort();
  });
}

async function startEmbeddedServer() {
  const serverDir = app.isPackaged
    ? path.join(process.resourcesPath, "next-app")
    : path.join(__dirname, "..", ".next", "standalone");
  const serverJs = path.join(serverDir, "server.js");

  if (!fs.existsSync(serverJs)) {
    throw new Error(`embedded Next server not found: ${serverJs}`);
  }

  const port = await findFreePort(37777);

  nextProc = spawn(process.execPath, [serverJs], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextProc.stdout?.on("data", (d) => process.stdout.write(`[next] ${d}`));
  nextProc.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));
  nextProc.on("exit", (code) => {
    nextProc = null;
    if (!quitting && win && !win.isDestroyed()) {
      // The engine died unexpectedly — close the app rather than showing a dead page.
      console.error(`[gamedns] embedded server exited unexpectedly (code ${code})`);
      win.close();
    }
  });

  return `http://127.0.0.1:${port}`;
}

function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
      req.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("embedded server did not become ready in time"));
        return;
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}

function killNextServer() {
  if (nextProc) {
    try {
      nextProc.kill();
    } catch {
      /* noop */
    }
    nextProc = null;
  }
}

/* ----------------------------- window ------------------------------ */

function createWindow(url) {
  win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 460,
    minHeight: 600,
    show: false,
    frame: false,
    title: "تستر DNS گیم",
    backgroundColor: "#070b0e",
    icon: fs.existsSync(path.join(__dirname, "..", "build", "icon.png"))
      ? path.join(__dirname, "..", "build", "icon.png")
      : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => {
    win?.show();
    if (SMOKE_TEST) runSmokeTest();
  });

  win.on("maximize", () => win?.webContents.send("window:maximizedChanged", true));
  win.on("unmaximize", () => win?.webContents.send("window:maximizedChanged", false));

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  win.on("closed", () => {
    win = null;
  });

  win.loadURL(url);
}

/* ------------------------------- IPC ------------------------------- */

function registerIpc() {
  ipcMain.on("window:minimize", () => win?.minimize());
  ipcMain.on("window:maximize-toggle", () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", () => win?.close());
  ipcMain.handle("window:is-maximized", () => (win ? win.isMaximized() : false));
  ipcMain.handle("app:get-version", () => app.getVersion());
}

/* --------------------------- smoke test ---------------------------- */

function runSmokeTest() {
  const shotPath =
    process.env.GAMEDNS_SMOKE_SHOT || path.join(__dirname, "..", ".zscripts", "electron-smoke.png");
  setTimeout(async () => {
    try {
      if (!win) throw new Error("no window");
      const image = await win.webContents.capturePage();
      fs.mkdirSync(path.dirname(shotPath), { recursive: true });
      fs.writeFileSync(shotPath, image.toPNG());
      console.log("SMOKE_OK");
      app.quit();
    } catch (err) {
      console.error("SMOKE_FAIL", err);
      app.exit(1);
    }
  }, 3500);
}
