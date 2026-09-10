"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Sun,
  Moon,
  Trash2,
  Monitor,
  Info,
  RefreshCw,
  Download,
  RotateCw,
  PackageCheck,
  ExternalLink,
  AlertCircle,
  Loader2,
  PanelBottom,
  Power,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Circle,
  Rocket,
} from "lucide-react";
import { useStag, MAX_SERVICES } from "@/components/stag-store";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { APP_VERSION } from "@/lib/version";
import { apiFetch } from "@/lib/api-client";
import { loadPrefs, savePrefs, type StagPrefs } from "@/lib/prefs";

const THEME_KEY = "stag.theme";
const RELEASES_URL = "https://github.com/pvwvuow/stag/releases/latest";

function fmtBytes(n: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SettingsView() {
  const st = useStag();
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isDesktop, setIsDesktop] = useState(false);
  const [version, setVersion] = useState<string>(APP_VERSION);
  const [prefs, setPrefs] = useState<StagPrefs>({ tray: false, closeToTray: false, autostart: false });

  useEffect(() => {
    setIsDesktop(!!window.electronAPI?.isDesktop);
    setPrefs(loadPrefs());
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark") setTheme("dark");
    } catch {
      /* noop */
    }
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  const updatePrefs = (patch: Partial<StagPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

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

  const u = st.update;
  const isPortable = u.status === "unsupported" && u.error === "portable";

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Settings className="h-5 w-5 text-primary" />
          تنظیمات
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">شخصی‌سازی رفتار STAG — همه‌چیز همین‌جا ذخیره میشه.</p>
      </div>

      {/* in-app updates */}
      <section className="panel p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <PackageCheck className="h-4 w-4 text-primary" />
          بروزرسانی برنامه
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          آپدیت فقط بخش‌های تغییرکرده را دانلود می‌کند (نه کل برنامه) — بعد از دانلود، با یک
          راه‌اندازی مجدد نصب می‌شود.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
            نسخه فعلی: <span className="ltr font-mono text-foreground">{version}</span>
          </span>

          {u.status === "idle" && (
            <button
              onClick={st.checkForUpdates}
              disabled={!isDesktop}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              بررسی بروزرسانی
            </button>
          )}

          {u.status === "checking" && (
            <span className="flex items-center gap-2 rounded-full bg-muted/70 px-4 py-2 text-xs font-bold text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              در حال بررسی...
            </span>
          )}

          {u.status === "available" && (
            <>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
                نسخه <span className="ltr font-mono">{u.version}</span> موجوده
              </span>
              <button
                onClick={st.downloadUpdate}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                دانلود آپدیت
              </button>
            </>
          )}

          {u.status === "downloading" && (
            <div className="min-w-56 flex-1">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>در حال دانلود... %{u.percent}</span>
                <span className="ltr">
                  {fmtBytes(u.transferred)} / {fmtBytes(u.total)} · {fmtBytes(u.bps)}/s
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(3, u.percent)}%` }}
                />
              </div>
            </div>
          )}

          {u.status === "ready" && (
            <>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                نسخه <span className="ltr font-mono">{u.version}</span> آماده نصبه
              </span>
              <button
                onClick={st.installUpdate}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-opacity hover:bg-emerald-600/90"
              >
                <RotateCw className="h-3.5 w-3.5" />
                نصب و راه‌اندازی مجدد
              </button>
            </>
          )}

          {(u.status === "error" || u.status === "unsupported") && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {isPortable
                ? "نسخه پرتابل آپدیت خودکار نداره"
                : "بروزرسانی خودکار فعلاً در دسترس نیست"}
            </span>
          )}
        </div>

        {(u.status === "error" || u.status === "unsupported" || u.status === "idle") && (
          <button
            onClick={() => window.electronAPI?.openExternal?.(RELEASES_URL)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            دانلود دستی از صفحه Releases گیت‌هاب
          </button>
        )}
      </section>

      {/* theme */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-bold">ظاهر برنامه</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <button
            onClick={() => applyTheme("light")}
            className={`flex items-center gap-3 rounded-[22px] p-3 text-start transition-colors ${
              theme === "light" ? "bg-primary/[0.09] ring-2 ring-primary/70" : "bg-muted/50 hover:bg-muted/70"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-inner">
              <Sun className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">حالت روز</span>
              <span className="block text-[10px] text-muted-foreground">سفید + فیروزه‌ای</span>
            </span>
          </button>
          <button
            onClick={() => applyTheme("dark")}
            className={`flex items-center gap-3 rounded-[22px] p-3 text-start transition-colors ${
              theme === "dark" ? "bg-primary/[0.09] ring-2 ring-primary/70" : "bg-muted/50 hover:bg-muted/70"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-cyan-400">
              <Moon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">حالت شب</span>
              <span className="block text-[10px] text-muted-foreground">مشکی + فیروزه‌ای</span>
            </span>
          </button>
        </div>
      </section>

      {/* desktop behaviour — only in the packaged app */}
      {isDesktop && (
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-bold">رفتار دسکتاپ</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PanelBottom className="h-3.5 w-3.5 text-primary" />
                آیکون در سیستم‌تری (کنار ساعت)
              </p>
              <p className="text-[11px] text-muted-foreground">
                با راست‌کلیک روی آیکون، نمایش/خروج داره
              </p>
            </div>
            <Switch
              checked={prefs.tray}
              onCheckedChange={(v) => updatePrefs({ tray: v, ...(v ? {} : { closeToTray: false }) })}
              aria-label="آیکون سیستم‌تری"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Power className="h-3.5 w-3.5 text-primary" />
                بستن پنجره = رفتن به تری
              </p>
              <p className="text-[11px] text-muted-foreground">
                به‌جای خروج، برنامه مخفی می‌مونه و پایش ادامه داره (نیاز به تری)
              </p>
            </div>
            <Switch
              checked={prefs.closeToTray}
              disabled={!prefs.tray}
              onCheckedChange={(v) => updatePrefs({ closeToTray: v })}
              aria-label="بستن به تری"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                اجرای خودکار با ویندوز
              </p>
              <p className="text-[11px] text-muted-foreground">
                بعد از روشن‌شدن سیستم، STAG خودش بالا میاد
              </p>
            </div>
            <Switch
              checked={prefs.autostart}
              onCheckedChange={(v) => updatePrefs({ autostart: v })}
              aria-label="اجرای خودکار با ویندوز"
            />
          </div>
        </section>
      )}

      {/* troubleshooter (فاز ۸) */}
      <Troubleshooter />

      {/* test options */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-bold">گزینه‌های تست</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">تست پورت‌های TCP بازی</p>
            <p className="text-[11px] text-muted-foreground">
              در تست کامل، علاوه بر DNS، پورت‌های آنلاین بازی هم چک میشه (کمی طولانی‌تر)
            </p>
          </div>
          <Switch checked={st.tcpEnabled} onCheckedChange={st.setTcpEnabled} aria-label="تست TCP" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
          <div>
            <p className="text-sm font-medium">سقف سرویس‌های فعال</p>
            <p className="text-[11px] text-muted-foreground">
              حداکثر {MAX_SERVICES} سرویس DNS به‌صورت همزمان — هر سرویس با هر دو آی‌پی خودش تست می‌شود
            </p>
          </div>
          <CountChip>{MAX_SERVICES}</CountChip>
        </div>
      </section>

      {/* data */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-bold">داده‌ها</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          لیست سرورها، بازی انتخابی و تنظیمات به‌صورت محلی ذخیره میشن. با پاک‌کردن، همه‌چیز به حالت
          اول برمی‌گرده.
        </p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("stag.state.v3");
              localStorage.removeItem("stag.state.v2");
              localStorage.removeItem("stag.servers.v1");
            } catch {
              /* noop */
            }
            toast({ title: "پاک شد", description: "برای اعمال، برنامه را دوباره باز کن." });
          }}
          className="flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
          بازنشانی داده‌ها
        </button>
      </section>

      {/* diagnostics */}
      <section className="panel p-4">
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
    <span className="ltr flex h-9 min-w-9 items-center justify-center rounded-full bg-primary/10 px-2 font-mono text-sm font-black text-primary">
      {children}
    </span>
  );
}

/* ---------------------------- troubleshooter ---------------------------- */
/**
 * فاز ۸ — one-click diagnosis for the classic failure modes: DNS port blocked,
 * internet path dead, chosen DNS broken, UAC refused. Each check is a real
 * probe through the local API — not a guess.
 */
type CheckState = "idle" | "running" | "pass" | "fail";

function Troubleshooter() {
  const st = useStag();
  const [dnsPort, setDnsPort] = useState<CheckState>("idle");
  const [internet, setInternet] = useState<CheckState>("idle");
  const [httpsPath, setHttpsPath] = useState<CheckState>("idle");
  const [busy, setBusy] = useState(false);

  const runAll = async () => {
    setBusy(true);
    setDnsPort("running");
    setInternet("running");
    setHttpsPath("running");

    // 1) plain UDP DNS query to a public resolver -> port 53 open?
    try {
      const d = (await apiFetch("/api/ping", {
        method: "POST",
        body: JSON.stringify({ server: "8.8.8.8", tcp: false, queryTimeoutMs: 3000 }),
      }).then((r) => r.json())) as { ok?: boolean };
      setDnsPort(d?.ok ? "pass" : "fail");
    } catch {
      setDnsPort("fail");
    }

    // 2) system resolver answers + internet path alive?
    try {
      const d = (await apiFetch("/api/ping", {
        method: "POST",
        body: JSON.stringify({
          server: "system",
          tcp: false,
          systemServers: st.dnsSys.primary?.servers ?? [],
        }),
      }).then((r) => r.json())) as { ok?: boolean };
      setInternet(d?.ok ? "pass" : "fail");
    } catch {
      setInternet("fail");
    }

    // 3) HTTPS (443) reachable through the current path?
    try {
      const d = (await apiFetch("/api/ping", {
        method: "POST",
        body: JSON.stringify({ server: "system", tcp: true, systemServers: st.dnsSys.primary?.servers ?? [] }),
      }).then((r) => r.json())) as { tcpOk?: boolean | null; ok?: boolean };
      setHttpsPath(d?.tcpOk === true || d?.ok ? "pass" : "fail");
    } catch {
      setHttpsPath("fail");
    }

    setBusy(false);
  };

  const icon = (s: CheckState) => {
    if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (s === "fail") return <XCircle className="h-4 w-4 text-rose-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  };

  const rows: Array<{ s: CheckState; title: string; hint: string; failHint: string }> = [
    {
      s: dnsPort,
      title: "پورت DNS (UDP 53) باز است؟",
      hint: "کوئری مستقیم به یک DNS عمومی",
      failHint: "فایروال/آنتی‌ویروس یا اپراتور پورت ۵۳ را بسته — STAG نمی‌تواند DNSها را تست کند.",
    },
    {
      s: internet,
      title: "اینترنت از DNS فعلی جواب می‌دهد؟",
      hint: "کوئری از مسیر DNS سیستم",
      failHint: "DNS فعلی یا مسیر اینترنت مشکل دارد — DNS دیگری وصل کن یا خاموشش کن.",
    },
    {
      s: httpsPath,
      title: "پورت ۴۴۳ (HTTPS) در دسترس است؟",
      hint: "دست‌دادن TCP به وب — مسیر لازم برای اکثر بازی‌ها",
      failHint: "پورت ۴۴۳ مسدود است — خیلی از سرویس‌های بازی بالا نمی‌آیند (فایروال یا پروکسی را چک کن).",
    },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Stethoscope className="h-4 w-4 text-primary" />
          عیب‌یابی سریع
        </h2>
        <button
          onClick={runAll}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "در حال بررسی..." : "اجرای بررسی‌ها"}
        </button>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.title} className="flex items-start gap-2.5 text-xs">
            <span className="mt-0.5 shrink-0">{icon(r.s)}</span>
            <span className="min-w-0">
              <span className="block font-bold">{r.title}</span>
              <span className="block text-[11px] text-muted-foreground">
                {r.s === "fail" ? r.failHint : r.hint}
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2.5 text-xs">
          <span className="mt-0.5 shrink-0">
            {st.dnsSys.supported ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-amber-500" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-bold">تغییر DNS سیستم روی این سیستم‌عامل؟</span>
            <span className="block text-[11px] text-muted-foreground">
              {st.dnsSys.supported
                ? "ویندوز — با تأیید پنجره UAC، مستقیم از داخل STAG"
                : "فقط ویندوز پشتیبانی می‌شود؛ تست پینگ روی هر سیستم‌عاملی کار می‌کند."}
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}
