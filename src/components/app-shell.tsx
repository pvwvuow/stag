"use client";

import { useEffect, useState } from "react";
import {
  Home,
  Zap,
  Server,
  Settings,
  Info,
  ArrowDownToLine,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
  Sun,
  Moon,
} from "lucide-react";
import { useStag, type ViewId } from "@/components/stag-store";
import { StagMark } from "@/components/brand";
import { WindowStrip, useTheme } from "@/components/titlebar";
import { Dashboard } from "@/components/views/dashboard";
import { Optimize } from "@/components/views/optimize";
import { Servers } from "@/components/views/servers";
import { SettingsView } from "@/components/views/settings";
import { About } from "@/components/views/about";
import { APP_VERSION } from "@/lib/version";
import { loadPrefs, pushPrefs } from "@/lib/prefs";
import { ErrorBoundary } from "@/components/error-boundary";

const NAV: Array<{ id: ViewId; labelKey: string; icon: React.ReactNode }> = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: <Home className="h-[18px] w-[18px]" /> },
  { id: "optimize", labelKey: "nav.optimize", icon: <Zap className="h-[18px] w-[18px]" /> },
  { id: "servers", labelKey: "nav.servers", icon: <Server className="h-[18px] w-[18px]" /> },
  { id: "settings", labelKey: "nav.settings", icon: <Settings className="h-[18px] w-[18px]" /> },
  { id: "about", labelKey: "nav.about", icon: <Info className="h-[18px] w-[18px]" /> },
];

const SIDEBAR_KEY = "stag.sidebar.collapsed.v1";

/**
 * beta.6 — the sidebar is no longer a panel at all: transparent, no divider,
 * no private header — it shares ONE surface with the main area (the brand sits
 * in the global window header). Collapsed state stays an icon rail with
 * clickable, tooltipped icons.
 */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const st = useStag();
  const [version, setVersion] = useState(APP_VERSION);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  const updateReady = st.update.status === "ready";
  const updateAvailable = st.update.status === "available" || updateReady;

  return (
    <nav
      className={`relative flex h-full shrink-0 flex-col transition-[width] duration-200 ease-out ${
        collapsed ? "w-[64px]" : "w-[232px]"
      }`}
    >
      {/* nav — flush under the global header */}
      <div className={`mt-1 space-y-1.5 ${collapsed ? "px-2.5" : "px-3.5"}`}>
        {NAV.map((item) => {
          const active = st.view === item.id;
          const label = st.t(item.labelKey);
          return (
            <button
              key={item.id}
              onClick={() => st.setView(item.id)}
              title={label}
              aria-label={label}
              dir="ltr"
              className={`relative flex w-full items-center rounded-full transition-all ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5"
              } ${
                active
                  ? "brand-pill text-white shadow-[0_8px_20px_-8px] shadow-primary/60"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span dir="rtl">{label}</span>}
              {item.id === "servers" && (
                <span
                  className={`ltr rounded-full px-2 py-0.5 text-[10px] font-black ${
                    collapsed
                      ? `absolute end-3 top-1.5 h-2 w-2 p-0 ${active ? "bg-white" : "bg-primary"}`
                      : active
                        ? "ms-auto bg-white/25 text-white"
                        : "ms-auto bg-primary/10 text-primary"
                  }`}
                >
                  {!collapsed && st.activeServices.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* footer */}
      <div className={`mt-auto space-y-3 ${collapsed ? "px-2 pb-5" : "p-5"}`}>
        {updateAvailable && (
          <button
            onClick={() => st.setView("settings")}
            title={st.t("shell.updateTitle")}
            className={`flex w-full items-center rounded-full bg-primary/10 text-start text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 ${
              collapsed ? "justify-center py-2.5" : "gap-2 px-3.5 py-2.5"
            }`}
          >
            <ArrowDownToLine className={`h-4 w-4 shrink-0 ${updateReady ? "animate-bounce" : ""}`} />
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate" dir="rtl">
                {updateReady ? st.t("shell.updateReady") : st.t("shell.updateAvail", { v: st.update.version ?? "" })}
              </span>
            )}
          </button>
        )}

        {/* beta.6 — quick switches: language + theme side by side (icon-only
            when collapsed); the theme toggle finally has a proper home. */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => st.setLang(st.lang === "fa" ? "en" : "fa")}
              title={st.t("shell.langTitle")}
              aria-label={st.t("shell.langTitle")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Languages className="h-4 w-4 shrink-0" />
            </button>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? st.t("title.toLight") : st.t("title.toDark")}
              aria-label={theme === "dark" ? st.t("title.toLight") : st.t("title.toDark")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => st.setLang(st.lang === "fa" ? "en" : "fa")}
              title={st.t("shell.langTitle")}
              className="flex items-center justify-center gap-2 rounded-full px-2 py-2.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Languages className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate text-[11px] font-bold" dir="ltr">
                {st.lang === "fa" ? "English" : "فارسی"}
              </span>
            </button>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? st.t("title.toLight") : st.t("title.toDark")}
              aria-label={theme === "dark" ? st.t("title.toLight") : st.t("title.toDark")}
              className="flex items-center justify-center gap-2 rounded-full px-2 py-2.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-[11px] font-bold" dir="rtl">
                {theme === "dark" ? st.t("title.toLight") : st.t("title.toDark")}
              </span>
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="flex items-start gap-2.5" dir="rtl">
            <StagMark className="h-7 w-7 shrink-0" />
            <div>
              <p className="text-xs font-bold leading-5">{st.t("shell.tagline1")}</p>
              <p className="text-xs leading-5 text-muted-foreground">{st.t("shell.tagline2")}</p>
              <span className="mt-1 block h-0.5 w-8 rounded-full bg-primary" />
            </div>
          </div>
        )}
        <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between gap-2"}`}>
          <p className="ltr text-[10px] font-medium text-muted-foreground/70">
            {collapsed ? (
              <span className="rounded-sm bg-primary/15 px-1 font-bold text-primary">B</span>
            ) : (
              <>
                STAG <span className="rounded-sm bg-primary/15 px-1 font-bold text-primary">BETA</span> v{version}
              </>
            )}
          </p>
          <button
            onClick={onToggle}
            title={collapsed ? st.t("shell.expand") : st.t("shell.collapse")}
            aria-label={collapsed ? st.t("shell.expand") : st.t("shell.collapse")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

export function AppShell() {
  const st = useStag();
  const [collapsed, setCollapsed] = useState(false);

  // restore the collapsed preference once per boot
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  };

  // فاز ۸ — re-apply the saved desktop prefs (tray / close-to-tray /
  // auto-start) every boot; the main process defaults to all-off.
  useEffect(() => {
    pushPrefs(loadPrefs());
  }, []);

  // beta.5 — keep <html lang/dir> in sync with the UI language
  useEffect(() => {
    document.documentElement.lang = st.lang;
    document.documentElement.dir = st.dir;
  }, [st.lang, st.dir]);

  return (
    <div dir="ltr" className="app-bg flex h-screen flex-col overflow-hidden">
      {/* beta.6 — one full-width header: brand + caption buttons (top-right) */}
      <WindowStrip />
      {/* one continuous surface: sidebar flows into the main area */}
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        {/* main column (direction follows the UI language) */}
        <div dir={st.dir} className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1">
            {/* ۵.۳ — a crashed view must never white-screen the whole app */}
            <ErrorBoundary>
              {st.view === "dashboard" && <Dashboard />}
              {st.view === "optimize" && <Optimize />}
              {st.view === "servers" && <Servers />}
              {st.view === "settings" && <SettingsView />}
              {st.view === "about" && <About />}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
