import { NextRequest, NextResponse } from "next/server";

/**
 * Local-API guard (فاز ۴.۲ — DNS-rebinding / cross-origin / unauthenticated access).
 *
 * The Next server listens on 127.0.0.1:<port> but ANY page open in any browser
 * can fire requests at that port. Three independent checks keep it safe:
 *
 *  1. Host must be loopback (blocks DNS-rebinding, where a public hostname
 *     resolves to 127.0.0.1 and the browser sends a "public" Host along).
 *  2. If an Origin header is present (all cross-site POSTs carry one), its
 *     host must be loopback too — foreign websites get a 403.
 *  3. In the packaged app the Electron main process generates a per-run
 *     random token and hands it to the renderer through the preload bridge;
 *     every /api request must carry it in `x-stag-token`. In dev/browser
 *     mode the env var is unset and this check is skipped.
 *
 * Returns null when the request is allowed, or a 403 response to return.
 */
export function localGuard(req: NextRequest): NextResponse | null {
  const loopback = (h: string | null) =>
    !!h && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(h.trim());

  if (!loopback(req.headers.get("host"))) return deny();

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (!loopback(new URL(origin).hostname)) return deny();
    } catch {
      return deny();
    }
  }

  const expected = process.env.STAG_API_TOKEN ?? "";
  if (expected !== "" && req.headers.get("x-stag-token") !== expected) return deny();

  return null;
}

function deny(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "دسترسی غیرمجاز به API محلی STAG" },
    { status: 403 },
  );
}
