/**
 * Regression test for the v1.3.0 launch crash:
 *   "ReferenceError: Cannot access 'autoUpdaterRef' before initialization"
 *
 * Loads electron/main.cjs in plain Node with a stubbed `electron` module and
 * exercises the REAL module-evaluation order, including the updater path
 * (GAMEDNS_UPDATER_FORCE=1). If any module-level `let`/`const` is touched
 * before its declaration (TDZ), this throws — exactly like the packaged app.
 *
 * Usage: node scripts/test-main-order.mjs
 * Exit 0 = pass, 1 = fail.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const mainCjs = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "electron", "main.cjs");
const src = fs.readFileSync(mainCjs, "utf8");

/* ---------- static assertions (artifact-level guarantee) ---------- */
const declLines = [];
for (const pattern of [
  /^const UPDATE_STATE = /m,
  /^let autoUpdaterRef = /m,
  /^let win = /m,
  /^let nextProc = /m,
]) {
  const m = src.match(pattern);
  if (!m) {
    console.error(`FAIL: declaration not found in main.cjs: ${pattern}`);
    process.exit(1);
  }
  declLines.push(src.slice(0, m.index).split("\n").length);
}
const entryRe = /^const gotLock = app\.requestSingleInstanceLock\(\);/m;
const entryMatch = src.match(entryRe);
if (!entryMatch) {
  console.error("FAIL: entry point (requestSingleInstanceLock) not found");
  process.exit(1);
}
const entryLine = src.slice(0, entryMatch.index).split("\n").length;
const lastDecl = Math.max(...declLines);
if (entryLine < lastDecl) {
  console.error(
    `FAIL: entry point (line ${entryLine}) runs before a module declaration (line ${lastDecl}).\n` +
      `The entry block must stay at the BOTTOM of main.cjs (v1.3.0 TDZ crash regression).`
  );
  process.exit(1);
}
console.log(`static check OK: entry at line ${entryLine} > last top-level declaration at line ${lastDecl}`);

/* ---------- runtime execution with stubbed electron ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stag-main-order-"));
fs.mkdirSync(path.join(tmp, "node_modules", "electron"), { recursive: true });
fs.writeFileSync(
  path.join(tmp, "node_modules", "electron", "package.json"),
  JSON.stringify({ name: "electron", main: "index.js" })
);
fs.writeFileSync(
  path.join(tmp, "node_modules", "electron", "index.js"),
  `// minimal stub — just enough surface for main.cjs to evaluate + bootstrap
  const listeners = {};
  const app = {
    isPackaged: true, // simulate the PACKAGED app (dev returns early otherwise)
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: () => true,
    on: (ev, cb) => { (listeners[ev] ||= []).push(cb); if (ev === "window-all-closed") setTimeout(cb, 30); },
    quit: () => process.exit(0),
    getPath: () => tmp,
    getVersion: () => "0.0.0-test",
  };
  module.exports = {
    app,
    BrowserWindow: class { constructor() { this.webContents = { send() {}, capturePage: async () => ({ toPNG: () => Buffer.alloc(0) }) }; } once() {} on() {} loadURL() {} isDestroyed() { return true; } },
    ipcMain: { on() {}, handle() {} },
    shell: { openExternal: async () => {} },
  };`
);

let stdout = "";
try {
  // Copy main.cjs into the sandbox so require("electron") resolves to the
  // stub (resolution starts from the file's own directory).
  const sandboxMain = path.join(tmp, "main.cjs");
  fs.copyFileSync(mainCjs, sandboxMain);
  stdout = execFileSync(
    process.execPath,
    [sandboxMain],
    {
      cwd: tmp,
      timeout: 20000,
      env: {
        ...process.env,
        NODE_PATH: path.join(tmp, "node_modules"),
        GAMEDNS_UPDATER_FORCE: "1", // force the real packaged updater path
        ELECTRON_RUN_AS_NODE: undefined,
      },
      encoding: "utf8",
    }
  ).toString();
  console.log("--- main.cjs evaluated without crash ---");
  console.log(stdout.trim().split("\n").slice(-6).join("\n"));
  if (/ReferenceError|before initialization|TypeError/.test(stdout)) {
    console.error("FAIL: runtime error leaked during evaluation");
    process.exit(1);
  }
  console.log("PASS: main.cjs module order + forced updater init are crash-free");
  process.exit(0);
} catch (err) {
  console.error("FAIL: main.cjs crashed during evaluation:");
  console.error(String(err.stdout || ""));
  console.error(String(err.stderr || err.message));
  process.exit(1);
}
