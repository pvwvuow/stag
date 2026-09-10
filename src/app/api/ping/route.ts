import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 30;

const QUERY_TIMEOUT_MS = 3000;
const TCP_TIMEOUT_MS = 2500;
const MAX_PROBE_IPS = 3;
const MAX_PROBE_PORTS = 4;

/**
 * Game-aware ping, tuned for accuracy ("نهایت دقت"):
 *  1. Resolve the SELECTED GAME's real domain through the given DNS (UDP query).
 *  2. TCP-handshake the resolved game-server IPs on the game's REAL ports
 *     (client passes `ports` from its preset; 443 is always appended).
 *     Up to 3 resolved IPs x ports race in parallel — the fastest successful
 *     handshake wins, so CDN round-robin can't produce a pessimistic number.
 *  3. Fallback chain: game TCP RTT -> DNS query time (still informative).
 * `server: "system"` uses the OS resolver (after STAG applies a DNS, live
 * monitoring shows the real experience through it).
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

function tcpTest(host: string, port: number): Promise<{ ok: boolean; latencyMs: number | null }> {
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
  let body: { server?: string; domain?: string; tcp?: boolean; ports?: number[] };
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
  const ports = [
    ...new Set(
      (body.ports ?? [])
        .map((p) => Number(p))
        .filter((p) => Number.isInteger(p) && p > 0 && p < 65536),
    ),
  ];
  if (ports.length === 0 || !ports.includes(443)) ports.push(443);
  const probePorts = ports.slice(0, MAX_PROBE_PORTS);

  const resolver = new Resolver({ timeout: QUERY_TIMEOUT_MS, tries: 1 });
  if (!useSystem) resolver.setServers([rawServer]);

  const start = performance.now();
  try {
    const ips = await Promise.race([
      resolver.resolve4(domain, { ttl: false }),
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err = new Error("timeout") as NodeJS.ErrnoException;
          err.code = "ETIMEDOUT";
          reject(err);
        }, QUERY_TIMEOUT_MS + 500);
        t.unref?.();
      }),
    ]);

    const dnsMs = Math.round(performance.now() - start);
    const resolved = (ips as string[]).filter((x) => net.isIP(x) === 4);
    const firstIp = resolved[0] ?? null;
    const privateIp = firstIp ? isPrivateIp(firstIp) : false;

    // Realistic game RTT: race TCP handshakes across several resolved IPs and
    // the game's real ports; the fastest success is the honest number.
    let tcpMs: number | null = null;
    let tcpOk: boolean | null = null;
    let viaPort: number | null = null;
    let viaIp: string | null = null;
    if (wantTcp && resolved.length > 0) {
      const targets: Array<{ ip: string; port: number }> = [];
      for (const ip of resolved.slice(0, MAX_PROBE_IPS)) {
        for (const port of probePorts) targets.push({ ip, port });
      }
      const results = await Promise.all(targets.map((t) => tcpTest(t.ip, t.port)));
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
    }

    // `ms` is the number STAG surfaces as the headline latency. When a real
    // game-server TCP handshake succeeded it IS the game RTT; otherwise we fall
    // back to the DNS query time — which is a DIFFERENT, much smaller metric.
    // `msKind` tells the client exactly which one it is so the UI never passes
    // a DNS lookup off as a game ping ("داده غلط").
    const ms = tcpMs ?? dnsMs;
    const msKind: "tcp" | "dns" = tcpMs !== null ? "tcp" : "dns";
    return NextResponse.json({
      ok: true,
      ms,
      msKind,
      dnsMs,
      tcpMs,
      tcpOk,
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
