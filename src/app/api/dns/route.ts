import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 120;

const BASELINE_DNS = "8.8.8.8";
const BASELINE_DNS_2 = "1.1.1.1";
const QUERY_TIMEOUT_MS = 4000;
const HARD_TIMEOUT_MS = 6500;
const TCP_TIMEOUT_MS = 4000;
const MAX_DOMAINS = 8;
const MAX_TCP_PORTS = 4;

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
  ENODATA: { status: "nodata", message: "رکورد A برای این دامنه ثبت نشده" },
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
  baselineIps: string[];
  /**
   * true  => this DNS returns IPs that neither Google nor Cloudflare return (likely custom routing)
   * false => same IPs as public DNS (pass-through)
   * null  => CDN rotates its answers, comparison unreliable
   */
  differs: boolean | null;
  /** User's DNS AND all baselines failed -> domain is not publicly resolvable, excluded from verdict */
  publiclyUnresolvable: boolean;
  tcp: TcpResult[];
}

/**
 * Coarse network key for an IP: first octet for IPv4 (a /8), first two hextets
 * for IPv6. Robust against CDN round-robin rotation while still distinguishing
 * proxy/routing IPs that live in totally different ranges.
 */
function ipKey(ip: string): string {
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 2).join(":");
  }
  return ip.split(".")[0] ?? ip;
}

function hasPrefixOverlap(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => ipKey(x) === ipKey(y)));
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

/** Resolve an A record through one specific DNS server (real UDP query). */
async function resolveVia(server: string, domain: string): Promise<ResolveResult> {
  let resolver: Resolver | null = null;
  try {
    resolver = new Resolver({ timeout: QUERY_TIMEOUT_MS, tries: 1 });
    resolver.setServers([server]);
    const start = performance.now();

    // Hard safety timeout implemented as a race (timer unref'd so it won't keep loop alive)
    const records = await Promise.race([
      resolver.resolve4(domain, { ttl: true }),
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err = new Error("timeout") as NodeJS.ErrnoException;
          err.code = "ETIMEDOUT";
          reject(err);
        }, HARD_TIMEOUT_MS);
        t.unref?.();
      }),
    ]);

    const latencyMs = Math.round(performance.now() - start);
    const ips = (records as Array<{ address: string }>).map((r) => r.address);
    if (ips.length === 0) {
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

/** Attempt a TCP handshake against host:port (supplementary connectivity check). */
function tcpTest(host: string, port: number): Promise<TcpResult> {
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
    socket.setTimeout(TCP_TIMEOUT_MS);
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

export async function POST(req: NextRequest) {
  let body: { dns?: string; domains?: string[]; tcpPorts?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const dns = (body.dns ?? "").trim();
  if (net.isIP(dns) === 0) {
    return NextResponse.json({ error: `آی‌پی DNS نامعتبر است: ${dns || "(خالی)"}` }, { status: 400 });
  }

  const domains: string[] = [];
  for (const raw of body.domains ?? []) {
    const d = cleanDomain(String(raw));
    if (d && !domains.includes(d)) domains.push(d);
    if (domains.length >= MAX_DOMAINS) break;
  }
  if (domains.length === 0) {
    return NextResponse.json({ error: "هیچ دامنه معتبری برای تست وجود ندارد" }, { status: 400 });
  }

  const tcpPorts = (body.tcpPorts ?? [])
    .map((p) => Number(p))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
    .slice(0, MAX_TCP_PORTS);

  // 1) Baselines: Google DNS twice (to detect CDN round-robin rotation) + Cloudflare once.
  //    "Custom routing" is only flagged when the user's DNS differs from BOTH public DNSes.
  const baselineA = await Promise.all(domains.map((d) => resolveVia(BASELINE_DNS, d)));
  const baselineB = await Promise.all(domains.map((d) => resolveVia(BASELINE_DNS, d)));
  const baselineC = await Promise.all(domains.map((d) => resolveVia(BASELINE_DNS_2, d)));

  // 2) Sequential queries through the user's DNS for accurate latency measurement
  const results: DomainResult[] = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const r = await resolveVia(dns, domain);
    const baselineIps = baselineA[i].ips;

    let differs: boolean | null = null;
    if (r.ips.length > 0 && baselineIps.length > 0) {
      const baseB = baselineB[i].ips;
      const baseC = baselineC[i].ips;
      if (baseB.length > 0 && !hasPrefixOverlap(baselineIps, baseB)) {
        // Even at prefix level the baseline rotates -> comparison unreliable
        differs = null;
      } else {
        const combinedBaseline = [...baselineIps, ...baseC];
        differs = !hasPrefixOverlap(r.ips, combinedBaseline);
      }
    }

    let tcp: TcpResult[] = [];
    if (r.ips.length > 0 && tcpPorts.length > 0) {
      tcp = await Promise.all(tcpPorts.map((p) => tcpTest(r.ips[0], p)));
    }

    results.push({
      domain,
      status: r.status,
      latencyMs: r.latencyMs,
      ips: r.ips,
      error: r.error,
      baselineIps,
      differs,
      publiclyUnresolvable:
        r.status !== "ok" &&
        baselineA[i].ips.length === 0 &&
        baselineB[i].ips.length === 0 &&
        baselineC[i].ips.length === 0,
      tcp,
    });
  }

  const judgeable = results.filter((r) => !r.publiclyUnresolvable);
  const resolvedCount = judgeable.filter((r) => r.status === "ok").length;
  const latencies = results
    .map((r) => r.latencyMs)
    .filter((x): x is number => typeof x === "number");

  return NextResponse.json({
    dns,
    baseline: BASELINE_DNS,
    results,
    summary: {
      total: judgeable.length,
      resolved: resolvedCount,
      skipped: results.length - judgeable.length,
      avgLatency: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      routingActive: results.some((r) => r.differs === true),
    },
  });
}
