"use client";

import { useMemo } from "react";
import type { HistoryPoint } from "@/components/stag-store";

/**
 * Lightweight SVG area chart of best/avg DNS ping per sweep round —
 * styled after the reference mock (soft grid + gradient area, no lib).
 */
export function PingChart({ history }: { history: HistoryPoint[] }) {
  const W = 560;
  const H = 150;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 10;
  const PAD_B = 18;

  const { path, area, yTicks, max } = useMemo(() => {
    const pts = history.filter((h) => h.best !== null) as Array<{ t: number; best: number; avg: number | null }>;
    const rawMax = Math.max(60, ...pts.map((p) => p.best), ...(pts.map((p) => p.avg ?? 0)));
    const max = Math.ceil(rawMax / 40) * 40;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const x = (i: number) => PAD_L + (pts.length <= 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.best).toFixed(1)}`).join(" ");
    const area =
      pts.length > 0
        ? `${line} L${x(pts.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`
        : "";
    const yTicks = [0, max / 2, max].map((v) => ({ v, y: y(v) }));
    return { path: line, area, yTicks, max };
  }, [history]);

  const hasData = history.some((h) => h.best !== null);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label="نمودار پینگ">
        <defs>
          <linearGradient id="pingArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.13 205)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.72 0.13 205)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={t.y} y2={t.y} className="stroke-border" strokeWidth="1" strokeDasharray="3 5" />
            <text x={PAD_L - 6} y={t.y + 3} textAnchor="end" className="fill-muted-foreground ltr" fontSize="9">
              {Math.round(t.v)}
            </text>
          </g>
        ))}

        {hasData ? (
          <>
            <path d={area} fill="url(#pingArea)" />
            <path d={path} fill="none" stroke="oklch(0.65 0.12 210)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {/* last point dot */}
            {(() => {
              const pts = history.filter((h) => h.best !== null) as Array<{ best: number }>;
              const i = pts.length - 1;
              const innerW = W - PAD_L - PAD_R;
              const innerH = H - PAD_T - PAD_B;
              const px = PAD_L + (pts.length <= 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
              const py = PAD_T + innerH - (pts[i].best / max) * innerH;
              return <circle cx={px} cy={py} r="3.5" fill="oklch(0.65 0.12 210)" stroke="white" strokeWidth="1.5" />;
            })()}
          </>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted-foreground" fontSize="12">
            بعد از اولین تست، نمودار اینجا رسم میشه
          </text>
        )}

        <text x={W - PAD_R} y={H - 4} textAnchor="end" className="fill-muted-foreground" fontSize="9">
          زمان (دور تست‌ها)
        </text>
      </svg>
    </div>
  );
}
