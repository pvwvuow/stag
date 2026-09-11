"use client";

import { useMemo } from "react";

/* --------------------------- live monitor --------------------------- */

export interface LiveSample {
  t: number;
  ok: boolean;
  ms: number | null;
  /** which metric `ms` is — real game TCP RTT, regional game-path RTT
   *  (beta.5), DNS-server TCP:53 RTT, or DNS query time */
  msKind?: "tcp" | "region" | "server" | "dns" | null;
  /** game-server TCP reachability for this probe (null = TCP not attempted) */
  tcpOk?: boolean | null;
}

/**
 * Live packet chart: one bar per probe (latest at right), colored by latency
 * bucket; a lost packet is drawn as a full-height red sliver so gaps in
 * connectivity are impossible to miss.
 */
export function LiveChart({
  samples,
  slots = 45,
  aria = "نمودار زنده پکت‌ها",
  empty = "پایش زنده روشن نیست",
  samplesLabel = (n: number) => `${n} نمونه اخیر`,
}: {
  samples: LiveSample[];
  slots?: number;
  aria?: string;
  empty?: string;
  samplesLabel?: (n: number) => string;
}) {
  const W = 560;
  const H = 140;
  const PAD_T = 8;
  const PAD_B = 16;
  const innerH = H - PAD_T - PAD_B;

  const { bars, maxMs, avgMs } = useMemo(() => {
    const buf = samples.slice(-slots);
    /* A sample is delivered whenever the probe produced a real number (game
       TCP, DNS-server TCP:53 or DNS query). Only a request-level failure —
       the DNS did not answer at all — draws as a lost packet. Game-server
       blocks (Iran sanctions) degrade the KIND of the number, not its
       existence, so the monitor stays useful without a VPN. */
    const reachable = (s: LiveSample) => s.ok && s.ms !== null;
    const okVals = buf.filter(reachable).map((s) => s.ms as number);
    const maxMs = Math.max(60, ...okVals) * 1.15;
    const avgMs = okVals.length ? Math.round(okVals.reduce((a, b) => a + b, 0) / okVals.length) : null;
    const slotW = W / slots;
    const barW = Math.max(3, slotW - 2.5);
    const bars = buf.map((s, i) => {
      const x = W - (buf.length - i) * slotW + (slotW - barW) / 2; // latest at right
      if (!reachable(s)) {
        return { x, w: barW, lost: true, h: innerH };
      }
      const h = Math.max(3, ((s.ms as number) / maxMs) * innerH);
      return { x, w: barW, lost: false, h, ms: s.ms as number };
    });
    return { bars, maxMs, avgMs };
  }, [samples, slots]);

  const bucket = (ms: number) =>
    ms < 80 ? "oklch(0.72 0.15 155)" : ms < 180 ? "oklch(0.74 0.13 200)" : ms < 400 ? "oklch(0.8 0.14 85)" : "oklch(0.64 0.2 25)";

  return (
    <div className="w-full" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[130px] w-full" role="img" aria-label={aria}>
        {/* avg line */}
        {avgMs !== null && (
          <g>
            <line
              x1={0}
              x2={W}
              y1={PAD_T + innerH - (avgMs / maxMs) * innerH}
              y2={PAD_T + innerH - (avgMs / maxMs) * innerH}
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <text
              x={W - 2}
              y={PAD_T + innerH - (avgMs / maxMs) * innerH - 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="9"
            >
              avg {avgMs}ms
            </text>
          </g>
        )}
        {bars.length > 0 ? (
          bars.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={PAD_T + innerH - b.h}
              width={b.w}
              height={b.h}
              rx={1.5}
              fill={b.lost ? "oklch(0.64 0.2 25)" : bucket(b.ms!)}
              opacity={b.lost ? 0.85 : 0.9}
            />
          ))
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted-foreground" fontSize="12">
            {empty}
          </text>
        )}
        <text x={2} y={H - 4} className="fill-muted-foreground" fontSize="9">
          {samples.length > 0 ? samplesLabel(samples.length) : ""}
        </text>
      </svg>
    </div>
  );
}
