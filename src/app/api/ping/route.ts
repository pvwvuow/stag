import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 30;

const PROBE_DOMAIN = "www.google.com";
const QUERY_TIMEOUT_MS = 3000;

/** Lightweight UDP ping: resolve one probe domain via the given DNS, return latency. */
export async function POST(req: NextRequest) {
  let body: { server?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const server = (body.server ?? "").trim();
  if (net.isIP(server) === 0) {
    return NextResponse.json({ error: `آی‌پی نامعتبر: ${server || "(خالی)"}` }, { status: 400 });
  }

  const resolver = new Resolver({ timeout: QUERY_TIMEOUT_MS, tries: 1 });
  resolver.setServers([server]);
  const start = performance.now();
  try {
    await Promise.race([
      resolver.resolve4(PROBE_DOMAIN, { ttl: false }),
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err = new Error("timeout") as NodeJS.ErrnoException;
          err.code = "ETIMEDOUT";
          reject(err);
        }, QUERY_TIMEOUT_MS + 500);
        t.unref?.();
      }),
    ]);
    const ms = Math.round(performance.now() - start);
    return NextResponse.json({ ok: true, ms, server, probe: PROBE_DOMAIN });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return NextResponse.json({
      ok: false,
      ms: null,
      server,
      probe: PROBE_DOMAIN,
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
