/**
 * Fold-proof runtime platform detection (beta.3).
 *
 * WHY THIS EXISTS: Next.js 16's Turbopack constant-folds `process.platform`
 * to the BUILD machine's platform inside server bundles. STAG builds on Linux
 * CI and runs on Windows, so every `process.platform !== "win32"` check in an
 * API route was compiled into "always true" — the packaged v1.4.0-beta.2 app
 * on Windows reported `supported:false` from /api/system-dns and the power
 * button always answered "پشتیبانی نمی‌شود". (The same fold also short-
 * circuited the POST handler.)
 *
 * A computed member access (`process["plat" + "form"]`) cannot be folded by
 * the bundler's textual define-replacement, so the real runtime value wins.
 * `os.platform()` goes through the same guard for defence in depth.
 */
import os from "node:os";

const KEY_PREFIX = "plat";
const KEY_SUFFIX = "form";

export function runtimePlatform(): string {
  try {
    const p = (process as unknown as Record<string, unknown>)[`${KEY_PREFIX}${KEY_SUFFIX}`];
    if (typeof p === "string" && p.length > 0) return p;
  } catch {
    /* fall through */
  }
  try {
    return os.platform();
  } catch {
    return "unknown";
  }
}

/** True when the app actually runs on Windows (runtime check, not build-time). */
export function isWindowsRuntime(): boolean {
  return runtimePlatform() === "win32";
}
