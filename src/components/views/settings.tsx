"use client";

import { useEffect, useState } from "react";
import { Settings, Sun, Moon, Trash2, Monitor, Info } from "lucide-react";
import { useStag, MAX_SERVERS } from "@/components/stag-store";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const THEME_KEY = "stag.theme";

export function SettingsView() {
  const st = useStag();
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isDesktop, setIsDesktop] = useState(false);
  const [version, setVersion] = useState<string>("1.1.0");

  useEffect(() => {
    setIsDesktop(!!window.electronAPI?.isDesktop);
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark") setTheme("dark");
    } catch {
      /* noop */
    }
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Settings className="h-5 w-5 text-primary" />
          تنظیمات
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">شخصی‌سازی رفتار STAG — همه‌چیز همین‌جا ذخیره میشه.</p>
      </div>

      {/* theme */}
      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 text-sm font-bold">ظاهر برنامه</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <button
            onClick={() => applyTheme("light")}
            className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
              theme === "light" ? "border-primary bg-primary/[0.08]" : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-cyan-600 shadow-inner">
              <Sun className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">حالت روز</span>
              <span className="block text-[10px] text-muted-foreground">سفید + فیروزه‌ای</span>
            </span>
          </button>
          <button
            onClick={() => applyTheme("dark")}
            className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
              theme === "dark" ? "border-primary bg-primary/[0.08]" : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-cyan-400">
              <Moon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">حالت شب</span>
              <span className="block text-[10px] text-muted-foreground">مشکی + فیروزه‌ای</span>
            </span>
          </button>
        </div>
      </section>

      {/* test options */}
      <section className="space-y-3 rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="text-sm font-bold">گزینه‌های تست</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">تست پورت‌های TCP بازی</p>
            <p className="text-[11px] text-muted-foreground">
              در تست کامل، علاوه بر DNS، پورت‌های آنلاین بازی هم چک میشه (کمی طولانی‌تر)
            </p>
          </div>
          <Switch checked={st.tcpEnabled} onCheckedChange={st.setTcpEnabled} aria-label="تست TCP" />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
          <div>
            <p className="text-sm font-medium">سقف سرورهای فعال</p>
            <p className="text-[11px] text-muted-foreground">
              حداکثر {MAX_SERVERS} DNS به‌صورت همزمان — برای جلوگیری از شلوغی شبکه
            </p>
          </div>
          <CountChip>{MAX_SERVERS}</CountChip>
        </div>
      </section>

      {/* data */}
      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="mb-1 text-sm font-bold">داده‌ها</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          لیست سرورها، بازی انتخابی و تنظیمات به‌صورت محلی ذخیره میشن. با پاک‌کردن، همه‌چیز به حالت
          اول برمی‌گرده.
        </p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("stag.state.v2");
              localStorage.removeItem("stag.servers.v1");
            } catch {
              /* noop */
            }
            toast({ title: "پاک شد", description: "برای اعمال، برنامه را دوباره باز کن." });
          }}
          className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
          بازنشانی داده‌ها
        </button>
      </section>

      {/* diagnostics */}
      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Monitor className="h-4 w-4 text-primary" />
          وضعیت اجرا
        </h2>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Info className="h-3 w-3" />
            حالت: {isDesktop ? "دسکتاپ (Electron) — تست از اینترنت خودت" : "مرورگر — تست از سرور این صفحه"}
          </li>
          <li className="flex items-center gap-2">
            <Info className="h-3 w-3" />
            نسخه: <span className="ltr font-mono">{version}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ltr flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary/10 px-2 font-mono text-sm font-black text-primary">
      {children}
    </span>
  );
}
