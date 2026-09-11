/**
 * فاز ۷.۳ — unit tests for the sensitive pure logic:
 *   - verdict (reachability-aware DNS verdict)
 *   - netsh script building + alias sanitization (injection safety)
 *
 * Runs WITHOUT new dependencies: the pure TypeScript modules are compiled to
 * CJS with the already-installed `typescript` package, then executed with the
 * standard `node:test` runner.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// fileURLToPath (NOT .pathname) — Windows-safe root resolution.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "stag-units-"));

// 1) compile the pure modules
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "src/lib/verdict.ts",
    "src/lib/netsh-script.ts",
    "src/lib/i18n.ts",
    "src/lib/games.ts",
    "src/lib/dns-catalog.ts",
    "--outDir",
    outDir,
    "--module",
    "commonjs",
    "--target",
    "es2021",
    "--skipLibCheck",
    "--noEmitOnError",
    "--moduleResolution",
    "node",
  ],
  { cwd: root, stdio: "pipe" },
);

// 2) run the tests against the compiled CJS
const require2 = createRequire(import.meta.url);
const { verdictOf, isPrivateIp, toneHint } = require2(path.join(outDir, "verdict.js"));
const { sanitizeAlias, buildScript, psQuote, IPV4_RE } = require2(path.join(outDir, "netsh-script.js"));
const { DICT, makeT, dirOf } = require2(path.join(outDir, "i18n.js"));
const { REGION_ANCHORS, GAME_PRESETS } = require2(path.join(outDir, "games.js"));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

/* ------------------------- verdictOf ------------------------- */
console.log("verdict:");
{
  const r = verdictOf({ total: 4, resolved: 4, reachable: 4, misleading: 0 });
  check("all reachable -> ok", r.tone === "ok" && r.label === "مناسب بازی");
}
{
  // THE regression: resolves everything but the game server is unreachable
  const r = verdictOf({ total: 4, resolved: 4, reachable: 0, misleading: 4 });
  check("resolve-without-reach -> blocked (NOT rose 'misleading')", r.tone === "blocked");
}
{
  const r = verdictOf({ total: 4, resolved: 3, reachable: 0, misleading: 3 });
  check("partial-resolve + zero reach -> blocked", r.tone === "blocked");
}
{
  // beta.4 — the Quad9 scenario the user reported: SOME critical servers work
  // (the game does run) even though others are filtered. Must be usable, amber.
  const r = verdictOf({ total: 2, resolved: 2, reachable: 1, misleading: 1 });
  check("1/2 reachable -> partial (usable, not rose)", r.tone === "partial");
  check("partial label mentions usable", /قابل استفاده/.test(r.label));
}
{
  // beta.4 — fake/private answers with zero reach deserve the rose treatment.
  const r = verdictOf({ total: 4, resolved: 4, reachable: 0, misleading: 4, private: 2 });
  check("zero reach + private IPs -> misleading (fake path)", r.tone === "misleading");
}
{
  const r = verdictOf({ total: 4, resolved: 0, reachable: 0, misleading: 0 });
  check("no resolve -> dead", r.tone === "dead");
}
{
  const r = verdictOf({ total: 4, resolved: 4, reachable: 2, misleading: 0 });
  check("half reachable, none misleading -> partial", r.tone === "partial");
}
{
  // beta.4 — one reachable among many is enough to be called usable
  const r = verdictOf({ total: 4, resolved: 4, reachable: 3, misleading: 1 });
  check("3/4 reachable (1 misleading) -> partial", r.tone === "partial");
}
{
  const r = verdictOf({ total: 0, resolved: 0 });
  check("nothing judged -> unknown", r.tone === "unknown");
}
{
  // legacy API responses without reachability fields fall back to resolved
  const r = verdictOf({ total: 2, resolved: 2 });
  check("legacy fallback -> ok", r.tone === "ok");
}

/* ------------------------- isPrivateIp ------------------------- */
console.log("isPrivateIp:");
check("10.x private", isPrivateIp("10.10.34.35") === true);
check("192.168.x private", isPrivateIp("192.168.1.1") === true);
check("172.16 private", isPrivateIp("172.16.0.1") === true);
check("172.32 NOT private", isPrivateIp("172.32.0.1") === false);
check("8.8.8.8 public", isPrivateIp("8.8.8.8") === false);
check("::1 private", isPrivateIp("::1") === true);
check("fc00::/7 private", isPrivateIp("fd12:3456::1") === true);
check("2606 public v6", isPrivateIp("2606:4700::1111") === false);

/* ------------------------- sanitizeAlias ------------------------- */
console.log("sanitizeAlias:");
{
  const r = sanitizeAlias("Ethernet 2");
  check("plain name kept", r === "Ethernet 2");
}
{
  const r = sanitizeAlias("اترنت");
  check("Persian adapter name kept (Unicode letters)", r === "اترنت");
}
{
  const r = sanitizeAlias('Eth"; calc; `net user$ {x}');
  check("PS metacharacters stripped", r === "Eth calc net user x");
}
{
  check("quotes die", !/["']/.test(sanitizeAlias('a"b\'c') ?? ""));
  check("backtick dies", !/`/.test(sanitizeAlias("a`b") ?? ""));
  check("dollar dies", !/\$/.test(sanitizeAlias("a$b") ?? ""));
  check("semicolon dies", !/;/.test(sanitizeAlias("a;b") ?? ""));
  check("newlines die", sanitizeAlias("a\r\nb") === "ab");
  check("braces/pipe die", !/[{}|]/.test(sanitizeAlias("a{b|c}") ?? ""));
}
{
  check("empty -> null", sanitizeAlias("   ") === null);
  check("too long -> null", sanitizeAlias("x".repeat(65)) === null);
}

/* ------------------------- psQuote ------------------------- */
console.log("psQuote:");
check('quote escaped', psQuote('a"b') === 'a`"b');
check("backtick doubled", psQuote("a`b") === "a``b");
check("dollar escaped", psQuote("a$b") === "a`$b");

/* ------------------------- buildScript ------------------------- */
console.log("buildScript:");
{
  const s = buildScript("apply", "Ethernet", ["178.22.122.100", "185.51.200.2"], "C:\\out.txt");
  check("sets primary", s.includes('set dns name="Ethernet" static 178.22.122.100'));
  check("adds secondary index=2", s.includes('add dns name="Ethernet" 185.51.200.2 index=2'));
  check("writes result file", s.includes("$res = 'C:\\out.txt'"));
  check("flushes dns", s.includes("ipconfig /flushdns"));
}
{
  const s = buildScript("apply", "Eth", ["178.22.122.100"], "o.txt");
  check("single IP -> no secondary line", !s.includes("add dns"));
}
{
  const s = buildScript("off", "Eth", [], "o.txt", { alias: "Eth", mode: "static", servers: ["5.202.100.100", "5.202.100.101"] });
  check("static restore sets user's primary back", s.includes('static 5.202.100.100'));
  check("static restore adds user's secondary back", s.includes("5.202.100.101 index=2"));
  check("static restore never touches dhcp", !s.includes("source=dhcp"));
}
{
  const s = buildScript("off", "Eth", [], "o.txt", { alias: "Eth", mode: "dhcp", servers: [] });
  check("dhcp snapshot -> source=dhcp", s.includes("source=dhcp"));
}
{
  const s = buildScript("off", "Eth", [], "o.txt", null);
  check("no snapshot -> source=dhcp", s.includes("source=dhcp"));
}
{
  // snapshot with junk servers must NOT be restored
  const s = buildScript("off", "Eth", [], "o.txt", { alias: "Eth", mode: "static", servers: ["not-an-ip"] });
  check("junk static snapshot falls back to dhcp", s.includes("source=dhcp"));
}
{
  // injection attempt through resultFile path is single-quote-doubled
  const s = buildScript("apply", "Eth", ["1.1.1.1"], "o'; calc; 'x.txt");
  check("result file single-quote escaped", s.includes("$res = 'o''; calc; ''x.txt'"));
  check("escaped result cannot break out of the string", !/res = '[^']*'; calc/.test(s));
  // and the alias is whitelist-sanitized upstream + psQuoted here
  const s2 = buildScript("apply", psQuote(sanitizeAlias('Eth"; calc') ?? ""), ["1.1.1.1"], "o.txt");
  check("hardened alias path has no raw quote", !/name="[^"]*"/.test(s2.replace(/name="Eth calc"/, 'OK')));
}

/* ------------------------- IPV4_RE ------------------------- */
console.log("IPV4_RE:");
check("valid v4", IPV4_RE.test("178.22.122.100") === true);
check("octet 256 rejected", IPV4_RE.test("256.1.1.1") === false);
check("garbage rejected", IPV4_RE.test("abc") === false);

/* ------------------- beta.5: i18n parity ------------------- */
console.log("i18n:");
{
  const faKeys = Object.keys(DICT.fa).sort();
  const enKeys = Object.keys(DICT.en).sort();
  check("en mirrors every fa key", JSON.stringify(faKeys) === JSON.stringify(enKeys));
  check("no empty fa values", faKeys.every((k) => typeof DICT.fa[k] === "string" && DICT.fa[k].length > 0));
  check("no empty en values", enKeys.every((k) => typeof DICT.en[k] === "string" && DICT.en[k].length > 0));
  check("dirOf fa=rtl en=ltr", dirOf("fa") === "rtl" && dirOf("en") === "ltr");
  const t = makeT("en");
  check("interpolation works", t("dash.stabilitySub", { ok: 2, n: 5 }) === "2 of 5 services answered");
  check("fallback to key", t("nonexistent.key") === "nonexistent.key");
}

/* ---------------- beta.5: bilingual verdict ---------------- */
console.log("verdict i18n:");
{
  const s1 = { total: 2, resolved: 2, reachable: 1, misleading: 0 };
  check("partial fa label", verdictOf(s1, "fa").label === "\u0642\u0627\u0628\u0644 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u2014 \u0628\u0639\u0636\u06cc \u0633\u0631\u0648\u0631\u0647\u0627 \u0645\u062d\u062f\u0648\u062f");
  check("partial en label", verdictOf(s1, "en").label === "Usable \u2014 some servers limited");
  const s2 = { total: 2, resolved: 2, reachable: 0, misleading: 2 };
  check("blocked en label", verdictOf(s2, "en").label === "Can't reach game servers");
  check("blocked en hint", toneHint("blocked", "en").includes("unreachable"));
  const s3 = { total: 1, resolved: 0, reachable: 0 };
  check("dead en label", verdictOf(s3, "en").label === "DNS not answering");
  check("ok en label", verdictOf({ total: 1, resolved: 1, reachable: 1 }, "en").label === "Game-ready");
}

/* ------------- beta.5: game data + region anchors ------------- */
console.log("games i18n:");
{
  check("every game has hintEn", GAME_PRESETS.every((g) => typeof g.hintEn === "string" && g.hintEn.length > 3));
  const pubg = GAME_PRESETS.find((g) => g.id === "pubg");
  check("pubg fa name fixed", pubg.name === "\u067e\u0627\u0628\u062c\u06cc");
  const lol = GAME_PRESETS.find((g) => g.id === "lol");
  check("lol fa name fixed", lol.name === "\u0644\u06cc\u06af \u0622\u0648 \u0644\u062c\u0646\u062f\u0632");
  const rivals = GAME_PRESETS.find((g) => g.id === "marvel-rivals");
  check("marvel fa name fixed", rivals.name === "\u0645\u0627\u0631\u0648\u0644 \u0631\u06cc\u0648\u0644\u0632");
  check("region anchors >= 2 with hosts", REGION_ANCHORS.length >= 2 && REGION_ANCHORS.every((a) => /^[a-z0-9.-]+$/.test(a.host)));
  check("frankfurt anchor present", REGION_ANCHORS.some((a) => a.city === "Frankfurt"));
}

console.log(`\n${passed} passed, ${failed} failed`);
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
