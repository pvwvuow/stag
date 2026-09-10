"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Sun, Moon, Minus, Square, Copy, X } from "lucide-react";

const THEME_KEY = "stag.theme";
type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.classList.remove("dark");
  else root.classList.add("dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* noop */
  }
}

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
      className={`app-no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors ${
        danger ? "hover:bg-rose-500 hover:text-white" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function Titlebar() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setIsDesktop(!!window.electronAPI?.isDesktop);

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* noop */
    }
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setTheme("light");
    }

    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setMaximized).catch(() => {});
      return window.electronAPI.onMaximizedChange(setMaximized);
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <header className="app-drag sticky top-0 z-50 flex h-11 w-full shrink-0 select-none items-center justify-between border-b border-border bg-background/85 pe-2 ps-3 backdrop-blur">
      {/* brand (start / right in RTL) */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-primary">
          <Gamepad2 className="h-4 w-4" />
        </span>
        <span className="ltr text-sm font-black leading-none tracking-[0.2em] text-primary">STAG</span>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">نسخه دسکتاپ</span>
      </div>

      {/* actions (end / left in RTL) */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "حالت روز" : "حالت شب"}
          title={theme === "dark" ? "حالت روز (سفید)" : "حالت شب (سیاه)"}
          className="app-no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {isDesktop && window.electronAPI && (
          <>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <WinButton onClick={() => window.electronAPI!.minimize()} label="کمینه">
              <Minus className="h-4 w-4" />
            </WinButton>
            <WinButton
              onClick={() => window.electronAPI!.maximizeToggle()}
              label={maximized ? "بازگردانی اندازه" : "بیشینه"}
            >
              {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </WinButton>
            <WinButton onClick={() => window.electronAPI!.close()} label="بستن" danger>
              <X className="h-4 w-4" />
            </WinButton>
          </>
        )}
      </div>
    </header>
  );
}
