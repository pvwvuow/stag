import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";
import { PING_TUNING, clamp } from "@/lib/config";
import { localGuard } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_QUERY_TIMEOUT_MS = PING_TUNING.defaultQueryMs;
const MIN_QUERY_TIMEOUT_MS = PING_TUNING.minQueryMs;
const MAX_QUERY_TIMEOUT_MS = PING_TUNING.maxQueryMs;
const DEFAULT_TCP_TIMEOUT_MS = PING_TUNING.defaultTcpMs;
const MIN_TCP_TIMEOUT_MS = PING_TUNING.minTcpMs;
const MAX_TCP_TIMEOUT_MS = PING_TUNING.maxTcpMs;
const MAX_PROBE_IPS = PING_TUNING.maxProbeIps;
const MAX_PROBE_PORTS = PING_TUNING.maxProbePorts;

/**
 * Game-aware ping, tuned for accuracy ("نهایت دقت"):
 *  1. Resolve the SELECTED GAME's real domain through the given DNS (UDP query).
 *  2. TCP-handshake the resolved game-server IPs on the game's REAL ports
 *     (client passes `ports` from its preset; 443 is always appended).
 *     Up to 3 resolved IPs x ports race in parallel — the fastest successful
 *     handshake wins, so CDN round-robin can't produce a pessimistic number.
 *  3. NEW (Iran fix) — TCP-handshake the DNS SERVER ITSELF on port 53. From
 *     Iran without VPN, sanctioned game servers are routinely unreachable,
 *     which used to leave the live monitor with NO number at all. A handshake
 *     to the resolver is a REAL network RTT to the thing STAG optimises, works
 *     for Iranian resolvers without any VPN, and fills the gap honestly
 *     (labelled "پینگ سرور DNS", never passed off as game RTT).
 *  4. Fallback chain: game TCP RTT -> DNS-server TCP:53 RTT -> DNS query time.
 * `server: "system"` uses the OS resolver (after STAG applies a DNS, live
 * monitoring shows the real experience through it); the server probe then
 * targets the first current system server.
 * `privateIp` flags DNS answers pointing into private ranges (routing IP or
 * possible hijack — displayed as a neutral note, not a failure).
 */

function cleanDomain(raw: unknown): string | null {
  let d = String(raw ?? "")
    .trim()
    .toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "");
  d = d.replace(/\.$/, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  if (d.length === 0 || d.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d)) {
    return null;
  }
  return d;
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb"))
      return true; // fe80::/10 link-local
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // fc00::/7 unique-local
    return false; // public/global IPv6 is routable
  }
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true; // not IPv4 — treat as non-public
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function tcpTest(host: string, port: number, timeout: number): Promise<{ ok: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const start = performance.now();
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, latencyMs: ok ? Math.round(performance.now() - start) : null });
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

export async function POST(req: NextRequest) {
  const denied = localGuard(req);
  if (denied) return denied;

  let body: { server?: string; domain?: string; tcp?: boolean; ports?: number[]; queryTimeoutMs?: number; tcpTimeoutMs?: number; systemServers?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const rawServer = (body.server ?? "system").trim();
  const useSystem = rawServer === "system";
  if (!useSystem && net.isIP(rawServer) === 0) {
    return NextResponse.json({ error: `آی‌پی نامعتبر: ${rawServer || "(خالی)"}` }, { status: 400 });
  }
  const domain = cleanDomain(body.domain) ?? "www.google.com";
  const wantTcp = body.tcp === true;
  // Client-tunable timeouts, clamped to safe bounds (2.6).
  const queryTimeout = clamp(body.queryTimeoutMs, MIN_QUERY_TIMEOUT_MS, MAX_QUERY_TIMEOUT_MS, DEFAULT_QUERY_TIMEOUT_MS);
  const tcpTimeout = clamp(body.tcpTimeoutMs, MIN_TCP_TIMEOUT_MS, MAX_TCP_TIMEOUT_MS, DEFAULT_TCP_TIMEOUT_MS);
  // 3.1 — fresh system DNS servers passed by the client (read live from
  // /api/system-dns after every apply/off). The embedded Next server is a
  // long-lived process; c-ares reads the OS resolvers ONCE at boot and caches
  // them, so after `netsh` changes the system DNS this process would keep
  // querying the STALE server and "live monitoring" would report the OLD DNS's
  // ping. Explicitly re-pointing the resolver at the current system servers on
  // every system-mode probe kills that stale cache — the root cause of the
  // "DNS doesn't clear after switching/off" complaint.
  const systemServers = (body.systemServers ?? []).filter(
    (ip) => typeof ip === "string" && net.isIP(ip) !== 0,
  );
  const ports = [
    ...new Set(
      (body.ports ?? [])
        .map((p) => Number(p))
        .filter((p) => Number.isInteger(p) && p > 0 && p < 65536),
    ),
  ];
  if (ports.length === 0 || !ports.includes(443)) ports.push(443);
  const probePorts = ports.slice(0, MAX_PROBE_PORTS);

  const resolver = new Resolver({ timeout: queryTimeout, tries: 1 });
  if (!useSystem) {
    resolver.setServers([rawServer]);
  } else if (systemServers.length > 0) {
    // 3.1 — pin the resolver to the CURRENT system DNS instead of relying on
    // c-ares' boot-time cache, so a just-applied/just-removed DNS is honoured
    // immediately (no stale ping from the previous server).
    try {
      resolver.setServers(systemServers.slice(0, 3));
    } catch {
      /* malformed list — fall back to the process default resolvers */
    }
  }

  const race = <T>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err = new Error("timeout") as NodeJS.ErrnoException;
          err.code = "ETIMEDOUT";
          reject(err);
        }, queryTimeout + 500);
        t.unref?.();
      }),
    ]);

  const start = performance.now();
  try {
    // Prefer IPv4 (TCP probe / familiar behaviour); if the domain has no A
    // record, fall back to AAAA so IPv6-only services are not treated as dead (2.3).
    let answers: string[] = [];
    try {
      answers = (await race(resolver.resolve4(domain, { ttl: false }))) as string[];
    } catch {
      answers = [];
    }
    if (answers.length === 0) {
      answers = (await race(resolver.resolve6(domain, { ttl: false }))) as string[];
    }

    const dnsMs = Math.round(performance.now() - start);
    // Keep any valid IP (v4 or v6); v4 first for the TCP probe order.
    const resolved = (answers as string[])
      .filter((x) => net.isIP(x) !== 0)
      .sort((a, b) => (net.isIP(a) === 4 ? 0 : 1) - (net.isIP(b) === 4 ? 0 : 1));
    const firstIp = resolved[0] ?? null;
    const privateIp = firstIp ? isPrivateIp(firstIp) : false;

    // Realistic game RTT: race TCP handshakes across several resolved IPs and
    // the game's real ports; the fastest success is the honest number.
    // In PARALLEL we handshake the DNS server itself on TCP:53 — a real
    // network RTT to the resolver that stays measurable even when the game
    // servers are blocked (Iran without VPN). Both start at the same tick so
    // the live monitor's 2s cadence never doubles in wall time.
    const probeTarget = !useSystem ? rawServer : (systemServers[0] ?? null);
    const serverProbe: Promise<{ ok: boolean; latencyMs: number | null }> = probeTarget
      ? tcpTest(probeTarget, 53, Math.min(tcpTimeout, 3000))
      : Promise.resolve({ ok: false, latencyMs: null });

    let tcpMs: number | null = null;
    let tcpOk: boolean | null = null;
    let viaPort: number | null = null;
    let viaIp: string | null = null;
    if (wantTcp && resolved.length > 0) {
      const targets: Array<{ ip: string; port: number }> = [];
      for (const ip of resolved.slice(0, MAX_PROBE_IPS)) {
        for (const port of probePorts) targets.push({ ip, port });
      }
      const [results] = await Promise.all([
        Promise.all(targets.map((t) => tcpTest(t.ip, t.port, tcpTimeout))),
        serverProbe,
      ]);
      let best: { ms: number; port: number; ip: string } | null = null;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.ok && r.latencyMs !== null && (!best || r.latencyMs < best.ms)) {
          best = { ms: r.latencyMs, port: targets[i].port, ip: targets[i].ip };
        }
      }
      if (best) {
        tcpOk = true;
        tcpMs = best.ms;
        viaPort = best.port;
        viaIp = best.ip;
      } else {
        tcpOk = false;
      }
    } else {
      await serverProbe;
    }
    const sp = await serverProbe;
    const serverTcpOk = probeTarget ? sp.ok : null;
    const serverTcpMs = probeTarget ? sp.latencyMs : null;
    const serverIp = probeTarget;

    // `ms` is the number STAG surfaces as the headline latency, with a strict
    // honesty chain: real game-server TCP RTT ("tcp") -> DNS-server TCP:53
    // RTT ("server") -> DNS query time ("dns"). `msKind` tells the client
    // exactly which one it is so the UI never passes a DNS lookup off as a
    // game ping ("داده غلط") — and so a sanctioned-game TCP block from Iran
    // still leaves the user a real, labelled number instead of a blank.
    const ms = tcpMs ?? serverTcpMs ?? dnsMs;
    const msKind: "tcp" | "server" | "dns" =
      tcpMs !== null ? "tcp" : serverTcpMs !== null ? "server" : "dns";
    return NextResponse.json({
      ok: true,
      ms,
      msKind,
      dnsMs,
      tcpMs,
      tcpOk,
      serverTcpMs,
      serverTcpOk,
      serverIp,
      viaPort,
      viaIp,
      privateIp,
      server: useSystem ? "system" : rawServer,
      domain,
      ip: firstIp,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return NextResponse.json({
      ok: false,
      ms: null,
      msKind: null,
      dnsMs: null,
      tcpMs: null,
      tcpOk: null,
      serverTcpMs: null,
      serverTcpOk: null,
      serverIp: null,
      viaPort: null,
      viaIp: null,
      privateIp: false,
      server: useSystem ? "system" : rawServer,
      domain,
      ip: null,
      code: e.code ?? "ERROR",
    });
  } finally {
    try {
      resolver.cancel();
    } catch {
      /* noop */
    }
  }
}
