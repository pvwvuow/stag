/**
 * Copies Next.js static assets into the standalone output so the embedded
 * server can serve everything. Cross-platform replacement for `cp -r`.
 * Run: node scripts/prepare-electron.mjs   (after `next build`)
 */
import { cpSync, existsSync, rmSync } from "node:fs";
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
