"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ApiResult } from "@/components/stag-store";
import { verdictOf as verdictFromSummary, TONE_BADGE, isPrivateIp, type Tone } from "@/lib/verdict";
import { makeT, type Lang } from "@/lib/i18n";

// Single source of truth: verdict logic lives in src/lib/verdict.ts so unit
// tests can exercise it without React (فاز ۷.۳). This wrapper accepts the
// full API result (the historical call signature) and re-exports the rest.
export { TONE_BADGE, isPrivateIp };
export type { Tone };

export function verdictOf(res: ApiResult, lang: Lang = "fa"): { tone: Tone; label: string } {
  return verdictFromSummary(res.summary, lang);
}

export function latencyClass(ms: number | null): string {
  if (ms === null) return "text-muted-foreground";
  if (ms < 120) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 350) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function statusIcon(status: string, neutral = false) {
  if (neutral) return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (status === "nxdomain" || status === "nodata")
    return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  return <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />;
}

/** Quality of a DNS ping in words (for the stability stat etc.) */
export function pingQuality(ms: number | null, lang: Lang = "fa"): { label: string; cls: string } {
  const t = makeT(lang);
  if (ms === null) return { label: "—", cls: "text-muted-foreground" };
  if (ms < 80) return { label: t("q.great"), cls: "text-emerald-600 dark:text-emerald-400" };
  if (ms < 180) return { label: t("q.good"), cls: "text-primary" };
  if (ms < 400) return { label: t("q.fair"), cls: "text-amber-600 dark:text-amber-400" };
  return { label: t("q.poor"), cls: "text-rose-600 dark:text-rose-400" };
}

export function flagUrl(cc: string): string {
  return `/flags/${cc}.svg`;
}
