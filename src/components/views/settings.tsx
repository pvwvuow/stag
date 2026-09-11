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
  ShieldCheck,
  ShieldAlert,
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
  const t = st.t;
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
          {t("set.title")}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("set.subtitle")}</p>
      </div>

      {/* in-app updates */}
      <section className="panel p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <PackageCheck className="h-4 w-4 text-primary" />
          {t("set.updates")}
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("set.updatesDesc")}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
            {t("set.currentVer")} <span className="ltr font-mono text-foreground">{version}</span>
          </span>

          {u.status === "idle" && (
            <button
              onClick={st.checkForUpdates}
              disabled={!isDesktop}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("set.check")}
            </button>
          )}

          {u.status === "checking" && (
            <span className="flex items-center gap-2 rounded-full bg-muted/70 px-4 py-2 text-xs font-bold text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("set.checking")}
            </span>
          )}

          {u.status === "available" && (
            <>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
                {t("set.avail", { v: u.version ?? "" })}
              </span>
              <button
                onClick={st.downloadUpdate}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                {t("set.download")}
              </button>
            </>
          )}

          {u.status === "downloading" && (
            <div className="min-w-56 flex-1">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>{t("set.downloading", { p: u.percent })}</span>
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
                {t("set.ready", { v: u.version ?? "" })}
              </span>
              <button
                onClick={st.installUpdate}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-opacity hover:bg-emerald-600/90"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {t("set.install")}
              </button>
            </>
          )}

          {(u.status === "error" || u.status === "unsupported") && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {isPortable ? t("set.noAutoPortable") : t("set.noAuto")}
            </span>
          )}
        </div>

        {(u.status === "error" || u.status === "unsupported" || u.status === "idle") && (
          <button
            onClick={() => window.electronAPI?.openExternal?.(RELEASES_URL)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t("set.manualDl")}
          </button>
        )}

        {u.status === "ready" && u.delta && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("set.deltaDone", { x: fmtBytes(u.transferred), y: fmtBytes(u.total) })}
          </p>
        )}
      </section>

      {/* beta.4 — elevation / system-DNS rights */}
      <section className="panel p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("set.elevation")}
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("set.elevationDesc")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {st.dnsSys.elevated ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("set.elevated")}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                {t("set.notElevated")}
              </span>
              {isDesktop && (
                <button
                  onClick={() => st.relaunchElevated()}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("set.relaunchElevated")}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* language — beta.5 */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-bold">{t("set.langSection")}</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">{t("set.langSub")}</p>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <button
            onClick={() => st.setLang("fa")}
            className={`flex items-center gap-3 rounded-[22px] p-3 text-start transition-colors ${
              st.lang === "fa" ? "bg-primary/[0.09] ring-2 ring-primary/70" : "bg-muted/50 hover:bg-muted/70"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg font-black text-primary">
              فا
            </span>
            <span>
              <span className="block text-sm font-bold">فارسی</span>
              <span className="block text-[10px] text-muted-foreground" dir="ltr">
                Persian
              </span>
            </span>
          </button>
          <button
            onClick={() => st.setLang("en")}
            className={`flex items-center gap-3 rounded-[22px] p-3 text-start transition-colors ${
              st.lang === "en" ? "bg-primary/[0.09] ring-2 ring-primary/70" : "bg-muted/50 hover:bg-muted/70"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg font-black text-primary">
              EN
            </span>
            <span>
              <span className="block text-sm font-bold">English</span>
              <span className="block text-[10px] text-muted-foreground">انگلیسی</span>
            </span>
          </button>
        </div>
      </section>

      {/* theme */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-bold">{t("set.appearance")}</h2>
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
              <span className="block text-sm font-bold">{t("set.light")}</span>
              <span className="block text-[10px] text-muted-foreground">{t("set.lightSub")}</span>
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
              <span className="block text-sm font-bold">{t("set.dark")}</span>
              <span className="block text-[10px] text-muted-foreground">{t("set.darkSub")}</span>
            </span>
          </button>
        </div>
      </section>

      {/* desktop behaviour — only in the packaged app */}
      {isDesktop && (
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-bold">{t("set.desktop")}</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PanelBottom className="h-3.5 w-3.5 text-primary" />
                {t("set.tray")}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("set.traySub")}</p>
            </div>
            <Switch
              checked={prefs.tray}
              onCheckedChange={(v) => updatePrefs({ tray: v, ...(v ? {} : { closeToTray: false }) })}
              aria-label={t("set.trayAria")}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Power className="h-3.5 w-3.5 text-primary" />
                {t("set.closeToTray")}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("set.closeToTraySub")}</p>
            </div>
            <Switch
              checked={prefs.closeToTray}
              disabled={!prefs.tray}
              onCheckedChange={(v) => updatePrefs({ closeToTray: v })}
              aria-label={t("set.closeTrayAria")}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                {t("set.autostart")}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("set.autostartSub")}</p>
            </div>
            <Switch
              checked={prefs.autostart}
              onCheckedChange={(v) => updatePrefs({ autostart: v })}
              aria-label={t("set.autostartAria")}
            />
          </div>
        </section>
      )}

      {/* troubleshooter (فاز ۸) */}
      <Troubleshooter />

      {/* test options */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-bold">{t("set.testOptions")}</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("set.tcpPorts")}</p>
            <p className="text-[11px] text-muted-foreground">{t("set.tcpPortsSub")}</p>
          </div>
          <Switch checked={st.tcpEnabled} onCheckedChange={st.setTcpEnabled} aria-label={t("set.tcpAria")} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 pt-3 hairline">
          <div>
            <p className="text-sm font-medium">{t("set.maxServices")}</p>
            <p className="text-[11px] text-muted-foreground">{t("set.maxServicesSub", { n: MAX_SERVICES })}</p>
          </div>
          <CountChip>{MAX_SERVICES}</CountChip>
        </div>
      </section>

      {/* data */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-bold">{t("set.data")}</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("set.dataDesc")}
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
            toast({ title: t("set.resetDone"), description: t("set.resetDoneDesc") });
          }}
          className="flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
          {t("set.reset")}
        </button>
      </section>

      {/* diagnostics */}
      <section className="panel p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Monitor className="h-4 w-4 text-primary" />
          {t("set.runtime")}
        </h2>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Info className="h-3 w-3" />
            {t("set.mode")} {isDesktop ? t("set.modeDesktop") : t("set.modeBrowser")}
          </li>
          <li className="flex items-center gap-2">
            <Info className="h-3 w-3" />
            {t("set.version")} <span className="ltr font-mono">{version}</span>
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
  const t = st.t;
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
    //    Iran fix: 8.8.8.8 is blocked by a few Iranian ISPs — retry with
    //    4.2.2.4 (Level3, reachable from Iran) before declaring failure.
    try {
      const d = (await apiFetch("/api/ping", {
        method: "POST",
        body: JSON.stringify({ server: "8.8.8.8", tcp: false, queryTimeoutMs: 3000 }),
      }).then((r) => r.json())) as { ok?: boolean };
      if (d?.ok) {
        setDnsPort("pass");
      } else {
        const d2 = (await apiFetch("/api/ping", {
          method: "POST",
          body: JSON.stringify({ server: "4.2.2.4", tcp: false, queryTimeoutMs: 3000 }),
        }).then((r) => r.json())) as { ok?: boolean };
        setDnsPort(d2?.ok ? "pass" : "fail");
      }
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
    //    Iran fix: probe a site that answers from Iran WITHOUT a VPN — TCP:443
    //    to Google used to fail for every Iranian user without a VPN and
    //    painted a healthy path red.
    try {
      const d = (await apiFetch("/api/ping", {
        method: "POST",
        body: JSON.stringify({
          server: "system",
          tcp: true,
          domain: "www.digikala.com",
          systemServers: st.dnsSys.primary?.servers ?? [],
        }),
      }).then((r) => r.json())) as { tcpOk?: boolean | null; ok?: boolean };
      setHttpsPath(d?.tcpOk === true ? "pass" : "fail");
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
      title: t("set.chkDnsPort"),
      hint: t("set.chkDnsPortHint"),
      failHint: t("set.chkDnsPortFail"),
    },
    {
      s: internet,
      title: t("set.chkInternet"),
      hint: t("set.chkInternetHint"),
      failHint: t("set.chkInternetFail"),
    },
    {
      s: httpsPath,
      title: t("set.chkHttps"),
      hint: t("set.chkHttpsHint"),
      failHint: t("set.chkHttpsFail"),
    },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Stethoscope className="h-4 w-4 text-primary" />
          {t("set.trouble")}
        </h2>
        <button
          onClick={runAll}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? t("set.checkingShort") : t("set.runChecks")}
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
            <span className="block font-bold">{t("set.chkOs")}</span>
            <span className="block text-[11px] text-muted-foreground">
              {st.dnsSys.supported
                ? t("set.chkOsOk")
                : t("set.chkOsFail", { p: st.dnsSys.platform ?? t("dash.custom") })}
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}
