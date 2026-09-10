"use client";

import { useEffect, useState } from "react";
import { Home, Zap, Server, Settings, Info } from "lucide-react";
import { useStag, type ViewId } from "@/components/stag-store";
import { StagLockup, StagMark } from "@/components/brand";
import { WindowStrip } from "@/components/titlebar";
import { Dashboard } from "@/components/views/dashboard";
import { Optimize } from "@/components/views/optimize";
import { Servers } from "@/components/views/servers";
import { SettingsView } from "@/components/views/settings";
import { About } from "@/components/views/about";

const NAV: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "داشبورد", icon: <Home className="h-[18px] w-[18px]" /> },
  { id: "optimize", label: "بهینه‌سازی پینگ", icon: <Zap className="h-[18px] w-[18px]" /> },
  { id: "servers", label: "سرورها", icon: <Server className="h-[18px] w-[18px]" /> },
  { id: "settings", label: "تنظیمات", icon: <Settings className="h-[18px] w-[18px]" /> },
  { id: "about", label: "درباره STAG", icon: <Info className="h-[18px] w-[18px]" /> },
];

function Sidebar() {
  const st = useStag();
  const [version, setVersion] = useState("1.2.0");

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  return (
    <nav className="flex h-full w-[232px] shrink-0 flex-col border-e border-border/70 bg-sidebar/80 backdrop-blur">
      {/* brand — drag region */}
      <div className="app-drag flex h-[72px] select-none items-center px-5">
        <StagLockup />
      </div>

      {/* nav */}
      <div className="mt-2 space-y-1.5 px-3.5">
        {NAV.map((item) => {
          const active = st.view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => st.setView(item.id)}
              dir="ltr"
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition-all ${
                active
                  ? "brand-pill text-white shadow-[0_8px_20px_-8px] shadow-primary/60"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              {item.icon}
              <span dir="rtl">{item.label}</span>
              {item.id === "servers" && (
                <span
                  className={`ltr ms-auto rounded-full px-2 py-0.5 text-[10px] font-black ${
                    active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                  }`}
                >
                  {st.activeServices.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* footer */}
      <div className="mt-auto space-y-3 p-5">
        <div className="flex items-start gap-2.5" dir="rtl">
          <StagMark className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-xs font-bold leading-5">پینگ کمتر</p>
            <p className="text-xs leading-5 text-muted-foreground">تجربه بهتر</p>
            <span className="mt-1 block h-0.5 w-8 rounded-full bg-primary" />
          </div>
        </div>
        <p className="ltr text-[10px] font-medium text-muted-foreground/70">STAG v{version}</p>
      </div>
    </nav>
  );
}

export function AppShell() {
  const st = useStag();
  return (
    <div dir="ltr" className="app-bg flex h-screen overflow-hidden">
      <Sidebar />
      {/* main column (RTL) */}
      <div dir="rtl" className="flex min-w-0 flex-1 flex-col">
        <WindowStrip />
        <main className="min-h-0 flex-1">
          {st.view === "dashboard" && <Dashboard />}
          {st.view === "optimize" && <Optimize />}
          {st.view === "servers" && <Servers />}
          {st.view === "settings" && <SettingsView />}
          {st.view === "about" && <About />}
        </main>
      </div>
    </div>
  );
}
