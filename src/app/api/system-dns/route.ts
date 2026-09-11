import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { localGuard } from "@/lib/guard";
import { isWindowsRuntime, runtimePlatform } from "@/lib/platform";
import {
  buildScript,
  sanitizeAlias,
  IPV4_RE,
  type DnsSnapshot,
} from "@/lib/netsh-script";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Real system-DNS management (Windows).
 *
 * GET  -> detect the default-route network adapter + its active DNS servers.
 *         (also works when the user set a DNS manually outside STAG:
 *          servers.length > 0  =>  "DNS is ON")
 * POST -> apply (netsh static primary + secondary), off (restore the DNS the
 *         user had BEFORE STAG's first apply — not a blind DHCP reset),
 *         flush (ipconfig /flushdns). Changing DNS needs admin rights, so the
 *         heavy lifting runs inside an elevated PowerShell (UAC prompt) that
 *         writes a result file we read back.
 *
 * off-restore (3.3): before STAG's first apply we snapshot the adapter's
 * current DNS config (dhcp vs. a manual server list) to a small state file.
 * `off` reads that snapshot and restores exactly it, so a user who had a
 * manual DNS keeps it instead of silently being forced onto DHCP. The
 * snapshot is cleared once restored.
 */

const IPV4 = IPV4_RE;

/** Where the pre-apply DNS snapshot lives (per-user temp, survives app restart). */
const SNAPSHOT_FILE = path.join(os.tmpdir(), "stag-dns-snapshot.json");

function readSnapshot(): DnsSnapshot | null {
  try {
    const raw = fs.readFileSync(SNAPSHOT_FILE, "utf8");
    const s = JSON.parse(raw) as Partial<DnsSnapshot>;
    if (
      s &&
      typeof s.alias === "string" &&
      (s.mode === "dhcp" || s.mode === "static") &&
      Array.isArray(s.servers)
    ) {
      return { alias: s.alias, mode: s.mode, servers: s.servers.filter((x) => typeof x === "string") };
    }
  } catch {
    /* no snapshot yet */
  }
  return null;
}

function writeSnapshot(snap: DnsSnapshot): void {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap), "utf8");
  } catch {
    /* best-effort — restore just falls back to DHCP if this fails */
  }
}

function clearSnapshot(): void {
  try {
    fs.unlinkSync(SNAPSHOT_FILE);
  } catch {
    /* noop */
  }
}

function execPowershell(
  args: string[],
  timeout: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      args,
      { timeout, windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        // Non-zero exit still carries useful stdout; only reject on spawn-class errors.
        if (err && !stdout && !stderr) {
          reject(err);
          return;
        }
        resolve({
          code: err ? ((err as NodeJS.ErrnoException & { status?: number }).status ?? 1) : 0,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      },
    );
  });
}

async function ps(command: string, timeout = 30000): Promise<string> {
  const r = await execPowershell(["-NoProfile", "-NonInteractive", "-Command", command], timeout);
  return r.stdout.trim();
}

/**
 * Run a .ps1 script file DIRECTLY (no elevation). When STAG itself runs
 * elevated (Run-as-administrator, or an admin shell), netsh inside succeeds —
 * no UAC prompt, no Start-Process round-trip. When STAG is NOT elevated the
 * script still runs and reports "requires elevation" in its result file, which
 * the caller turns into the UAC path. This direct-first order is the fix for
 * "دکمه روشن/خاموش کار نمی‌کند": one fragile launch path (Start-Process -Verb
 * RunAs) is no longer the ONLY way the action can ever succeed.
 */
async function runScriptDirect(scriptFile: string, timeout = 60000): Promise<void> {
  await execPowershell(
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptFile],
    timeout,
  );
}

/** True when a netsh/PowerShell error text means "needs admin rights". */
function needsElevation(msg: string): boolean {
  return /elevation|elevated|access is denied|access denied|administrator|RunAs|انکار شد/i.test(
    msg ?? "",
  );
}

/** Ordered adapter aliases: default-route adapters first, then the rest. */
async function listAdapters(): Promise<string[]> {
  const out = await ps(`
    $def = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
      Sort-Object RouteMetric | Select-Object -ExpandProperty InterfaceAlias -Unique
    $up = Get-NetAdapter -ErrorAction SilentlyContinue |
      Where-Object { $_.Status -eq 'Up' } | Select-Object -ExpandProperty Name
    $ordered = @($def | Where-Object { $up -contains $_ }) + @($up | Where-Object { $def -notcontains $_ })
    $ordered | Select-Object -First 6 | ConvertTo-Json -Compress
  `);
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    if (typeof parsed === "string") return [parsed];
    return [];
  } catch {
    return out
      .split("\n")
      .map((l) => l.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
}

/** alias -> active IPv4 DNS servers (what the OS actually uses). */
async function dnsMap(): Promise<Record<string, string[]>> {
  const out = await ps(`
    Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.ServerAddresses.Count -gt 0 } |
      ForEach-Object { [pscustomobject]@{ a = $_.InterfaceAlias; s = ($_.ServerAddresses -join ',') } } |
      ConvertTo-Json -Compress
  `);
  const map: Record<string, string[]> = {};
  if (!out) return map;
  try {
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    for (const row of rows) {
      if (row && typeof row.a === "string") {
        map[row.a] = String(row.s ?? "")
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean);
      }
    }
  } catch {
    /* keep empty */
  }
  return map;
}

async function detect() {
  const aliases = await listAdapters();
  const map = await dnsMap();
  const interfaces = aliases.map((alias) => ({ alias, servers: map[alias] ?? [] }));
  const primary = interfaces.find((i) => i.servers.length > 0) ?? interfaces[0] ?? null;
  return { interfaces, primary };
}

/**
 * Read whether an adapter's DNS is DHCP-assigned or statically configured.
 * `netsh interface ip show dnsservers` is read-only (no elevation needed) and
 * prints either "Statically Configured DNS Servers" or "DNS servers configured
 * through DHCP". This lets `off` restore the user's real pre-STAG mode (3.3).
 */
async function probeDnsMode(alias: string): Promise<DnsSnapshot> {
  const safe = alias.replace(/[`'"$;]/g, "");
  const out = await ps(
    `chcp 437 | Out-Null; netsh interface ip show dnsservers name="${safe}"`,
    15000,
  ).catch(() => "");
  const servers = (out.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []).filter((ip) => IPV4.test(ip));
  // "DHCP" appears only in the DHCP-assigned wording; static config never mentions it.
  const mode: "dhcp" | "static" = /through dhcp/i.test(out) ? "dhcp" : "static";
  return { alias, mode: servers.length === 0 ? "dhcp" : mode, servers };
}

export async function GET(req: NextRequest) {
  const denied = localGuard(req);
  if (denied) return denied;

  /* beta.3: MUST be a runtime check — the old `process.platform !== "win32"`
   * was constant-folded by Turbopack to the BUILD platform (Linux), so the
   * packaged Windows app always answered supported:false and the power button
   * died on "پشتیبانی نمی‌شود". isWindowsRuntime() defeats the fold. */
  if (!isWindowsRuntime()) {
    return NextResponse.json({ ok: true, supported: false, platform: runtimePlatform() });
  }
  try {
    const { interfaces, primary } = await detect();
    return NextResponse.json({
      ok: true,
      supported: true,
      platform: "win32",
      interfaces,
      primary,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      supported: true,
      platform: "win32",
      error: `تشخیص وضعیت DNS ممکن نشد: ${(err as Error).message}`,
    });
  }
}

/* ------------------------------ actions ------------------------------ */

// sanitizeAlias + buildScript + psQuote live in src/lib/netsh-script.ts —
// pure, whitelist-based, and covered by unit tests (فاز ۴.۳ + ۷.۳).

export async function POST(req: NextRequest) {
  const denied = localGuard(req);
  if (denied) return denied;

  // beta.3: runtime platform check (see the GET comment — Turbopack fold).
  if (!isWindowsRuntime()) {
    return NextResponse.json(
      { ok: false, error: "تغییر DNS سیستم فقط روی ویندوز پشتیبانی می‌شود." },
      { status: 400 },
    );
  }

  let body: { action?: string; ips?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const action = body.action;
  if (action === "flush") {
    try {
      await ps("ipconfig /flushdns | Out-Null; Write-Output done", 15000);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `پاک‌سازی کش نشد: ${(err as Error).message}` },
        { status: 500 },
      );
    }
  }

  if (action !== "apply" && action !== "off") {
    return NextResponse.json({ ok: false, error: "عملیات نامعتبر است" }, { status: 400 });
  }

  const ips = (body.ips ?? []).filter((ip) => typeof ip === "string" && IPV4.test(ip));
  if (action === "apply" && (ips.length === 0 || ips.length > 2)) {
    return NextResponse.json(
      { ok: false, error: "یک یا دو آی‌پی DNS معتبر لازم است" },
      { status: 400 },
    );
  }

  // Fresh detection: never trust a client-provided interface name.
  const { primary } = await detect();
  if (!primary) {
    return NextResponse.json(
      { ok: false, error: "هیچ آداپتور شبکه فعالی پیدا نشد." },
      { status: 400 },
    );
  }
  const alias = sanitizeAlias(primary.alias);
  if (!alias) {
    return NextResponse.json(
      { ok: false, error: "نام اینترفیس شبکه قابل استفاده نیست." },
      { status: 400 },
    );
  }

  // 3.3 — snapshot the pre-apply DNS state on the FIRST apply, so `off` can
  // restore exactly what the user had (manual servers or DHCP) instead of a
  // blind DHCP reset. If a snapshot already exists we keep the original one
  // (repeated applies must not overwrite the true baseline).
  let restore: DnsSnapshot | null = null;
  if (action === "apply") {
    if (!readSnapshot()) {
      try {
        writeSnapshot(await probeDnsMode(alias));
      } catch {
        /* snapshot is best-effort; off falls back to DHCP if missing */
      }
    }
  } else {
    // action === "off": load the snapshot to restore it.
    restore = readSnapshot();
  }

  const token = randomUUID().slice(0, 8);
  const scriptFile = path.join(os.tmpdir(), `stag-dns-${token}.ps1`);
  const resultFile = path.join(os.tmpdir(), `stag-dns-out-${token}.txt`);
  fs.writeFileSync(scriptFile, buildScript(action, alias, ips, resultFile, restore), "utf8");

  const readResult = (): string => {
    try {
      return fs.readFileSync(resultFile, "utf8").trim();
    } catch {
      return "";
    }
  };

  try {
    /*
     * Two-stage execution (beta.3 fix for the power button):
     *  1. DIRECT — works instantly whenever STAG runs with admin rights and
     *     produces the REAL netsh error text when it does not.
     *  2. ELEVATED (Start-Process -Verb RunAs → one UAC prompt) — only when
     *     stage 1 proves elevation is the missing piece. A UAC prompt that the
     *     user cancels is reported as such instead of a generic failure.
     */
    let directErr = "";
    let result = "";
    try {
      await runScriptDirect(scriptFile);
    } catch (err) {
      directErr = String((err as Error).message ?? "");
    }
    result = readResult();

    const directBlocked =
      !result || needsElevation(result.replace(/^ERR\s*/, "")) || needsElevation(directErr);

    if (directBlocked) {
      // Stage 2 — one UAC prompt, hidden window, wait for the script to finish.
      const elevate =
        `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden ` +
        `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptFile}'`;
      try {
        await ps(elevate, 120000);
      } catch (err) {
        const msg = String((err as Error).message ?? "");
        if (/canceled|cancelled|denied|dismissed/i.test(msg)) {
          return NextResponse.json({
            ok: false,
            code: "uac",
            error:
              "درخواست دسترسی مدیر (UAC) تأیید نشد — بدون اجازه مدیر نمی‌شود DNS سیستم را عوض کرد.",
          });
        }
        return NextResponse.json({
          ok: false,
          code: "elevation",
          error:
            `اجرای دستور با دسترسی مدیر ناموفق بود: ${msg.slice(0, 140)}. ` +
            "یک راه دیگر: STAG را با راست‌کلیک → Run as administrator اجرا کن.",
        });
      }
      // The elevated run writes the result file; poll briefly for it.
      for (let i = 0; i < 20 && !result; i++) {
        result = readResult();
        if (!result) await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (!result) {
      return NextResponse.json({
        ok: false,
        code: "no-result",
        error:
          "نتیجه اجرا دریافت نشد (اسکریپت کامل اجرا نشد) — اگر آنتی‌ویروس اسکریپت‌های PowerShell را می‌بندد، آن را برای STAG مستثنا کن.",
      });
    }
    if (!result.startsWith("OK")) {
      const raw = result.replace(/^ERR\s*/, "");
      const friendly = needsElevation(raw)
        ? "دسترسی مدیر لازم است — STAG را با Run as administrator اجرا کن یا پنجره UAC را تأیید کن."
        : raw;
      return NextResponse.json({
        ok: false,
        code: "netsh",
        error: `خطا: ${friendly.slice(0, 200)}`,
      });
    }

    const fresh = await detect();
    // After a successful restore, the snapshot has served its purpose — drop it
    // so the NEXT apply captures a fresh baseline.
    if (action === "off") clearSnapshot();
    return NextResponse.json({
      ok: true,
      action,
      primary: fresh.primary,
      restored: action === "off" ? (restore?.mode ?? "dhcp") : undefined,
    });
  } finally {
    try {
      fs.unlinkSync(scriptFile);
    } catch {
      /* noop */
    }
    try {
      fs.unlinkSync(resultFile);
    } catch {
      /* noop */
    }
  }
}
