/**
 * STAG — single source of truth for measurement tuning (فاز ۵.۵).
 * These constants used to be duplicated across /api/dns and /api/ping with
 * slightly different numbers; every timeout / bound / baseline now lives here.
 */

/** /api/dns — full DNS health test. */
export const DNS_TUNING = {
  defaultQueryMs: 4000,
  minQueryMs: 1500,
  maxQueryMs: 8000,
  defaultTcpMs: 4000,
  minTcpMs: 1500,
  maxTcpMs: 8000,
  /** hard race cap = query timeout + pad */
  hardPadMs: 2500,
  maxDomains: 8,
  maxTcpPorts: 4,
  /** parallel domain queries through the user's DNS (2.4) */
  concurrency: 4,
  /** baseline answers are cached this long (2.4) */
  baselineTtlMs: 60_000,
} as const;

/** /api/ping — sweep / live-monitor latency probe. */
export const PING_TUNING = {
  defaultQueryMs: 3000,
  minQueryMs: 1000,
  maxQueryMs: 6000,
  defaultTcpMs: 2500,
  minTcpMs: 1000,
  maxTcpMs: 6000,
  maxProbeIps: 3,
  maxProbePorts: 4,
} as const;

/**
 * Reference resolvers the user's DNS answers are compared against (2.1).
 * In Iran, 8.8.8.8 / 1.1.1.1 over plain UDP are frequently poisoned, so the
 * encrypted DoH endpoints are the PRIMARY baseline; UDP is only the fallback.
 *
 * Iran fix (beta.3): the UDP fallback used to be 8.8.8.8 + 1.1.1.1, but
 * 1.1.1.1 is widely blackholed by Iranian ISPs, so a user without a VPN often
 * ended up with a single-server baseline (or none). Level3's 4.2.2.4 answers
 * from Iran without a VPN and is independent of Google — it is now the
 * secondary, with 1.1.1.1 kept as a third (VPN-friendly) opinion.
 */
export const BASELINE_DOH_ENDPOINTS = [
  "https://dns.google/resolve",
  "https://cloudflare-dns.com/dns-query",
] as const;
export const BASELINE_UDP_PRIMARY = "8.8.8.8";
export const BASELINE_UDP_SECONDARY = "4.2.2.4";
export const BASELINE_UDP_TERTIARY = "1.1.1.1";
/** Union of all UDP baselines tried when every DoH endpoint is unreachable. */
export const BASELINE_UDP_FALLBACKS = [
  BASELINE_UDP_PRIMARY,
  BASELINE_UDP_SECONDARY,
  BASELINE_UDP_TERTIARY,
] as const;

/** Clamp a client-provided number into [min,max], falling back to `dflt`. */
export function clamp(n: unknown, min: number, max: number, dflt: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(max, Math.max(min, Math.round(v)));
}
