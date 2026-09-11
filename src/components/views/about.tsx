"use client";

import { useEffect, useState } from "react";
import { Github, ShieldCheck, Wifi, Gauge, Gamepad2, Download, FileText, Copy, Check } from "lucide-react";
import { StagMark } from "@/components/brand";
import { useToast } from "@/hooks/use-toast";
import { useStag, GAME_PRESETS } from "@/components/stag-store";
import { APP_VERSION } from "@/lib/version";

export function About() {
  const { toast } = useToast();
  const st = useStag();
  const t = st.t;
  const [version, setVersion] = useState(APP_VERSION);
  const [logsCopied, setLogsCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(!!window.electronAPI?.isDesktop);
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  // فاز ۷.۶ — one-click support bundle: copy the rotating main-process log
  // (boot, updater, embedded engine, renderer errors) to the clipboard.
  const copyLogs = async () => {
    try {
      const r = await window.electronAPI?.getLogs?.();
      if (!r?.ok) throw new Error(r?.error ?? t("about.copyFailed"));
      await navigator.clipboard.writeText(r.logs ?? "");
      setLogsCopied(true);
      setTimeout(() => setLogsCopied(false), 2500);
      toast({ title: t("about.logsTitle"), description: t("about.logsDesc") });
    } catch (err) {
      toast({
        title: t("about.copyFailed"),
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      {/* hero */}
      <section className="panel-tint flex flex-col items-center p-8 text-center">
        <StagMark className="h-24 w-24" />
        <h1 className="ltr mt-4 text-4xl font-black tracking-[0.3em] text-primary">STAG</h1>
        <p className="ltr mt-2 text-xs font-medium tracking-widest text-muted-foreground">
          Lower Ping • Better Play
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("about.version", { v: version })}
        </p>
      </section>

      {/* description */}
      <section className="panel p-5">
        <p className="text-sm leading-7 text-foreground/90">{t("about.desc")}</p>
      </section>

      {/* features */}
      <section className="panel overflow-hidden">
        <div className="grid gap-px bg-border/40 sm:grid-cols-2">
          {[
            {
              icon: <Gauge className="h-4 w-4 text-primary" />,
              title: t("about.f1"),
              d: t("about.f1d"),
            },
            {
              icon: <Gamepad2 className="h-4 w-4 text-primary" />,
              title: t("about.f2", { n: GAME_PRESETS.length }),
              d: t("about.f2d"),
            },
            {
              icon: <Wifi className="h-4 w-4 text-primary" />,
              title: t("about.f3"),
              d: t("about.f3d"),
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-primary" />,
              title: t("about.f4"),
              d: t("about.f4d"),
            },
            {
              icon: <Download className="h-4 w-4 text-primary" />,
              title: t("about.f5"),
              d: t("about.f5d"),
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-primary" />,
              title: t("about.f6"),
              d: t("about.f6d"),
            },
          ].map((f) => (
            <div key={f.title} className="bg-card/80 p-3.5">
              <p className="flex items-center gap-2 text-sm font-bold">
                {f.icon}
                {f.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* credits */}
      <section className="panel p-4">
        <h2 className="mb-2 text-sm font-bold">{t("about.builtWith")}</h2>
        <ul className="ltr space-y-1 text-[11px] text-muted-foreground">
          <li>• Next.js + Electron + Tailwind CSS</li>
          <li>• Font: Vazirmatn (OFL) — Icons: Lucide</li>
          <li>• Brand glyphs: simple-icons (CC0)</li>
          <li>• Stag mark: game-icons «Deer Head» by Delapouite (CC BY 3.0)</li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              window.electronAPI?.openExternal?.("https://github.com/pvwvuow/stag")
            }
            className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
          >
            <Github className="h-4 w-4" />
            <span className="ltr">github.com/pvwvuow/stag</span>
          </button>
          {isDesktop && (
            <button
              onClick={copyLogs}
              className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3.5 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
              title={t("about.logsTip")}
            >
              {logsCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {logsCopied ? t("about.copied") : t("about.copyLogs")}
              {!logsCopied && <FileText className="h-3.5 w-3.5 opacity-60" />}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
