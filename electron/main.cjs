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

const { app, BrowserWindow, ipcMain, shell, session, Menu, Tray, nativeImage } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");
const crypto = require("node:crypto");

const FORCE_EMBEDDED = process.env.GAMEDNS_EMBEDDED === "1";
const SMOKE_TEST = process.env.GAMEDNS_SMOKE === "1";
const IS_DEV = FORCE_EMBEDDED ? false : !app.isPackaged;
const DEV_URL = process.env.GAMEDNS_DEV_URL || "http://localhost:3000";

// فاز ۴.۲ — per-run random token for the local API. The embedded Next server
// requires it on every /api call; the renderer gets it through the preload
// bridge (app:get-api-token). Random per launch, never persisted, never sent
// anywhere outside 127.0.0.1.
const API_TOKEN = crypto.randomBytes(24).toString("base64url");

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import("node:child_process").ChildProcess | null} */
let nextProc = null;
let quitting = false;
/** URL of the embedded server once it is up (null until then). */
let serverUrl = null;
/** Auto-restart attempts for the embedded server (5.1). */
let restartAttempts = 0;
/** System tray (فاز ۸). */
let tray = null;
let trayEnabled = false;
let closeToTray = false;
/** beta.4 — set while waiting for the elevated second instance to take over. */
let pendingElevatedRelaunch = false;

/* ------------------------------------------------------------------ */

function bootstrap() {
  initLogger();
  logElevationState();
  registerIpc();

  // The updater is an optional feature — a failure here (missing module,
  // odd environment, …) must NEVER take the whole app down.
  try {
    seedDifferentialCache();
    initUpdater();
  } catch (err) {
    logLine("error", `updater init failed (app continues without it): ${err?.stack || err}`);
  }

  app.on("second-instance", () => {
    // beta.4 — when the user asked for an elevated relaunch, the second
    // instance IS the elevated one: hand the session over and exit quietly.
    if (pendingElevatedRelaunch) {
      quitting = true;
      killNextServer();
      app.quit();
      return;
    }
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
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
    initCsp();
    try {
      let url = DEV_URL;
      if (!IS_DEV) {
        url = await startEmbeddedServer();
        await waitForHttp(url, 20000);
      }
      serverUrl = url;
      restartAttempts = 0;
      createWindow(url);
    } catch (err) {
      // 5.1 — boot failure now shows the in-app error page (with retry),
      // instead of silently quitting.
      logLine("error", `embedded server boot failed: ${err?.stack || err}`);
      createWindow(null);
    }
  });
}

/* ------------------------------ logger ----------------------------- */
/**
 * فاز ۷.۶ — lightweight rotating logger. Everything the main process does
 * (boot, updater, embedded server stdout/stderr, renderer console errors,
 * crashes) lands in <userData>/logs/stag.log with size-based rotation so
 * users can "copy log for support" from the About page.
 */
let LOG_FILE = null;

function initLogger() {
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    LOG_FILE = path.join(dir, "stag.log");
    rotateLogIfNeeded();
    logLine("info", `--- STAG ${app.getVersion()} started (pid ${process.pid}, dev=${IS_DEV}) ---`);
  } catch {
    LOG_FILE = null;
  }
}

function rotateLogIfNeeded() {
  try {
    if (LOG_FILE && fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) {
      fs.rmSync(LOG_FILE + ".old", { force: true });
      fs.renameSync(LOG_FILE, LOG_FILE + ".old");
    }
  } catch {
    /* rotation is best-effort */
  }
}

function logLine(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  try {
    if (LOG_FILE) {
      fs.appendFileSync(LOG_FILE, line + "\n");
      rotateLogIfNeeded();
    }
  } catch {
    /* noop */
  }
  if (level === "error") console.error(line);
  else console.log(line);
}

/**
 * beta.3 — log whether STAG runs with admin rights (Windows). System-DNS
 * changes need elevation; this line in the support log instantly separates
 * "app not elevated" from "UAC/PowerShell broken" when the power button is
 * reported broken. Best-effort, cached, never blocks boot.
 *
 * beta.4 — the probe is now a shared cached promise so both the support log
 * AND the "app:elevation" IPC (settings page badge + admin relaunch) use one
 * honest source of truth.
 */
let elevationLogged = false;
let ELEVATION_PROMISE = null;
function probeElevation() {
  if (process.platform !== "win32") return Promise.resolve(false);
  if (!ELEVATION_PROMISE) {
    ELEVATION_PROMISE = new Promise((resolve) => {
      try {
        const probe = spawn("net.exe", ["session"], { windowsHide: true, stdio: "ignore" });
        const t = setTimeout(() => {
          try { probe.kill(); } catch { /* noop */ }
        }, 5000);
        t.unref?.();
        probe.once("exit", (code) => resolve(code === 0));
        probe.once("error", () => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }
  return ELEVATION_PROMISE;
}
function logElevationState() {
  if (elevationLogged) return;
  elevationLogged = true;
  if (process.platform !== "win32") {
    logLine("info", `platform=${process.platform} (elevation check is Windows-only)`);
    return;
  }
  probeElevation().then((elevated) => {
    logLine("info", `windows elevation: ${elevated ? "ADMIN (elevated)" : "standard user (not elevated)"} — system-DNS apply uses direct netsh first, UAC on demand`);
  });
}

// 5.1 — a stray async error must not produce the scary red Electron dialog.
// Log it and keep running; genuinely fatal states end at the error page.
process.on("uncaughtException", (err) => {
  logLine("error", `uncaughtException: ${err?.stack || err}`);
});
process.on("unhandledRejection", (err) => {
  logLine("error", `unhandledRejection: ${err?.stack || err}`);
});

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
      STAG_API_TOKEN: API_TOKEN, // فاز ۴.۲ — the local API requires this token
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextProc.stdout?.on("data", (d) => {
    const s = String(d).trim();
    if (s) logLine("info", `[next] ${s.slice(0, 500)}`);
  });
  nextProc.stderr?.on("data", (d) => {
    const s = String(d).trim();
    if (s) logLine("error", `[next] ${s.slice(0, 500)}`);
  });
  nextProc.on("exit", (code) => {
    nextProc = null;
    if (quitting) return;
    logLine("error", `embedded server exited unexpectedly (code ${code})`);
    scheduleServerRestart();
  });

  return `http://127.0.0.1:${port}`;
}

/**
 * 5.۱ — the embedded server dying used to close the whole app without a
 * word. Now: auto-restart with linear backoff (up to 3 tries); if it still
 * won't come up, show the in-app error page with a manual retry button.
 */
function scheduleServerRestart() {
  if (restartAttempts >= 3) {
    showServerError("died");
    return;
  }
  restartAttempts += 1;
  const delay = 1500 * restartAttempts;
  logLine("info", `auto-restarting embedded server (attempt ${restartAttempts}/3 in ${delay}ms)`);
  setTimeout(async () => {
    if (quitting) return;
    try {
      const url = await startEmbeddedServer();
      await waitForHttp(url, 20000);
      serverUrl = url;
      restartAttempts = 0;
      logLine("info", "embedded server restarted OK");
      if (win && !win.isDestroyed()) {
        win.loadURL(url).catch(() => {});
      }
    } catch (err) {
      logLine("error", `embedded server restart failed: ${err?.stack || err}`);
      showServerError("restart");
    }
  }, delay);
}

function showServerError(reason) {
  if (!win || win.isDestroyed()) return;
  logLine("error", `showing in-app error page (reason: ${reason})`);
  win
    .loadFile(path.join(__dirname, "error.html"), {
      search: `reason=${encodeURIComponent(reason)}`,
    })
    .catch(() => {});
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
  if (!nextProc) return;
  const p = nextProc;
  nextProc = null;
  try {
    if (process.platform === "win32" && p.pid) {
      // 5.۶ — the standalone server can hold worker children; a plain kill()
      // leaves grandchildren alive holding the port. taskkill /T takes the
      // whole tree down.
      spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      p.kill();
    }
  } catch {
    /* noop */
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
    title: "STAG Beta",
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

  // 7.۶ — capture renderer console errors + crashes into the log file.
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 2) {
      logLine("error", `[renderer] ${message} (${sourceId}:${line})`);
    }
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    logLine("error", `renderer gone: ${details?.reason} (exitCode ${details?.exitCode})`);
  });

  // فاز ۸ — close-to-tray: when enabled, closing the window hides it instead
  // of quitting (downloads/monitoring keep running in the tray).
  win.on("close", (e) => {
    if (closeToTray && trayEnabled && !quitting) {
      e.preventDefault();
      win?.hide();
    }
  });

  win.on("closed", () => {
    win = null;
  });

  if (url) {
    win.loadURL(url);
  } else {
    showServerError("boot");
  }
}

/* ------------------------------- CSP ------------------------------- */
/**
 * فاز ۴.۵ — defense-in-depth Content-Security-Policy on everything the
 * embedded server serves. 'unsafe-inline' stays because Next.js bootstraps
 * with inline scripts/styles; remote script/style/frame/object sources are
 * still impossible. Skipped in dev (next dev's React refresh needs eval).
 */
function initCsp() {
  if (IS_DEV) return;
  const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|$)/i.test(details.url)) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [CSP],
          },
        });
      } else {
        callback({});
      }
    });
    logLine("info", "CSP enabled");
  } catch (err) {
    logLine("error", `CSP init failed: ${err?.message}`);
  }
}

/* ------------------------------- tray ------------------------------ */
/** فاز ۸ — system tray + minimize/close to tray + auto-start with Windows. */

function trayIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "stag-icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
}

function ensureTray() {
  if (tray || !trayEnabled) return;
  try {
    let icon = nativeImage.createFromPath(trayIconPath());
    if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("STAG — Lower Ping, Better Play");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "نمایش STAG",
          click: () => {
            if (win) {
              win.show();
              win.focus();
            }
          },
        },
        { type: "separator" },
        {
          label: "خروج",
          click: () => {
            quitting = true;
            killNextServer();
            app.quit();
          },
        },
      ]),
    );
    tray.on("double-click", () => {
      if (win) {
        win.show();
        win.focus();
      }
    });
    logLine("info", "system tray created");
  } catch (err) {
    logLine("error", `tray init failed: ${err?.message}`);
    tray = null;
  }
}

function removeTray() {
  if (tray) {
    try {
      tray.destroy();
    } catch {
      /* noop */
    }
    tray = null;
    logLine("info", "system tray removed");
  }
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
  // فاز ۴.۲ — the renderer must attach this token to every /api call.
  ipcMain.handle("app:get-api-token", () => API_TOKEN);

  /*
   * beta.4 — Windows elevation state + one-click UAC relaunch. With admin
   * rights the DNS power button applies instantly (direct netsh); without it
   * every toggle needs a UAC prompt, so the settings page shows the badge and
   * offers this relaunch.
   */
  ipcMain.handle("app:elevation", async () => {
    const elevated = await probeElevation();
    return { elevated, platform: process.platform };
  });
  ipcMain.handle("app:relaunch-elevated", async () => {
    if (process.platform !== "win32") return { ok: false, error: "windows-only" };
    try {
      pendingElevatedRelaunch = true;
      // Auto-clear the handover flag so a later unrelated second-instance
      // (user double-launching the app) can never kill this session by mistake.
      setTimeout(() => { pendingElevatedRelaunch = false; }, 5 * 60 * 1000).unref?.();
      const psCmd = `Start-Process -FilePath '${String(process.execPath).replace(/'/g, "''")}' -Verb RunAs`;
      spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCmd], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      logLine("info", "elevated relaunch requested (UAC prompt shown)");
      return { ok: true };
    } catch (err) {
      pendingElevatedRelaunch = false;
      logLine("error", `elevated relaunch failed: ${err?.message}`);
      return { ok: false, error: String(err?.message || err) };
    }
  });
  ipcMain.on("app:open-url", (_e, url) => {
    if (typeof url === "string" && /^https:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
  });

  // 3.2 — Electron is Chromium: it keeps its OWN host-resolver cache that
  // `ipconfig /flushdns` does NOT touch. After STAG changes the system DNS,
  // the renderer (and any internal fetch) could keep resolving through the
  // stale Chromium cache — the app would still "connect" to the old DNS. Clear
  // that cache and drop live sockets so the next lookup re-resolves fresh.
  ipcMain.handle("dns:clear-cache", async () => {
    try {
      const ses = win?.webContents?.session;
      if (!ses) return { ok: false };
      await ses.clearHostResolverCache();
      // Best-effort: close pooled connections so the next request re-resolves.
      try {
        await ses.closeAllConnections?.();
      } catch {
        /* older Electron: method may be absent */
      }
      return { ok: true };
    } catch (err) {
      logLine("error", `clearHostResolverCache failed: ${err?.message}`);
      return { ok: false };
    }
  });

  // فاز ۸ — tray / close-to-tray / auto-start preferences from Settings.
  ipcMain.handle("app:set-prefs", (_e, prefs) => {
    try {
      if (!prefs || typeof prefs !== "object") return { ok: false };
      if (typeof prefs.tray === "boolean") {
        trayEnabled = prefs.tray;
        if (trayEnabled) ensureTray();
        else removeTray();
      }
      if (typeof prefs.closeToTray === "boolean") closeToTray = prefs.closeToTray;
      if (typeof prefs.autostart === "boolean") {
        app.setLoginItemSettings({ openAtLogin: prefs.autostart });
        logLine("info", `auto-start with Windows: ${prefs.autostart}`);
      }
      let autostartActive = null;
      try {
        autostartActive = app.getLoginItemSettings().openAtLogin;
      } catch {
        /* not supported on this platform */
      }
      return { ok: true, autostartActive };
    } catch (err) {
      logLine("error", `set-prefs failed: ${err?.message}`);
      return { ok: false, error: String(err?.message || err) };
    }
  });

  // 7.۶ — the About page reads a tail of the log file for support.
  ipcMain.handle("app:get-logs", async () => {
    try {
      if (!LOG_FILE || !fs.existsSync(LOG_FILE)) return { ok: true, logs: "(لاگی ثبت نشده است)" };
      const stat = fs.statSync(LOG_FILE);
      const start = Math.max(0, stat.size - 96 * 1024);
      const len = stat.size - start;
      const buf = Buffer.alloc(len);
      const fd = fs.openSync(LOG_FILE, "r");
      fs.readSync(fd, buf, 0, len, start);
      fs.closeSync(fd);
      return { ok: true, logs: buf.toString("utf8") };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  // 5.۱ — retry button on the error page.
  ipcMain.handle("app:retry-server", async () => {
    try {
      logLine("info", "manual server retry requested");
      if (nextProc) killNextServer();
      const url = await startEmbeddedServer();
      await waitForHttp(url, 20000);
      serverUrl = url;
      restartAttempts = 0;
      if (win && !win.isDestroyed()) await win.loadURL(url);
      return { ok: true };
    } catch (err) {
      logLine("error", `manual retry failed: ${err?.stack || err}`);
      return { ok: false, error: String((err && err.message) || err) };
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

/*
 * beta.4 — WHY USERS GOT FULL-SIZE UPDATES (two independent causes, both fixed):
 *
 * 1. electron-updater reads provider config from resources/app-update.yml.
 *    Our packaged app SHIPPED WITHOUT IT, so in-app updates could never even
 *    start (the renderer fell back to the manual GitHub link — a full 127MB
 *    download every release). afterPack.cjs now writes that file; see there.
 *
 * 2. Differential download needs the OLD installer on disk at
 *    <cache>/installer.exe (electron-updater 6.x hard-codes this name). It
 *    NEVER creates that file itself: after the first full download the
 *    installer sits in <cache>/pending/, so every future update would ALSO be
 *    full. seedDifferentialCache() promotes it once at startup of the newly
 *    installed version — from then on only changed blocks are downloaded.
 */

/** updaterCacheDirName from app-update.yml (fallback matches electron-builder). */
function updaterCacheDirName() {
  try {
    const yml = path.join(process.resourcesPath ?? "", "app-update.yml");
    if (fs.existsSync(yml)) {
      const m = fs.readFileSync(yml, "utf8").match(/^updaterCacheDirName:\s*(\S+)\s*$/m);
      if (m) return m[1];
    }
  } catch {
    /* fall through */
  }
  return "stag-beta-updater"; // electron-builder: sanitize("STAG Beta").toLowerCase()+"-updater"
}

function differentialCacheDir() {
  const base = process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
  return path.join(base, updaterCacheDirName());
}

function seedDifferentialCache() {
  try {
    if (process.platform !== "win32") return;
    if (process.env.PORTABLE_EXECUTABLE_DIR) return; // portable never self-updates
    const cacheDir = differentialCacheDir();
    const pendingDir = path.join(cacheDir, "pending");
    const oldInstaller = path.join(cacheDir, "installer.exe");
    fs.mkdirSync(cacheDir, { recursive: true });

    if (!fs.existsSync(oldInstaller)) {
      let candidate = null;
      try {
        const version = app.getVersion();
        const files = fs.existsSync(pendingDir)
          ? fs
              .readdirSync(pendingDir)
              .filter((f) => f.toLowerCase().endsWith(".exe"))
              .filter((f) => !f.startsWith("temp-"))
              .map((f) => path.join(pendingDir, f))
          : [];
        files.sort((a, b) => {
          try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch { return 0; }
        });
        // The installer of the version we ARE RUNNING NOW is exactly the "old
        // file" the next differential download will diff against.
        candidate = files.find((f) => path.basename(f).includes(version)) ?? null;
      } catch {
        candidate = null;
      }
      if (candidate) {
        fs.copyFileSync(candidate, oldInstaller);
        logLine("info", `differential seed: ${path.basename(candidate)} -> installer.exe — the NEXT update downloads only changed blocks`);
      } else {
        logLine("info", "differential seed: no cached installer yet — the next update downloads fully once, then delta mode kicks in");
      }
    }

    // electron-updater stages the NEW blockmap in pending during a download and
    // promotes it to <cache>/current.blockmap afterwards; promote it ourselves
    // if the app was killed in between (it is the OLD blockmap for next time).
    try {
      const cur = path.join(cacheDir, "current.blockmap");
      const staged = path.join(pendingDir, "current.blockmap");
      if (!fs.existsSync(cur) && fs.existsSync(staged)) fs.copyFileSync(staged, cur);
    } catch {
      /* noop */
    }
  } catch (err) {
    logLine("info", `differential seed skipped: ${err?.message}`);
  }
}

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
  // GAMEDNS_UPDATER_FORCE=1 lets the smoke test exercise the real packaged
  // code path (dev/smoke runs skip the updater by default).
  if ((IS_DEV || SMOKE_TEST) && process.env.GAMEDNS_UPDATER_FORCE !== "1") return;

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
      delta: false,
    });
  });
  autoUpdater.on("update-not-available", () => {
    pushUpdate({ status: "idle", version: null, percent: 0, error: null, delta: false });
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
    // beta.4 — tell the user the truth about HOW the update arrived: a
    // differential pass downloads far less than the full installer size.
    const transferred = UPDATE_STATE.transferred ?? 0;
    const total = UPDATE_STATE.total ?? 0;
    const delta = transferred > 0 && total > 0 && transferred < total;
    pushUpdate({
      status: "ready",
      version: info.version ?? UPDATE_STATE.version,
      percent: 100,
      delta,
    });
    if (delta) {
      logLine("info", `update downloaded DIFFERENTIALLY: ${(transferred / 1048576).toFixed(1)}MB of ${(total / 1048576).toFixed(1)}MB`);
    }
    // Belt & braces: the freshly downloaded installer IS the "old file" for the
    // update after this one — pin it even if pending gets cleaned later.
    try {
      const downloaded = info && info.downloadedFile;
      if (downloaded && fs.existsSync(downloaded)) {
        const cacheDir = differentialCacheDir();
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.copyFileSync(downloaded, path.join(cacheDir, "installer.exe"));
      }
    } catch {
      /* best-effort — startup seeding covers this too */
    }
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

/* ---------------------------- entry point -------------------------- */
/**
 * NOTE: this MUST stay at the very bottom of the file, after every
 * module-level let/const declaration. Function declarations hoist, but
 * `let`/`const` bindings do not — calling bootstrap() from the top of the
 * file while initUpdater() → loadUpdater() reads `autoUpdaterRef` (declared
 * above) threw "Cannot access 'autoUpdaterRef' before initialization":
 * the v1.3.0 launch crash. Bottom placement makes the whole class of
 * module-ordering crashes impossible.
 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}
