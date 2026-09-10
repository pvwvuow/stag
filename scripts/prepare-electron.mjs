/**
 * Copies Next.js static assets into the standalone output so the embedded
 * server can serve everything. Cross-platform replacement for `cp -r`.
 * Also vendors electron-updater (+ its production dependency tree) into
 * electron/vendor/node_modules so the packaged app can require it even
 * though node_modules is excluded from the package.
 * Run: node scripts/prepare-electron.mjs   (after `next build`)
 */
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("standalone build not found — run `next build` first");
  process.exit(1);
}

const staticSrc = path.join(root, ".next", "static");
const staticDst = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDst = path.join(standalone, "public");

rmSync(staticDst, { recursive: true, force: true });
cpSync(staticSrc, staticDst, { recursive: true });

rmSync(publicDst, { recursive: true, force: true });
cpSync(publicSrc, publicDst, { recursive: true });

console.log("standalone prepared:", standalone);

/* ------------------ vendor electron-updater (BFS deps) ------------------ */

const vendorRoot = path.join(root, "electron", "vendor", "node_modules");
const nm = path.join(root, "node_modules");

function prodDepsOf(moduleDir) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(moduleDir, "package.json"), "utf8"));
    return Object.keys(pkg.dependencies ?? {});
  } catch {
    return [];
  }
}

function vendorModule(name, queue, visited) {
  const src = path.join(nm, name);
  if (!existsSync(src)) {
    console.warn(`  ! vendor: ${name} not found in node_modules — skipped`);
    return;
  }
  const dst = path.join(vendorRoot, name);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, {
    recursive: true,
    // skip nested node_modules inside the package itself
    filter: (s) => {
      const rel = path.relative(nm, s);
      return rel.split(path.sep)[1] !== "node_modules";
    },
  });
  for (const dep of prodDepsOf(src)) {
    if (!visited.has(dep)) queue.push(dep);
  }
}

try {
  const entry = "electron-updater";
  if (existsSync(path.join(nm, entry))) {
    rmSync(path.join(root, "electron", "vendor"), { recursive: true, force: true });
    mkdirSync(vendorRoot, { recursive: true });
    const visited = new Set([entry]);
    const queue = [entry];
    while (queue.length > 0) {
      const name = queue.shift();
      visited.add(name);
      vendorModule(name, queue, visited);
    }
    console.log(`electron-updater vendored into electron/vendor/node_modules (${visited.size} packages)`);
  } else {
    console.warn("electron-updater not installed — updater will be unavailable in packaged app");
  }
} catch (err) {
  console.warn("vendor copy failed (non-fatal):", err.message);
}
