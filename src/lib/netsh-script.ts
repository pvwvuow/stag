/**
 * Pure helpers for building the elevated Windows netsh script (فاز ۴.۳).
 * Kept free of Node/React imports so unit tests can compile + run them
 * directly (scripts/test-units.mjs).
 */

export interface DnsSnapshot {
  alias: string;
  /** "dhcp" => adapter was on automatic; "static" => had a manual server list */
  mode: "dhcp" | "static";
  servers: string[];
}

export const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * Whitelist-based interface-name sanitizer (4.3). The old blacklist ("strip
 * quotes and backticks") was brittle: Unicode punctuation, `$`, `;`, `{}` and
 * friends survived. We now KEEP only letters (any language — Persian adapter
 * names must survive), digits, space, dot, dash and parentheses; everything
 * else — every PowerShell metacharacter included — is dropped.
 */
export function sanitizeAlias(alias: string): string | null {
  const clean = alias.replace(/[^\p{L}\p{N} .()\-]/gu, "").trim();
  return clean.length > 0 && clean.length <= 64 ? clean : null;
}

/** Escape a value for safe embedding inside a PowerShell double-quoted string. */
export function psQuote(value: string): string {
  return value.replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}

/** Escape a value for safe embedding inside a PowerShell SINGLE-quoted string. */
export function psSingleQuote(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build the elevated PowerShell script.
 *  - apply: set a static primary (+ optional secondary).
 *  - off:   RESTORE the pre-apply snapshot. `restore.mode==="static"` puts the
 *           user's own manual servers back; otherwise (or no snapshot) reset to
 *           DHCP. Never blindly forces DHCP (3.3).
 */
export function buildScript(
  action: "apply" | "off",
  alias: string,
  ips: string[],
  resultFile: string,
  restore?: DnsSnapshot | null,
): string {
  const safeAlias = psQuote(alias);
  // $res lands in a SINGLE-quoted PS string — single quotes need doubling.
  const safeResult = psSingleQuote(resultFile);
  const head = `$ErrorActionPreference = 'Stop'\n$res = '${safeResult}'\ntry {\n`;
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
    let body = `  $o1 = netsh interface ip set dns name="${safeAlias}" static ${primary} 2>&1\n`;
    body += `  if ($LASTEXITCODE -ne 0) { throw "set primary failed: $o1" }\n`;
    if (secondary) {
      body += `  $o2 = netsh interface ip add dns name="${safeAlias}" ${secondary} index=2 2>&1\n`;
      body += `  if ($LASTEXITCODE -ne 0) { throw "add secondary failed: $o2" }\n`;
    }
    return head + body + tail;
  }
  // off -> restore the state the user had BEFORE STAG touched DNS.
  const restoreStatic =
    !!restore &&
    restore.mode === "static" &&
    restore.servers.filter((ip) => IPV4_RE.test(ip)).length > 0;
  if (restoreStatic) {
    const servers = restore!.servers.filter((ip) => IPV4_RE.test(ip)).slice(0, 2);
    let body = `  $o1 = netsh interface ip set dns name="${safeAlias}" static ${servers[0]} 2>&1\n`;
    body += `  if ($LASTEXITCODE -ne 0) { throw "restore primary failed: $o1" }\n`;
    if (servers[1]) {
      body += `  $o2 = netsh interface ip add dns name="${safeAlias}" ${servers[1]} index=2 2>&1\n`;
      body += `  if ($LASTEXITCODE -ne 0) { throw "restore secondary failed: $o2" }\n`;
    }
    return head + body + tail;
  }
  // no manual snapshot -> back to automatic (DHCP)
  let body = `  $o1 = netsh interface ip set dnsservers name="${safeAlias}" source=dhcp 2>&1\n`;
  body += `  if ($LASTEXITCODE -ne 0) { throw "reset to dhcp failed: $o1" }\n`;
  return head + body + tail;
}
