"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ApiResult } from "@/components/stag-store";

/* Iran-internal / private-range IPs can never be tested from an external server. */
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

export function latencyClass(ms: number | null): string {
  if (ms === null) return "text-muted-foreground";
  if (ms < 120) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 350) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export type Tone = "ok" | "partial" | "dead" | "unknown";

export const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  dead: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40",
  unknown: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/40",
};

export function verdictOf(res: ApiResult): { tone: Tone; label: string } {
  const s = res.summary;
  const tone: Tone =
    s.total === 0 ? "unknown" : s.resolved === 0 ? "dead" : s.resolved === s.total ? "ok" : "partial";
  const label =
    tone === "ok"
      ? "DNS کار میکنه"
      : tone === "dead"
        ? "DNS جواب نمیده"
        : tone === "partial"
          ? "ناقص جواب میده"
          : "قضاوت ممکن نبود";
  return { tone, label };
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
export function pingQuality(ms: number | null): { label: string; cls: string } {
  if (ms === null) return { label: "—", cls: "text-muted-foreground" };
  if (ms < 80) return { label: "عالی", cls: "text-emerald-600 dark:text-emerald-400" };
  if (ms < 180) return { label: "خوب", cls: "text-primary" };
  if (ms < 400) return { label: "متوسط", cls: "text-amber-600 dark:text-amber-400" };
  return { label: "ضعیف", cls: "text-rose-600 dark:text-rose-400" };
}

export function flagUrl(cc: string): string {
  return `/flags/${cc}.svg`;
}
