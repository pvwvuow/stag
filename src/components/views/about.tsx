"use client";

import { useEffect, useState } from "react";
import { Github, ShieldCheck, Wifi, Gauge, Gamepad2, Download } from "lucide-react";
import { StagMark } from "@/components/brand";
import { useStag } from "@/components/stag-store";

export function About() {
  const st = useStag();
  const [version, setVersion] = useState("1.3.0");
  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

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
          نسخه <span className="ltr font-mono">{version}</span>
        </p>
      </section>

      {/* description */}
      <section className="panel p-5">
        <p className="text-sm leading-7 text-foreground/90">
          STAG یک تستر سلامت DNS مخصوص گیمره. به‌جای اینکه بازی را باز کنی و ببینی سرور پیدا
          نمیشه، STAG دامنه‌های واقعی هر بازی را مستقیم از سیستم خودت روی DNSهایی که ست کردی کوئری
          می‌گیرد، پینگ هر سرور را می‌سنجد، مسیرهای اختصاصی را شناسایی می‌کند و پورت‌های آنلاین بازی
          را هم چک می‌کند — همه‌چیز همزمان، موازی و کاملاً آفلاین.
        </p>
      </section>

      {/* features */}
      <section className="panel overflow-hidden">
        <div className="grid gap-px bg-border/40 sm:grid-cols-2">
          {[
            {
              icon: <Gauge className="h-4 w-4 text-primary" />,
              t: "تست همزمان تا ۱۲ سرور",
              d: "همه DNSهای فعال در یک لحظه و به‌صورت موازی سنجیده میشن.",
            },
            {
              icon: <Gamepad2 className="h-4 w-4 text-primary" />,
              t: "۱۸ بازی و پلتفرم",
              d: "از Marvel Rivals و Valorant تا PSN و Xbox با دامنه‌های واقعی.",
            },
            {
              icon: <Wifi className="h-4 w-4 text-primary" />,
              t: "کاملاً آفلاین",
              d: "سرور تست داخل خود برنامه است؛ هیچ اطلاعاتی جایی ارسال نمیشه.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-primary" />,
              t: "بدون نصب درایور",
              d: "فقط کوئری UDP معمولی روی پورت ۵۳ — نه VPN هست نه دستکاری سیستم.",
            },
            {
              icon: <Download className="h-4 w-4 text-primary" />,
              t: "بروزرسانی سبک داخل برنامه",
              d: "آپدیت فقط بخش‌های تغییرکرده را دانلود می‌کند — از بخش تنظیمات.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-primary" />,
              t: "وصل و خاموش واقعی DNS",
              d: "دکمه برق DNS ویندوز را عوض می‌کند و هر DNS دستی قبلی را هم نشان میدهد.",
            },
          ].map((f) => (
            <div key={f.t} className="bg-card/80 p-3.5">
              <p className="flex items-center gap-2 text-sm font-bold">
                {f.icon}
                {f.t}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* credits */}
      <section className="panel p-4">
        <h2 className="mb-2 text-sm font-bold">ساخته‌شده با</h2>
        <ul className="ltr space-y-1 text-[11px] text-muted-foreground">
          <li>• Next.js + Electron + Tailwind CSS</li>
          <li>• Font: Vazirmatn (OFL) — Icons: Lucide</li>
          <li>• Brand glyphs: simple-icons (CC0)</li>
          <li>• Stag mark: game-icons «Deer Head» by Delapouite (CC BY 3.0)</li>
        </ul>
        <button
          onClick={() =>
            window.electronAPI?.openExternal?.("https://github.com/pvwvuow/stag")
          }
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted/70 px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
        >
          <Github className="h-4 w-4" />
          <span className="ltr">github.com/pvwvuow/stag</span>
        </button>
      </section>
    </div>
  );
}
