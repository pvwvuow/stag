import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 30;

const QUERY_TIMEOUT_MS = 3000;
const TCP_TIMEOUT_MS = 2500;

/**
 * Game-aware ping:
 *  1. Resolve the SELECTED GAME's real domain through the given DNS (UDP query).
 *  2. TCP-handshake the first resolved game-server IP on 443 -> realistic RTT
 *     to the game infrastructure, not a generic probe.
 * `server: "system"` uses the OS resolver (after STAG applies a DNS, live
 * monitoring shows the real experience through it).
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
  let body: { server?: string; domain?: string; tcp?: boolean };
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
    const firstIp = (ips as string[])[0] ?? null;

    // Realistic game RTT: TCP handshake to the resolved game server.
    let tcpMs: number | null = null;
    let tcpOk: boolean | null = null;
    if (firstIp && wantTcp) {
      const t = await tcpTest(firstIp, 443);
      tcpOk = t.ok;
      tcpMs = t.latencyMs;
    }

    const ms = tcpMs ?? dnsMs;
    return NextResponse.json({
      ok: true,
      ms,
      dnsMs,
      tcpMs,
      tcpOk,
      server: useSystem ? "system" : rawServer,
      domain,
      ip: firstIp,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return NextResponse.json({
      ok: false,
      ms: null,
      dnsMs: null,
      tcpMs: null,
      tcpOk: null,
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
