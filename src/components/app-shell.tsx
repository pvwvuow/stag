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
} from "lucide-react";
import { useStag, type ViewId } from "@/components/stag-store";
import { StagLockup, StagMark } from "@/components/brand";
import { WindowStrip } from "@/components/titlebar";
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
 * beta.5 — the sidebar is ONE piece with the main area (same background,
 * hairline divider) and collapses to an icon rail. Collapsed icons stay
 * clickable and carry tooltips; the width animates so it feels native.
 */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const st = useStag();
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  const updateReady = st.update.status === "ready";
  const updateAvailable = st.update.status === "available" || updateReady;

  return (
    <nav
      className={`relative flex h-full shrink-0 flex-col bg-sidebar/80 backdrop-blur transition-[width] duration-200 ease-out ${
        collapsed ? "w-[64px]" : "w-[232px]"
      }`}
    >
      {/* soft separator to the main area */}
      <span className="hairline-v absolute end-0 top-0 h-full" aria-hidden />
      {/* brand — drag region */}
      <div className="app-drag flex h-[72px] select-none items-center px-5">
        {collapsed ? (
          <StagMark className="mx-auto h-8 w-8 shrink-0" />
        ) : (
          <StagLockup />
        )}
      </div>

      {/* nav */}
      <div className={`mt-2 space-y-1.5 ${collapsed ? "px-2.5" : "px-3.5"}`}>
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

        {/* beta.5 — quick language switch (fa/en) */}
        <button
          onClick={() => st.setLang(st.lang === "fa" ? "en" : "fa")}
          title={st.t("shell.langTitle")}
          aria-label={st.t("shell.langTitle")}
          className={`flex w-full items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground ${
            collapsed ? "justify-center py-2.5" : "gap-2 px-3.5 py-2.5"
          }`}
        >
          <Languages className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="min-w-0 flex-1 text-[11px] font-bold" dir="ltr">
              {st.lang === "fa" ? "English" : "فارسی"}
            </span>
          )}
        </button>

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
    <div dir="ltr" className="app-bg flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      {/* main column (direction follows the UI language) */}
      <div dir={st.dir} className="flex min-w-0 flex-1 flex-col">
        <WindowStrip />
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
  );
}
