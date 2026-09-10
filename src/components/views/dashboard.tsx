"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Power,
  Loader2,
  Timer,
  ArrowDown,
  ShieldCheck,
  Globe,
  Check,
  Activity,
  Radar,
  RotateCw,
  Copy,
  ChevronLeft,
  Plug,
  Info,
} from "lucide-react";
import { useStag, DNS_CATALOG, type ServiceMeta, type SweepResult } from "@/components/stag-store";
import { getPreset } from "@/lib/games";
import { DNS_GROUPS } from "@/lib/dns-catalog";
import { LiveChart, type LiveSample } from "@/components/ping-chart";
import { flagUrl, latencyClass, pingQuality } from "@/components/ui-helpers";
import { useToast } from "@/hooks/use-toast";
import { GameGlyph } from "@/components/brand";
import { Badge } from "@/components/ui/badge";

/* ------------------------------ atoms ------------------------------ */

export function SignalBars({ ms }: { ms: number | null }) {
  const lvl = ms === null ? 0 : ms < 80 ? 4 : ms < 180 ? 3 : ms < 400 ? 2 : 1;
  const color =
    ms === null
      ? "bg-muted-foreground/30"
      : ms < 80
        ? "bg-emerald-500"
        : ms < 180
          ? "bg-cyan-500"
          : ms < 400
            ? "bg-amber-500"
            : "bg-rose-500";
  const heights = [4, 7, 10, 13];
  return (
    <span className="flex items-end gap-[2px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={h}
          className={`w-[3px] rounded-[1px] ${i < lvl ? color : "bg-muted-foreground/25"}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}

export function FlagCircle({ cc, size = "h-9 w-9" }: { cc: string; size?: string }) {
  return (
    <span className={`${size} shrink-0 overflow-hidden rounded-full border border-border bg-muted`}>
      <img src={flagUrl(cc)} alt="" className="h-full w-full object-cover" draggable={false} />
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueCls,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueCls?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 text-center">
      <p className="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`text-2xl font-black leading-tight ${valueCls ?? "text-primary"}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function groupLabel(meta: ServiceMeta): string {
  if (meta.custom) return "سرور دلخواه";
  return DNS_GROUPS.find((g) => g.id === meta.group)?.label ?? "";
}

function bestMsOf(meta: ServiceMeta, sweep: Record<string, SweepResult>): number | null {
  const vals = meta.ips
    .map((ip) => sweep[ip])
    .filter((r): r is SweepResult & { ok: true; ms: number } => !!r?.ok && typeof r.ms === "number")
    .map((r) => r.ms);
  return vals.length ? Math.min(...vals) : null;
}

function hasResultOf(meta: ServiceMeta, sweep: Record<string, SweepResult>): boolean {
  return meta.ips.some((ip) => !!sweep[ip]);
}

/* ------------------------- service result card ------------------------- */

function ServiceSweepCard({ meta }: { meta: ServiceMeta }) {
  const st = useStag();
  const { toast } = useToast();
  const pairs = meta.ips.map((ip) => ({ ip, r: st.sweepResults[ip] }));
  const pending = st.sweeping && pairs.some((p) => !p.r);
  const bestMs = bestMsOf(meta, st.sweepResults);
  const tested = hasResultOf(meta, st.sweepResults);
  const winner = st.bestService?.id === meta.id && !st.sweeping && bestMs !== null;
  const selected = st.selectedService === meta.id;

  const copy = () => {
    const text = meta.ips.join(", ");
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: "کپی شد", description: text }),
      () => toast({ title: "کپی نشد", variant: "destructive" }),
    );
  };

  return (
    <div
      className={`rounded-2xl border p-3.5 transition-colors ${
        winner
          ? "border-primary/60 bg-primary/[0.06] shadow-[0_8px_30px_-14px] shadow-primary/50"
          : "border-border bg-card/70"
      }`}
    >
      {/* service header — name + which service this is */}
      <div className="flex items-center gap-2.5">
        <FlagCircle cc={meta.cc} size="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" dir="rtl">
            {meta.name}
            {!meta.custom && (
              <span className="ltr ms-1.5 text-[10px] font-medium text-muted-foreground">
                {meta.latin}
              </span>
            )}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{groupLabel(meta)}</p>
        </div>
        {winner && (
          <Badge className="border border-primary/40 bg-primary/15 text-[10px] text-primary">
            بهترین
          </Badge>
        )}
        <span className="ltr font-mono text-sm font-black text-primary">
          {bestMs !== null ? `${bestMs} ms` : pending ? "…" : tested ? "—" : ""}
        </span>
      </div>

      {/* the paired DNS addresses — side by side */}
      <div className={`mt-2.5 grid gap-2 ${meta.ips.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {pairs.map(({ ip, r }) => (
          <div
            key={ip}
            className={`rounded-xl border p-2 text-center ${
              r
                ? r.ok
                  ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                  : "border-rose-500/30 bg-rose-500/[0.05]"
                : "border-border bg-background/60"
            }`}
          >
            <p className="ltr truncate font-mono text-[10px] text-muted-foreground" title={ip}>
              {ip}
            </p>
            {pending && !r ? (
              <Loader2 className="mx-auto mt-1.5 h-4 w-4 animate-spin text-primary" />
            ) : r?.ok ? (
              <>
                <p className={`ltr text-lg font-black leading-tight ${latencyClass(r.ms)}`}>
                  {r.ms}
                  <span className="ms-1 text-[10px] font-bold text-muted-foreground">ms</span>
                </p>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <SignalBars ms={r.ms} />
                  {r.tcpOk === true && (
                    <span className="ltr text-[9px] text-muted-foreground">tcp {r.tcpMs}ms</span>
                  )}
                  {r.tcpOk === false && (
                    <span className="text-[9px] text-amber-600 dark:text-amber-400">
                      پورت ۴۴۳ بسته
                    </span>
                  )}
                </div>
              </>
            ) : r ? (
              <p className="mt-1.5 text-xs font-bold text-rose-500">بی‌پاسخ</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">—</p>
            )}
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => st.connectDns(meta.id)}
          disabled={st.dnsAction !== null}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <Plug className="h-3.5 w-3.5" />
          وصل این DNS
        </button>
        <button
          onClick={() => st.selectService(meta.id)}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          {selected ? "انتخاب‌شده" : "انتخاب"}
        </button>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
          کپی
        </button>
      </div>
    </div>
  );
}

/* --------------------------- system DNS card --------------------------- */

function SystemDnsCard() {
  const st = useStag();
  const s = st.dnsSys;
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          وضعیت DNS سیستم
        </h2>
        <button
          onClick={() => st.refreshDns()}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          title="بررسی دوباره"
          aria-label="بررسی دوباره"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {!s.loaded ? (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال خواندن وضعیت سیستم...
        </div>
      ) : !s.supported ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          تشخیص و تغییر DNS سیستم فقط روی ویندوز فعال است؛ در محیط فعلی فقط تست‌ها کار می‌کنند.
        </p>
      ) : (
        <>
          <div
            className={`rounded-xl border p-3 ${
              s.on ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-border bg-background/60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  s.on ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60" : "bg-muted-foreground/40"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">
                  {s.on ? "DNS روشنه" : "DNS خاموشه"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {s.on
                    ? st.sysMatch
                      ? `${st.sysMatch.name} (${st.sysMatch.latin})`
                      : "DNS دستی — از خارج STAG ست شده"
                    : "سیستم روی حالت خودکار (DHCP) است"}
                </p>
              </div>
            </div>
            {s.on && s.primary && s.primary.servers.length > 0 && (
              <p className="ltr mt-2 rounded-lg bg-muted/60 px-2 py-1 text-center font-mono text-[11px] text-muted-foreground">
                {s.primary.servers.join("  ·  ")}
              </p>
            )}
            {s.primary && (
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                اینترفیس: <span className="ltr font-mono">{s.primary.alias}</span>
              </p>
            )}
          </div>

          {s.on && !st.sysMatch && (
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              این DNS را خودت دستی روی سیستم گذاشتی؛ دکمه برق برش می‌گرداند به حالت خودکار.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={st.flushDns}
              disabled={st.dnsAction !== null}
              className="rounded-lg bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              پاک کردن کش DNS
            </button>
            <button
              onClick={st.checkConnection}
              className="rounded-lg bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              بررسی اتصال اینترنت
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------- dashboard ---------------------------- */

export function Dashboard() {
  const st = useStag();
  const [live, setLive] = useState(false);
  const [samples, setSamples] = useState<LiveSample[]>([]);
  const game = getPreset(st.gameId);
  const domain = game?.domains[0] ?? null;

  /* live target: system DNS when connected, else selected/best service */
  const liveTarget = (() => {
    if (st.dnsSys.on) return { server: "system", label: "DNS سیستم" };
    const svc =
      (st.selectedService ? st.metaFor(st.selectedService) : null) ??
      (st.bestService ? st.metaFor(st.bestService.id) : null) ??
      st.services[0] ??
      null;
    if (!svc) return null;
    return { server: svc.ips[0], label: `${svc.latin} — ${svc.ips[0]}` };
  })();

  /* auto-start live monitor once a target exists */
  const startedOnce = useRef(false);
  useEffect(() => {
    if (!startedOnce.current && liveTarget) {
      startedOnce.current = true;
      setLive(true);
    }
  }, [liveTarget]);

  /* auto-start after each sweep finishes */
  const prevSweeping = useRef(false);
  useEffect(() => {
    if (prevSweeping.current && !st.sweeping && st.bestService) setLive(true);
    prevSweeping.current = st.sweeping;
  }, [st.sweeping, st.bestService]);

  /* live loop */
  useEffect(() => {
    if (!live) return;
    if (!liveTarget) {
      setLive(false);
      return;
    }
    let alive = true;
    const tick = async () => {
      let ok = false;
      let ms: number | null = null;
      try {
        const r = await fetch("/api/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ server: liveTarget.server, domain, tcp: st.tcpEnabled }),
        });
        const d = await r.json();
        ok = !!d.ok;
        ms = d.ok ? (d.ms ?? null) : null;
      } catch {
        ok = false;
      }
      if (!alive) return;
      setSamples((s) => [...s.slice(-59), { t: Date.now(), ok, ms }]);
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [live, liveTarget, domain, st.tcpEnabled]);

  const liveStats = useMemo(() => {
    const ok = samples.filter((s) => s.ok && s.ms !== null);
    const vals = ok.map((s) => s.ms as number);
    const cur = vals.length ? vals[vals.length - 1] : null;
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    let jitter: number | null = null;
    if (vals.length >= 2) {
      let sum = 0;
      for (let i = 1; i < vals.length; i++) sum += Math.abs(vals[i] - vals[i - 1]);
      jitter = Math.round(sum / (vals.length - 1));
    }
    const loss = samples.length ? Math.round(((samples.length - ok.length) / samples.length) * 100) : null;
    return { cur, avg, min, max, jitter, loss, total: samples.length };
  }, [samples]);

  const busy = st.dnsAction !== null;
  const dnsOn = st.dnsSys.on;

  const togglePower = () => {
    if (dnsOn) st.disconnectDns();
    else st.connectDns();
  };

  /* stats trio from sweep */
  const okServices = st.services.filter((m) => bestMsOf(m, st.sweepResults) !== null);
  const allTestedMs = Object.values(st.sweepResults)
    .filter((r): r is SweepResult & { ok: true; ms: number } => r.ok && typeof r.ms === "number")
    .map((r) => r.ms);
  const avgAll = allTestedMs.length
    ? Math.round(allTestedMs.reduce((a, b) => a + b, 0) / allTestedMs.length)
    : null;
  const best = st.bestService?.ms ?? null;
  const improvement =
    best !== null && avgAll !== null && avgAll > best ? Math.round(((avgAll - best) / avgAll) * 100) : null;
  const stability =
    st.services.length === 0 || !Object.keys(st.sweepResults).length
      ? { label: "—", cls: "text-muted-foreground" }
      : okServices.length === st.services.length
        ? { label: "عالی", cls: "text-emerald-600 dark:text-emerald-400" }
        : okServices.length >= st.services.length * 0.6
          ? { label: "خوب", cls: "text-primary" }
          : { label: "ضعیف", cls: "text-rose-600 dark:text-rose-400" };

  /* results order: activation order while sweeping, best-first after */
  const ordered = useMemo(() => {
    if (st.sweeping) return st.services;
    const scored = st.services.map((m, i) => {
      const b = bestMsOf(m, st.sweepResults);
      return { m, i, score: b ?? (hasResultOf(m, st.sweepResults) ? 50000 : 60000) };
    });
    return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.m);
  }, [st.services, st.sweeping, st.sweepResults]);

  const powerBadge = busy
    ? st.dnsAction === "apply"
      ? { text: "در حال وصل کردن...", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
      : st.dnsAction === "off"
        ? { text: "در حال خاموش کردن...", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
        : { text: "یک لحظه...", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
    : dnsOn
      ? { text: "DNS روشنه", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
      : { text: "DNS خاموشه", cls: "bg-muted/70 text-muted-foreground" };

  return (
    <div className="h-full overflow-y-auto p-4 pt-1" dir="rtl">
      {/* selected game — always visible on the dashboard */}
      {game ? (
        <section className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <GameGlyph icon={game.icon} className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">بازی انتخابی — پینگ‌ها برای همین سنجیده می‌شن</p>
            <p className="text-sm font-black" dir="rtl">
              {game.name}
              <span className="ltr ms-2 text-[10px] font-medium text-muted-foreground">{game.latin}</span>
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              دامنه: <span className="ltr font-mono">{game.domains[0]}</span> · پورت‌ها:{" "}
              <span className="ltr font-mono">{game.tcpPorts.join(", ")}</span>
            </p>
          </div>
          <button
            onClick={() => st.setView("optimize")}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
          >
            تغییر بازی
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            هنوز بازی‌ای انتخاب نشده —{" "}
            <button onClick={() => st.setView("optimize")} className="font-bold text-primary hover:underline">
              انتخاب بازی
            </button>
          </p>
        </section>
      )}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------- main column ---------------- */}
        <div className="min-w-0 space-y-4">
          {/* power panel = real DNS on/off */}
          <section className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="flex flex-col items-center">
              <button
                onClick={togglePower}
                disabled={busy}
                aria-label={dnsOn ? "خاموش کردن DNS سیستم" : "وصل کردن DNS روی سیستم"}
                className={`power-btn group ${dnsOn ? "is-on" : ""} ${busy ? "is-busy" : ""}`}
              >
                <span className="power-core">
                  {busy ? (
                    <Loader2 className="h-9 w-9 animate-spin text-white" />
                  ) : (
                    <Power className="h-9 w-9 text-white" strokeWidth={2.5} />
                  )}
                </span>
              </button>
              <span className={`mt-4 rounded-full px-5 py-2 text-sm font-bold ${powerBadge.cls}`}>
                {powerBadge.text}
              </span>
              <p className="mt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                {busy
                  ? "پنجره تأیید دسترسی مدیر (UAC) را تأیید کن"
                  : dnsOn
                    ? st.sysMatch
                      ? `${st.sysMatch.name} روی سیستم فعاله — با دکمه بالا خاموشش کن`
                      : "DNS دستی روی سیستم فعاله — با دکمه بالا به حالت خودکار برمی‌گرده"
                    : "دکمه برق، DNS انتخابی را واقعاً روی ویندوز فعال می‌کند"}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={st.runSweep}
                disabled={st.sweeping}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-[0_0_20px_-6px] shadow-primary/50 transition-opacity hover:bg-primary/90 disabled:opacity-50"
              >
                {st.sweeping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radar className="h-4 w-4" />
                )}
                {st.sweeping ? "در حال تست همزمان..." : "تست پینگ سرورها"}
              </button>
              <button
                onClick={() => setLive((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  live
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="h-4 w-4" />
                {live ? "توقف پایش زنده" : "پایش زنده"}
              </button>
              {!dnsOn && st.bestService && (
                <button
                  onClick={() => st.connectDns()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-400"
                >
                  <Plug className="h-4 w-4" />
                  وصل بهترین ({st.bestService.ms}ms)
                </button>
              )}
            </div>
          </section>

          {/* stats trio */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Timer className="h-3.5 w-3.5" />}
              label="بهترین پینگ گیم"
              value={best !== null ? <span className="ltr">{best} ms</span> : "—"}
              sub={avgAll !== null ? <span className="ltr">میانگین: {avgAll} ms</span> : "هنوز تستی نرفته"}
            />
            <StatCard
              icon={<ArrowDown className="h-3.5 w-3.5" />}
              label="کاهش پینگ"
              value={improvement !== null ? <span className="ltr">%{improvement}</span> : "—"}
              sub="نسبت به میانگین سرورها"
            />
            <StatCard
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="پایداری اتصال"
              value={<span className={stability.cls}>{stability.label}</span>}
              sub={
                Object.keys(st.sweepResults).length > 0
                  ? `${okServices.length} از ${st.services.length} سرویس پاسخ داد`
                  : "—"
              }
            />
          </div>

          {/* sweep results — grouped per service, paired IPs side by side */}
          {st.services.length > 0 ? (
            <section className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h2 className="text-sm font-bold">نتایج تست سرورها</h2>
                <p className="text-[10px] text-muted-foreground">
                  {st.sweeping
                    ? "هر سرویس با هر دو DNS خودش همزمان تست می‌شود"
                    : "هر سرویس با هر دو DNS خودش — مرتب‌شده از بهترین"}
                </p>
              </div>
              {ordered.map((m) => (
                <ServiceSweepCard key={m.id} meta={m} />
              ))}
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">
                هنوز سرویسی فعال نکردی —{" "}
                <button
                  onClick={() => st.setView("servers")}
                  className="font-bold text-primary hover:underline"
                >
                  از بخش سرورها
                </button>{" "}
                حداقل یک DNS اضافه کن.
              </p>
            </section>
          )}
        </div>

        {/* ---------------- side column ---------------- */}
        <div className="min-w-0 space-y-4">
          <SystemDnsCard />

          {/* live monitor */}
          <section className="rounded-2xl border border-border bg-card/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Activity className="h-4 w-4 text-primary" />
                پایش زنده
              </h2>
              <button
                onClick={() => setLive((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  live
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50"
                  }`}
                />
                {live ? "لایو" : "خاموش"}
              </button>
            </div>

            {liveTarget ? (
              <>
                <p className="mb-2 truncate text-[10px] text-muted-foreground">
                  از طریق: <span className="ltr font-mono">{liveTarget.label}</span>
                  {domain && (
                    <>
                      {" "}
                      · دامنه <span className="ltr font-mono">{domain}</span>
                    </>
                  )}
                </p>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-border bg-background/60 p-2">
                    <p className="text-[9px] text-muted-foreground">پینگ فعلی</p>
                    <p className={`ltr text-base font-black ${latencyClass(liveStats.cur)}`}>
                      {liveStats.cur !== null ? liveStats.cur : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-2">
                    <p className="text-[9px] text-muted-foreground">میانگین / جیتر</p>
                    <p className="ltr text-base font-black text-primary">
                      {liveStats.avg !== null ? liveStats.avg : "—"}
                      <span className="ms-1 text-[9px] font-bold text-muted-foreground">
                        ±{liveStats.jitter ?? "—"}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-2">
                    <p className="text-[9px] text-muted-foreground">پکتِ دور ریخته</p>
                    <p
                      className={`text-base font-black ${
                        liveStats.loss && liveStats.loss > 5
                          ? "text-rose-500"
                          : liveStats.loss
                            ? "text-amber-500"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {liveStats.loss !== null ? `%${liveStats.loss}` : "—"}
                    </p>
                  </div>
                </div>
                <LiveChart samples={samples} />
                <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                  هر ۲ ثانیه یک پکت واقعی به سرور بازی —{" "}
                  {pingQuality(liveStats.avg).label !== "—"
                    ? `کیفیت: ${pingQuality(liveStats.avg).label}`
                    : "در انتظار داده"}
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                اول یک سرور انتخاب یا تست کن تا پایش زنده روشن شود.
              </p>
            )}
          </section>

          {/* benefits */}
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-primary" />
              مزایای STAG
            </h2>
            <ul className="space-y-2 text-xs leading-relaxed text-foreground/85">
              {[
                "پینگ واقعی برای بازی انتخابی — نه پینگ الکی",
                "هر سرویس با هر دو DNS خودش کنار هم تست می‌شود",
                "دکمه برق، DNS را واقعاً روی ویندوز وصل/قطع می‌کند",
                "پایش زنده پینگ و پکت با نمودار لحظه‌ای",
                "کاملاً آفلاین — تست از اینترنت خودت",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
