/**
 * Pure verdict logic for the full DNS test (فاز ۱.۱ — فایل مشترک برای تست یونیت).
 * Reachability-aware: a DNS that resolves domains but points them at
 * unreachable (TCP-dead or private) servers is WORSE than one that plainly
 * fails, because it creates a false "connected" impression.
 */

export type Tone = "ok" | "partial" | "dead" | "misleading" | "unknown";

export interface VerdictSummary {
  total: number;
  resolved: number;
  /** critical domains whose game server is actually reachable */
  reachable?: number;
  /** critical domains that resolve but can't reach the game server */
  misleading?: number;
  skipped?: number;
}

export const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  // "misleading" (resolves but game server unreachable) is the WORST case — it
  // fakes a connection — so it gets the strongest (rose) treatment.
  misleading: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/50",
  dead: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40",
  unknown: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/40",
};

/**
 * Multi-dimensional verdict judging only the CRITICAL (auth + core game)
 * domains, keyed off REACHABILITY (TCP handshake / non-private IP), not mere
 * DNS resolution. Falls back gracefully for older API responses.
 */
export function verdictOf(s: VerdictSummary): { tone: Tone; label: string } {
  // Reachability is authoritative when present; otherwise fall back to resolved.
  const reachable = typeof s.reachable === "number" ? s.reachable : s.resolved;
  const misleading = typeof s.misleading === "number" ? s.misleading : 0;

  let tone: Tone;
  if (s.total === 0) {
    tone = "unknown";
  } else if (reachable === 0 && misleading > 0) {
    // Everything that resolved is actually unreachable → a fake "connected".
    tone = "misleading";
  } else if (reachable === 0) {
    tone = "dead";
  } else if (reachable === s.total) {
    tone = "ok";
  } else {
    // Some critical servers reachable, some not. If the gap is caused by
    // misleading (resolve-without-reach) domains, flag it explicitly.
    tone = misleading > 0 ? "misleading" : "partial";
  }

  const label =
    tone === "ok"
      ? "DNS کار میکنه"
      : tone === "dead"
        ? "DNS جواب نمیده"
        : tone === "misleading"
          ? "resolve می‌شه ولی به سرور بازی نمی‌رسه"
          : tone === "partial"
            ? "ناقص جواب میده"
            : "قضاوت ممکن نبود";
  return { tone, label };
}

/** Iran-internal / private-range IPs can never be tested from an external server. */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  return v6.startsWith("fc") || v6.startsWith("fd") || v6 === "::1";
}
