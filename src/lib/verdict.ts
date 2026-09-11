/**
 * Pure verdict logic for the full DNS test (فاز ۱.۱ — فایل مشترک برای تست یونیت).
 *
 * beta.4 rewrite — «اطلاعات درست» (report what is actually true):
 *
 * The old logic treated ANY unreachable critical server as "misleading" (rose,
 * worst-possible). Inside Iran that verdict was actively WRONG: secondary
 * publisher endpoints (id.163.com, neteasgames.com, …) are routinely filtered
 * while the game itself keeps working — the user literally passed loading,
 * got ping 999 in the lobby (login hop blocked) and a healthy 130ms in-match
 * with Quad9. Reality for an Iranian gamer is a SPECTRUM, so the verdict now
 * reports exactly that:
 *
 *  ok         all critical servers reachable                 → green  «مناسب بازی»
 *  partial    SOME reachable (≥1) — filtered-network normal  → amber  «قابل استفاده»
 *  blocked    0 reachable, DNS answers fine (TCP/ICMP dead)  → amber  «به سرورهای بازی نمی‌رسه»
 *  misleading 0 reachable AND answers are private/fake IPs   → rose   «مسیر فیک (IP داخلی)»
 *  dead       the DNS itself never answered                  → rose   «DNS جواب نمیده»
 *  unknown    nothing could be judged                        → zinc
 *
 * beta.5 — labels/hints are localized via i18n (`verdict.*` / `hint.*` keys);
 * the Persian defaults stay for backwards compatibility.
 */

import * as I18N from "./i18n";

export type Tone = "ok" | "partial" | "blocked" | "dead" | "misleading" | "unknown";

export interface VerdictSummary {
  total: number;
  resolved: number;
  /** critical domains whose game server is actually reachable */
  reachable?: number;
  /** critical domains that resolve but can't reach the game server */
  misleading?: number;
  /** critical domains whose answers are ALL private/unroutable (fake path) */
  private?: number;
  skipped?: number;
}

export const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  // "blocked" = DNS works, servers filtered — common, survivable, NOT a scandal.
  blocked: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  dead: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40",
  // A fake/private path actively poisons name resolution — rose is deserved.
  misleading: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/50",
  unknown: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/40",
};

/** One-line honest hint per tone (shown under results / in tooltips). */
export const TONE_HINT: Record<Tone, string> = {
  ok: "همه سرورهای حیاتی بازی در دسترس‌اند — ست‌کردنش امنه.",
  partial: "بعضی سرورها از ایران محدودند ولی بازی معمولاً کار می‌کند (مثل پینگ ۹۹۹ در لابی و ۱۳۰ داخل مچ).",
  blocked: "DNS جواب می‌دهد ولی سرورهای حیاتی از این شبکه در دسترس نیستند؛ بازی ممکن است از مسیر دیگری کار کند.",
  dead: "هیچ پاسخی از این DNS نرسید — آی‌پی اشتباه، پورت ۵۳ بسته، یا سرویس محدود به IP ایران.",
  misleading: "این DNS دامنه را به IP داخلی/بی‌جواب می‌فرستد — مسیر فیک؛ استفاده نکن.",
  unknown: "قضاوت ممکن نشد — تست را دوباره اجرا کن.",
};

/** beta.5 — localized hint per tone (English mirrors in i18n.ts). */
export function toneHint(tone: Tone, lang: "fa" | "en" = "fa"): string {
  return I18N.makeT(lang)(`hint.${tone}`);
}

/**
 * Multi-dimensional verdict judging only the CRITICAL (auth + core game)
 * domains, keyed off REACHABILITY (TCP handshake / non-private IP), not mere
 * DNS resolution. Falls back gracefully for older API responses.
 */
export function verdictOf(s: VerdictSummary, lang: "fa" | "en" = "fa"): { tone: Tone; label: string } {
  // Reachability is authoritative when present; otherwise fall back to resolved.
  const reachable = typeof s.reachable === "number" ? s.reachable : s.resolved;
  const misleading = typeof s.misleading === "number" ? s.misleading : 0;
  const fake = typeof s.private === "number" ? s.private : 0;

  let tone: Tone;
  if (s.total === 0) {
    tone = "unknown";
  } else if (reachable === s.total) {
    tone = "ok";
  } else if (reachable >= 1) {
    // Filtered-network normal case: some publisher hops are dead, at least one
    // real path works. That is genuinely usable — say so, amber not rose.
    tone = "partial";
  } else if (fake > 0) {
    // Zero reachable AND at least one answer pointed at a private/unroutable
    // IP — an actively fake path, the only verdict that deserves rose here.
    tone = "misleading";
  } else if (s.resolved > 0 || misleading > 0) {
    // DNS answered, but every critical game server is unreachable from here.
    tone = "blocked";
  } else {
    tone = "dead";
  }

  return { tone, label: I18N.makeT(lang)(`verdict.${tone}`) };
}

/** Iran-internal / private-range IPs can never be tested from an external server. */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  return v6.startsWith("fc") || v6.startsWith("fd") || v6 === "::1";
}
