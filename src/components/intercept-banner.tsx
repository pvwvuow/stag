"use client";

/**
 * beta.7 — DNS-interception banner.
 *
 * Shown when the dead-IP probe (192.0.2.1 — RFC 5737 TEST-NET-1) proves that
 * something on-path answers EVERY DNS query: an ISP middlebox, the modem, or
 * a local DNS-bypass tool. This is the exact cause of the user-reported
 * "every DNS shows the same ping and works even when STAG says it won't" —
 * the answers never come from the selected server, so STAG now says so
 * loudly instead of showing identical fake pings.
 */

import { ShieldAlert } from "lucide-react";
import { useStag } from "@/components/stag-store";

export function InterceptBanner() {
  const st = useStag();
  const t = st.t;
  if (st.intercept.intercepted !== true) return null;
  return (
    <section
      role="alert"
      className="panel flex items-start gap-3 border-amber-500/30 bg-amber-500/[0.07] p-4"
      dir="rtl"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black text-amber-700 dark:text-amber-300">
          {t("dash.interceptTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/85">
          {t("dash.interceptBody", { ms: st.intercept.interceptorMs ?? "?" })}
        </p>
      </div>
    </section>
  );
}
