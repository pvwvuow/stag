"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Minus, Square, Copy, X } from "lucide-react";
import { useStag } from "@/components/stag-store";
import { StagLockup } from "@/components/brand";

const THEME_KEY = "stag.theme";
export type Theme = "dark" | "light";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.classList.remove("dark");
  else root.classList.add("dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* noop */
  }
}

/**
 * beta.6 — the theme toggle lives in ONE place (the sidebar footer, next to
 * the language switch). The titlebar is pure window chrome again — night/day
 * never belonged next to minimize/close.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* noop */
    }
    const initial: Theme = saved === "dark" ? "dark" : "light";
    applyTheme(initial);
    setTheme(initial);
  }, []);
  const toggle = () => {
    setTheme((cur) => {
      const next: Theme = cur === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  };
  return { theme, toggle };
}

/**
 * Windows-convention caption button: square, full caption height, flush
 * against the window corner edge (46px wide like native apps), subtle hover,
 * close turns red. No rounded corners, no gaps.
 */
function WinButton({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`app-no-drag flex h-full w-[46px] shrink-0 items-center justify-center text-muted-foreground transition-colors ${
        danger
          ? "hover:bg-rose-500 hover:text-white"
          : "hover:bg-foreground/10 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * beta.6 — ONE full-width header over the whole window (the sidebar and main
 * area are a single surface now). Brand on the start edge, caption buttons
 * pinned flush to the top-right corner (Windows convention in both UI
 * languages — that is where users look for them). The entire strip drags the
 * frameless window.
 */
export function WindowStrip() {
  const st = useStag();
  const [isDesktop, setIsDesktop] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setIsDesktop(!!window.electronAPI?.isDesktop);
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setMaximized).catch(() => {});
      return window.electronAPI.onMaximizedChange(setMaximized);
    }
  }, []);

  return (
    <header
      dir="ltr"
      className="app-drag flex h-12 w-full shrink-0 select-none items-stretch justify-between"
    >
      {/* brand on the start edge */}
      <div className="flex items-center ps-4">
        <StagLockup compact />
      </div>
      {/* caption buttons pinned to the physical top-right corner */}
      <div className="flex items-stretch">
        {isDesktop && window.electronAPI && (
          <>
            <WinButton onClick={() => window.electronAPI!.minimize()} label={st.t("title.min")}>
              <Minus className="h-4 w-4" strokeWidth={1.8} />
            </WinButton>
            <WinButton
              onClick={() => window.electronAPI!.maximizeToggle()}
              label={maximized ? st.t("title.restore") : st.t("title.max")}
            >
              {maximized ? (
                <Copy className="h-[15px] w-[15px]" strokeWidth={1.8} />
              ) : (
                <Square className="h-[15px] w-[15px]" strokeWidth={1.8} />
              )}
            </WinButton>
            <WinButton onClick={() => window.electronAPI!.close()} label={st.t("title.close")} danger>
              <X className="h-4 w-4" strokeWidth={1.8} />
            </WinButton>
          </>
        )}
      </div>
    </header>
  );
}
