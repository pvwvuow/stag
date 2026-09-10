/**
 * STAG — Electron main process
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

const { app, BrowserWindow, ipcMain, shell } = require("electron");
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
  initUpdater();

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
      console.error("[stag] fatal:", err);
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
      console.error(`[stag] embedded server exited unexpectedly (code ${code})`);
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
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    title: "STAG",
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
  ipcMain.on("app:open-url", (_e, url) => {
    if (typeof url === "string" && /^https:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
  });
}

/* ---------------------------- updater ------------------------------ */
/**
 * In-app updates via electron-updater (GitHub releases).
 * - Differential downloads: the NSIS installer ships a .blockmap asset, so
 *   after this version only the CHANGED blocks of the installer are fetched
 *   (the old release must have its own .blockmap published too).
 * - Nothing downloads silently: the renderer shows what is happening and the
 *   user decides when to download and when to restart & install.
 * - Portable builds cannot self-install -> UI falls back to a download link.
 * - If the GitHub repo is private the anonymous check 404s; we surface a
 *   friendly state and the renderer offers the manual releases link.
 */

const UPDATE_STATE = {
  status: "idle", // idle | checking | available | downloading | ready | error | unsupported
  version: null,
  releaseNotes: null,
  percent: 0,
  transferred: 0,
  total: 0,
  bps: 0,
  error: null,
};
let autoUpdaterRef = null;

function pushUpdate(patch) {
  Object.assign(UPDATE_STATE, patch);
  if (win && !win.isDestroyed()) {
    win.webContents.send("update:event", { ...UPDATE_STATE });
  }
}

function loadUpdater() {
  if (autoUpdaterRef) return autoUpdaterRef;
  // Packaged: copied by electron-builder extraResources (asar ignores
  // node_modules dirs inside "files"). Dev: the same layout under electron/.
  const candidates = [
    path.join(process.resourcesPath ?? "", "stag-updater", "node_modules", "electron-updater"),
    path.join(__dirname, "vendor", "node_modules", "electron-updater"),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        autoUpdaterRef = require(candidate);
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!autoUpdaterRef) {
    try {
      autoUpdaterRef = require("electron-updater");
    } catch (err) {
      console.warn("[stag] electron-updater unavailable:", err.message);
    }
  }
  return autoUpdaterRef;
}

function initUpdater() {
  if (IS_DEV || SMOKE_TEST) return;

  // Portable exe cannot self-replace -> offer manual download instead.
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    UPDATE_STATE.status = "unsupported";
    UPDATE_STATE.error = "portable";
    return;
  }

  const updater = loadUpdater();
  if (!updater) return;
  const { autoUpdater } = updater;

  autoUpdater.autoDownload = false; // user decides in the UI
  autoUpdater.autoInstallOnAppQuit = true; // downloaded update installs on next restart

  autoUpdater.on("checking-for-update", () => {
    pushUpdate({ status: "checking", error: null });
  });
  autoUpdater.on("update-available", (info) => {
    pushUpdate({
      status: "available",
      version: info.version ?? null,
      releaseNotes:
        typeof info.releaseNotes === "string"
          ? info.releaseNotes.slice(0, 4000)
          : null,
      percent: 0,
      error: null,
    });
  });
  autoUpdater.on("update-not-available", () => {
    pushUpdate({ status: "idle", version: null, percent: 0, error: null });
  });
  autoUpdater.on("download-progress", (p) => {
    pushUpdate({
      status: "downloading",
      percent: Math.round(p.percent ?? 0),
      transferred: p.transferred ?? 0,
      total: p.total ?? 0,
      bps: p.bytesPerSecond ?? 0,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    pushUpdate({ status: "ready", version: info.version ?? UPDATE_STATE.version, percent: 100 });
  });
  autoUpdater.on("error", (err) => {
    const msg = String((err && err.message) || err || "");
    // Private repo / no network -> keep it quiet-ish, renderer shows fallback.
    pushUpdate({ status: "error", error: msg.slice(0, 300) });
  });

  ipcMain.handle("update:get-state", () => ({ ...UPDATE_STATE }));
  ipcMain.handle("update:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ...UPDATE_STATE };
    } catch (err) {
      const msg = String((err && err.message) || err || "");
      pushUpdate({ status: "error", error: msg.slice(0, 300) });
      return { ...UPDATE_STATE };
    }
  });
  ipcMain.handle("update:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ...UPDATE_STATE };
    } catch (err) {
      const msg = String((err && err.message) || err || "");
      pushUpdate({ status: "error", error: msg.slice(0, 300) });
      return { ...UPDATE_STATE };
    }
  });
  ipcMain.on("update:install", () => {
    quitting = true;
    killNextServer();
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      console.error("[stag] quitAndInstall failed:", err);
      app.quit();
    }
  });

  // Silent check shortly after launch — never blocks, never auto-downloads.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 6000);
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
