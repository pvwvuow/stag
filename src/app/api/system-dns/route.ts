import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Real system-DNS management (Windows).
 *
 * GET  -> detect the default-route network adapter + its active DNS servers.
 *         (also works when the user set a DNS manually outside STAG:
 *          servers.length > 0  =>  "DNS is ON")
 * POST -> apply (netsh static primary + secondary), off (back to DHCP),
 *         flush (ipconfig /flushdns). Changing DNS needs admin rights, so the
 *         heavy lifting runs inside an elevated PowerShell (UAC prompt) that
 *         writes a result file we read back.
 */

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

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

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json({ ok: true, supported: false, platform: process.platform });
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

function sanitizeAlias(alias: string): string | null {
  const clean = alias.replace(/["'`\r\n]/g, "").trim();
  return clean.length > 0 && clean.length <= 64 ? clean : null;
}

function buildScript(
  action: "apply" | "off",
  alias: string,
  ips: string[],
  resultFile: string,
): string {
  const head = `$ErrorActionPreference = 'Stop'\n$res = '${resultFile}'\ntry {\n`;
  const tail =
    `  ipconfig /flushdns | Out-Null\n` +
    `  Set-Content -Path $res -Value 'OK' -Encoding UTF8\n` +
    `} catch {\n` +
    `  Set-Content -Path $res -Value ('ERR ' + $_.Exception.Message) -Encoding UTF8\n` +
    `  exit 1\n` +
    `}\n`;
  if (action === "apply") {
    const primary = ips[0];
    const secondary = ips[1];
    let body = `  $o1 = netsh interface ip set dns name="${alias}" static ${primary} 2>&1\n`;
    body += `  if ($LASTEXITCODE -ne 0) { throw "set primary failed: $o1" }\n`;
    if (secondary) {
      body += `  $o2 = netsh interface ip add dns name="${alias}" ${secondary} index=2 2>&1\n`;
      body += `  if ($LASTEXITCODE -ne 0) { throw "add secondary failed: $o2" }\n`;
    }
    return head + body + tail;
  }
  // off -> back to automatic (DHCP) — reverts STAG's DNS *and* any manual DNS
  let body = `  $o1 = netsh interface ip set dnsservers name="${alias}" source=dhcp 2>&1\n`;
  body += `  if ($LASTEXITCODE -ne 0) { throw "reset to dhcp failed: $o1" }\n`;
  return head + body + tail;
}

export async function POST(req: NextRequest) {
  if (process.platform !== "win32") {
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

  const token = randomUUID().slice(0, 8);
  const scriptFile = path.join(os.tmpdir(), `stag-dns-${token}.ps1`);
  const resultFile = path.join(os.tmpdir(), `stag-dns-out-${token}.txt`);
  fs.writeFileSync(scriptFile, buildScript(action, alias, ips, resultFile), "utf8");

  try {
    // Elevate: one UAC prompt, hidden window, wait for the script to finish.
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
          error: "درخواست دسترسی مدیر (UAC) تأیید نشد — بدون اجازه مدیر نمی‌شود DNS سیستم را عوض کرد.",
        });
      }
      return NextResponse.json({
        ok: false,
        error: `اجرای دستور با دسترسی مدیر ناموفق بود: ${msg.slice(0, 160)}`,
      });
    }

    let result = "";
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(resultFile)) {
        result = fs.readFileSync(resultFile, "utf8").trim();
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!result) {
      return NextResponse.json({
        ok: false,
        error: "نتیجه اجرا دریافت نشد (اسکریپت کامل اجرا نشد).",
      });
    }
    if (!result.startsWith("OK")) {
      return NextResponse.json({
        ok: false,
        error: result.replace(/^ERR\s*/, "خطا: ").slice(0, 200),
      });
    }

    const fresh = await detect();
    return NextResponse.json({ ok: true, action, primary: fresh.primary });
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
