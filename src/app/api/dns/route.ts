import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 120;

/* ------------------------------- tuning ------------------------------- */
// Fixed ceilings; the effective per-query timeout is client-tunable within
// [MIN_QUERY_TIMEOUT_MS, MAX_QUERY_TIMEOUT_MS] (Phase 2.6 — adapt to Iran's
// jittery links without letting a caller hang the worker).
const DEFAULT_QUERY_TIMEOUT_MS = 4000;
const MIN_QUERY_TIMEOUT_MS = 1500;
const MAX_QUERY_TIMEOUT_MS = 8000;
const DEFAULT_TCP_TIMEOUT_MS = 4000;
const MIN_TCP_TIMEOUT_MS = 1500;
const MAX_TCP_TIMEOUT_MS = 8000;
const HARD_TIMEOUT_PAD_MS = 2500; // hard race cap = query timeout + pad
const MAX_DOMAINS = 8;
const MAX_TCP_PORTS = 4;
const DNS_CONCURRENCY = 4; // parallel domain queries through the user's DNS (2.4)
const BASELINE_TTL_MS = 60_000; // baseline answers are cached this long (2.4)

// Public UDP baselines used as a fallback when DoH is unavailable.
const BASELINE_DNS = "8.8.8.8";
const BASELINE_DNS_2 = "1.1.1.1";
// DoH endpoints (2.1). In Iran, 8.8.8.8 / 1.1.1.1 over plain UDP are frequently
// poisoned/redirected, so a UDP baseline can itself be tainted and produce a
// FALSE "custom routing" verdict. Encrypted DoH is far harder to tamper with,
// so it is the PRIMARY source of truth; UDP is only the fallback.
const DOH_ENDPOINTS = [
  "https://dns.google/resolve",
  "https://cloudflare-dns.com/dns-query",
];

type DnsStatus =
  | "ok"
  | "nxdomain"
  | "servfail"
  | "refused"
  | "timeout"
  | "nodata"
  | "error";

const ERROR_MAP: Record<string, { status: DnsStatus; message: string }> = {
  ETIMEOUT: { status: "timeout", message: "پاسخی از DNS دریافت نشد (تایم‌اوت)" },
  ETIMEDOUT: { status: "timeout", message: "پاسخی از DNS دریافت نشد (تایم‌اوت)" },
  ENOTFOUND: { status: "nxdomain", message: "دامنه پیدا نشد (NXDOMAIN)" },
  ENODATA: { status: "nodata", message: "رکورد A/AAAA برای این دامنه ثبت نشده" },
  ESERVFAIL: { status: "servfail", message: "سرور DNS خطای SERVFAIL داد" },
  EREFUSED: { status: "refused", message: "سرور DNS درخواست را رد کرد (REFUSED)" },
  ECONNREFUSED: { status: "refused", message: "اتصال به سرور DNS رد شد" },
  ENETUNREACH: { status: "error", message: "مسیر شبکه‌ای به این DNS در دسترس نیست" },
};

interface ResolveResult {
  status: DnsStatus;
  latencyMs: number | null;
  ips: string[];
  error: string | null;
}

interface TcpResult {
  port: number;
  ok: boolean;
  latencyMs: number | null;
}

interface DomainResult extends ResolveResult {
  domain: string;
  /** Whether this domain is decisive for actually PLAYING (auth/core game). */
  critical: boolean;
  baselineIps: string[];
  /** Source that produced the baseline: encrypted DoH (trusted) or plain UDP (fallback). */
  baselineSource: "doh" | "udp" | "none";
  /**
   * true  => this DNS returns IPs that no trusted baseline returns (likely custom routing)
   * false => same network as a public/trusted baseline (pass-through)
   * null  => baselines rotate too much to compare reliably
   */
  differs: boolean | null;
  /** User's DNS AND all baselines failed -> domain is not publicly resolvable, excluded from verdict */
  publiclyUnresolvable: boolean;
  /** DNS answered with an IP in a private/unroutable range (internal routing / possible hijack). */
  privateAnswer: boolean;
  /**
   * The domain resolved but the game server is NOT actually reachable — either a
   * TCP handshake failed or it points at a private/unroutable IP. This is WORSE
   * than a plain failure because it creates a false "it's connected" impression.
   */
  misleading: boolean;
  /**
   * Best-effort reachability of the resolved server:
   *  true  => resolved AND a TCP handshake succeeded (or no TCP test but public IP)
   *  false => resolved but unreachable (TCP failed / private IP)
   *  null  => did not resolve, reachability is moot
   */
  reachable: boolean | null;
  /** true when the winning answer(s) came from an AAAA (IPv6) record (2.3). */
  ipv6: boolean;
  tcp: TcpResult[];
}

/**
 * Network key for an IP used to compare the user's DNS answer with a baseline.
 *  - IPv4: first THREE octets (a /24). /8 (Phase-1) was far too coarse — 34.x
 *    and 35.x (both Google Cloud) looked different while two unrelated ranges
 *    inside one /8 collided. /24 is a pragmatic middle ground without needing
 *    an offline ASN database. (2.2)
 *  - IPv6: first THREE hextets (~/48, the typical site-allocation boundary). (2.2/2.3)
 */
function ipKey(ip: string): string {
  if (ip.includes(":")) {
    return expandV6Prefix(ip);
  }
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : ip;
}

/** Normalise an IPv6 address and take its first three hextets (~/48). */
function expandV6Prefix(ip: string): string {
  // Handle "::" compression by expanding to 8 hextets, then keep the first 3.
  const [head, tail] = ip.toLowerCase().split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  let full: string[];
  if (ip.includes("::")) {
    const missing = 8 - headParts.length - tailParts.length;
    full = [...headParts, ...Array(Math.max(0, missing)).fill("0"), ...tailParts];
  } else {
    full = ip.toLowerCase().split(":");
  }
  return full.slice(0, 3).map((h) => h.replace(/^0+/, "") || "0").join(":");
}

function hasPrefixOverlap(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => ipKey(x) === ipKey(y)));
}

/**
 * Private / unroutable address — can never be reached from the tester.
 * IPv4 private/reserved ranges, plus IPv6 loopback (::1), link-local (fe80::/10)
 * and unique-local (fc00::/7). Public IPv6 (incl. 2xxx global unicast) is NOT
 * private, so AAAA answers are judged fairly (2.3).
 */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb"))
      return true; // fe80::/10 link-local
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // fc00::/7 unique-local
    return false;
  }
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true; // unparseable — treat as non-public for reachability
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function cleanDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, ""); // strip protocol
  d = d.replace(/\.$/, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  if (d.length === 0 || d.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d)) {
    return null;
  }
  return d;
}

function clamp(n: unknown, min: number, max: number, dflt: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Resolve a domain through one specific DNS server (real UDP query), asking for
 * BOTH A and AAAA records (2.3). IPv4 answers are listed first so downstream
 * `firstIp`/TCP logic keeps its familiar behaviour.
 */
async function resolveVia(server: string, domain: string, queryTimeout: number): Promise<ResolveResult> {
  let resolver: Resolver | null = null;
  const hardTimeout = queryTimeout + HARD_TIMEOUT_PAD_MS;
  try {
    resolver = new Resolver({ timeout: queryTimeout, tries: 1 });
    resolver.setServers([server]);
    const start = performance.now();

    const race = <T>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => {
            const err = new Error("timeout") as NodeJS.ErrnoException;
            err.code = "ETIMEDOUT";
            reject(err);
          }, hardTimeout);
          t.unref?.();
        }),
      ]);

    // Query A and AAAA together; tolerate one failing (e.g. no AAAA record).
    const [v4, v6] = await Promise.allSettled([
      race(resolver.resolve4(domain, { ttl: false })),
      race(resolver.resolve6(domain, { ttl: false })),
    ]);

    const latencyMs = Math.round(performance.now() - start);
    const ips4 = v4.status === "fulfilled" ? (v4.value as string[]) : [];
    const ips6 = v6.status === "fulfilled" ? (v6.value as string[]) : [];
    const ips = [...ips4, ...ips6];

    if (ips.length === 0) {
      // Surface the most meaningful error from whichever query rejected.
      const rej = [v4, v6].find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      if (rej) {
        const e = rej.reason as NodeJS.ErrnoException;
        const mapped = e?.code ? ERROR_MAP[e.code] : undefined;
        return {
          status: mapped?.status ?? "error",
          latencyMs: null,
          ips: [],
          error: mapped?.message ?? e?.message ?? "خطای ناشناخته در کوئری DNS",
        };
      }
      return { status: "nodata", latencyMs, ips: [], error: ERROR_MAP.ENODATA.message };
    }
    return { status: "ok", latencyMs, ips, error: null };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const mapped = e.code ? ERROR_MAP[e.code] : undefined;
    return {
      status: mapped?.status ?? "error",
      latencyMs: null,
      ips: [],
      error: mapped?.message ?? e.message ?? "خطای ناشناخته در کوئری DNS",
    };
  } finally {
    try {
      resolver?.cancel();
    } catch {
      /* noop */
    }
  }
}

/**
 * Resolve a domain via encrypted DoH (2.1). Returns both A (type 1) and
 * AAAA (type 28) answers. Used to build a tamper-resistant baseline.
 */
async function resolveDoh(endpoint: string, domain: string, timeout: number): Promise<string[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  t.unref?.();
  try {
    const out: string[] = [];
    for (const type of ["A", "AAAA"]) {
      const url = `${endpoint}?name=${encodeURIComponent(domain)}&type=${type}`;
      const r = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: ctrl.signal,
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { Answer?: Array<{ type: number; data: string }> };
      for (const a of j.Answer ?? []) {
        // type 1 = A, 28 = AAAA; skip CNAME (5) etc.
        if ((a.type === 1 || a.type === 28) && net.isIP(a.data) !== 0) out.push(a.data);
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/* ----------------------------- baseline cache ----------------------------- */
// Module-level cache so repeated full-tests (each service hits /api/dns) don't
// re-resolve the same baselines every time — the biggest source of the 1300–
// 2300ms full-test times noted in the audit (2.4).

interface BaselineEntry {
  ips: string[];
  source: "doh" | "udp" | "none";
  at: number;
}
const baselineCache = new Map<string, BaselineEntry>();

/**
 * Trusted baseline for a domain: prefer encrypted DoH (any endpoint that
 * answers), fall back to plain-UDP public resolvers only if every DoH failed.
 * Cached for BASELINE_TTL_MS. (2.1 + 2.4 + 2.5)
 */
async function getBaseline(domain: string, queryTimeout: number): Promise<BaselineEntry> {
  const cached = baselineCache.get(domain);
  if (cached && Date.now() - cached.at < BASELINE_TTL_MS) return cached;

  // Try all DoH endpoints in parallel; union their answers for a robust,
  // rotation-tolerant baseline (2.5).
  const dohResults = await Promise.all(DOH_ENDPOINTS.map((e) => resolveDoh(e, domain, queryTimeout)));
  const dohIps = Array.from(new Set(dohResults.flat()));
  let entry: BaselineEntry;
  if (dohIps.length > 0) {
    entry = { ips: dohIps, source: "doh", at: Date.now() };
  } else {
    // Fallback: two independent public UDP resolvers, unioned.
    const [a, b] = await Promise.all([
      resolveVia(BASELINE_DNS, domain, queryTimeout),
      resolveVia(BASELINE_DNS_2, domain, queryTimeout),
    ]);
    const udpIps = Array.from(new Set([...a.ips, ...b.ips]));
    entry = { ips: udpIps, source: udpIps.length ? "udp" : "none", at: Date.now() };
  }
  baselineCache.set(domain, entry);
  return entry;
}

/** Attempt a TCP handshake against host:port (supplementary connectivity check). */
function tcpTest(host: string, port: number, timeout: number): Promise<TcpResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const start = performance.now();
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, ok, latencyMs: ok ? Math.round(performance.now() - start) : null });
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

/** Run async tasks with a bounded concurrency, preserving input order (2.4). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function POST(req: NextRequest) {
  let body: {
    dns?: string;
    domains?: string[];
    critical?: string[];
    tcpPorts?: number[];
    queryTimeoutMs?: number;
    tcpTimeoutMs?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const dns = (body.dns ?? "").trim();
  if (net.isIP(dns) === 0) {
    return NextResponse.json({ error: `آی‌پی DNS نامعتبر است: ${dns || "(خالی)"}` }, { status: 400 });
  }

  // Client-tunable, clamped to safe bounds (2.6).
  const queryTimeout = clamp(body.queryTimeoutMs, MIN_QUERY_TIMEOUT_MS, MAX_QUERY_TIMEOUT_MS, DEFAULT_QUERY_TIMEOUT_MS);
  const tcpTimeout = clamp(body.tcpTimeoutMs, MIN_TCP_TIMEOUT_MS, MAX_TCP_TIMEOUT_MS, DEFAULT_TCP_TIMEOUT_MS);

  const domains: string[] = [];
  for (const raw of body.domains ?? []) {
    const d = cleanDomain(String(raw));
    if (d && !domains.includes(d)) domains.push(d);
    if (domains.length >= MAX_DOMAINS) break;
  }
  if (domains.length === 0) {
    return NextResponse.json({ error: "هیچ دامنه معتبری برای تست وجود ندارد" }, { status: 400 });
  }

  const criticalSet = new Set(
    (body.critical ?? [])
      .map((h) => cleanDomain(String(h)))
      .filter((h): h is string => !!h),
  );
  const isCritical = (host: string) => (criticalSet.size === 0 ? true : criticalSet.has(host));

  const tcpPorts = (body.tcpPorts ?? [])
    .map((p) => Number(p))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
    .slice(0, MAX_TCP_PORTS);

  // Baselines (trusted DoH, cached) + the user's DNS answers, both computed with
  // bounded concurrency instead of the old fully-sequential path (2.4).
  const [baselines, userResults] = await Promise.all([
    mapLimit(domains, DNS_CONCURRENCY, (d) => getBaseline(d, queryTimeout)),
    mapLimit(domains, DNS_CONCURRENCY, (d) => resolveVia(dns, d, queryTimeout)),
  ]);

  // TCP probes depend on the user's resolved IPs, so run them after — but still
  // in parallel across domains.
  const results: DomainResult[] = await mapLimit(domains, DNS_CONCURRENCY, async (domain, i) => {
    const r = userResults[i];
    const baseline = baselines[i];
    const baselineIps = baseline.ips;

    // differs: does the user's DNS answer live in a different /24 (or /48) than
    // any trusted-baseline answer? null when we have no baseline to compare.
    let differs: boolean | null = null;
    if (r.ips.length > 0 && baselineIps.length > 0) {
      differs = !hasPrefixOverlap(r.ips, baselineIps);
    }

    let tcp: TcpResult[] = [];
    if (r.ips.length > 0 && tcpPorts.length > 0) {
      const firstV4 = r.ips.find((ip) => net.isIP(ip) === 4) ?? r.ips[0];
      tcp = await Promise.all(tcpPorts.map((p) => tcpTest(firstV4, p, tcpTimeout)));
    }

    const resolved = r.status === "ok" && r.ips.length > 0;
    const privateAnswer = resolved && r.ips.every((ip) => isPrivateIp(ip));
    let reachable: boolean | null;
    if (!resolved) {
      reachable = null;
    } else if (privateAnswer) {
      reachable = false;
    } else if (tcp.length > 0) {
      reachable = tcp.some((t) => t.ok);
    } else {
      reachable = true;
    }
    const misleading = resolved && reachable === false;
    const ipv6 = resolved && r.ips.every((ip) => net.isIP(ip) === 6);

    return {
      domain,
      critical: isCritical(domain),
      status: r.status,
      latencyMs: r.latencyMs,
      ips: r.ips,
      error: r.error,
      baselineIps,
      baselineSource: baseline.source,
      differs,
      publiclyUnresolvable: r.status !== "ok" && baselineIps.length === 0,
      privateAnswer,
      misleading,
      reachable,
      ipv6,
      tcp,
    };
  });

  const judgeable = results.filter((r) => !r.publiclyUnresolvable);
  const judgeableCritical = judgeable.filter((r) => r.critical);
  const verdictSet = judgeableCritical.length > 0 ? judgeableCritical : judgeable;

  const resolvedCount = verdictSet.filter((r) => r.status === "ok").length;
  const reachableCount = verdictSet.filter((r) => r.reachable === true).length;
  const misleadingCount = verdictSet.filter((r) => r.misleading).length;

  const latencies = results
    .map((r) => r.latencyMs)
    .filter((x): x is number => typeof x === "number");

  return NextResponse.json({
    dns,
    baseline: results.some((r) => r.baselineSource === "doh") ? "DoH" : BASELINE_DNS,
    results,
    summary: {
      total: verdictSet.length,
      resolved: resolvedCount,
      reachable: reachableCount,
      misleading: misleadingCount,
      skipped: results.length - judgeable.length,
      avgLatency: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      routingActive: results.some((r) => r.differs === true),
    },
  });
}
