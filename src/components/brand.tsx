"use client";

import { BRAND_GLYPHS, STAG_GLYPH } from "@/lib/game-icons";
import { Gamepad2 } from "lucide-react";

/** Real brand glyph (bundled offline) or bundled raster logo. */
export function GameGlyph({ icon, className }: { icon: string; className?: string }) {
  if (icon.startsWith("img:")) {
    return (
      <img
        src={icon.slice(4)}
        alt=""
        draggable={false}
        className={`object-contain ${className ?? ""}`}
      />
    );
  }
  const g = BRAND_GLYPHS[icon];
  if (!g) return <Gamepad2 className={className} aria-hidden />;
  return (
    <svg viewBox={g.viewBox} fill="currentColor" aria-hidden className={className}>
      <path d={g.d} />
    </svg>
  );
}

/** STAG deer head — gradient via CSS mask (theme aware). */
export function StagMark({ className }: { className?: string }) {
  return <span className={`stag-mark inline-block ${className ?? ""}`} aria-hidden />;
}

export function StagLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <StagMark className={compact ? "h-8 w-8" : "h-11 w-11"} />
      <div className="flex flex-col">
        <span className="ltr text-xl font-black leading-none tracking-[0.28em] text-primary">
          STAG
        </span>
        {!compact && (
          <span className="ltr mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">
            Lower Ping • Better Play
          </span>
        )}
      </div>
    </div>
  );
}
