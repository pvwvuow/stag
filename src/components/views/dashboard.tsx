"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Power,
  Loader2,
  Timer,
  ArrowDown,
  ShieldCheck,
  Check,
  Activity,
  Radar,
  RotateCw,
  Copy,
  ChevronLeft,
  Plug,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useStag, type ServiceMeta, type SweepResult } from "@/components/stag-store";
import { getPreset, primaryProbeHost } from "@/lib/games";
import { DNS_GROUPS } from "@/lib/dns-catalog";
import { LiveChart, type LiveSample } from "@/components/ping-chart";
import { flagUrl, latencyClass, pingQuality } from "@/components/ui-helpers";
import { useToast } from "@/hooks/use-toast";
import { GameGlyph } from "@/components/brand";

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

/** Minimal inline stat — no box, just type + hairline neighbors. */
function StatItem({
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
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 text-center">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`text-xl font-black leading-tight ${valueCls ?? "text-primary"}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
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

/* ------------------------- service result row ------------------------- */

function IpPill({ ip, r }: { ip: string; r?: SweepResult }) {
  const pending = !r;
  return (
    <span
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
        !r
          ? "bg-muted/50"
          : r.ok
            ? "bg-emerald-500/[0.08]"
            : "bg-rose-500/[0.08]"
      }`}
    >
      <span className="ltr font-mono text-[10px] text-muted-foreground" title={ip}>
        {ip}
      </span>
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      ) : r.ok ? (
        <>
          <span className={`ltr text-sm font-black leading-none ${latencyClass(r.ms)}`}>
            {r.ms}
            <span className="ms-0.5 text-[8px] font-bold text-muted-foreground">ms</span>
          </span>
          <SignalBars ms={r.ms} />
          {r.viaPort != null && (
            <span className="ltr text-[8px] font-medium text-muted-foreground/80">
              p{r.viaPort}
            </span>
          )}
          {r.msKind === "dns" && (
            <span
              className="text-[8px] font-medium text-amber-600 dark:text-amber-400"
              title="پورت بازی جواب نداد — این عدد زمان کوئری DNS است، نه پینگ سرور بازی"
            >
              زمان DNS
            </span>
          )}
          {r.tcpOk === false && (
            <span className="text-[8px] font-medium text-amber-600 dark:text-amber-400">
              ۴۴۳ بسته
            </span>
          )}
          {r.privateIp && (
            <span className="text-[8px] font-medium text-muted-foreground/80" title="DNS یک IP داخلی داد">
              IP داخلی
            </span>
          )}
        </>
      ) : (
        <span className="text-[10px] font-bold text-rose-500">بی‌پاسخ</span>
      )}
    </span>
  );
}

function ServiceResultRow({ meta }: { meta: ServiceMeta }) {
  const st = useStag();
  const { toast } = useToast();
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
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors ${
        winner ? "rounded-[22px] bg-primary/[0.07]" : ""
      }`}
    >
      <FlagCircle cc={meta.cc} size="h-8 w-8" />
      <div className="min-w-0 basis-40">
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

      {/* paired DNS addresses — side by side */}
      <div className="flex flex-wrap items-center gap-1.5">
        {meta.ips.map((ip) => (
          <IpPill key={ip} ip={ip} r={st.sweepResults[ip]} />
        ))}
      </div>

      <div className="ms-auto flex items-center gap-2">
        {winner && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground">
            بهترین
          </span>
        )}
        <span className="ltr w-16 text-end font-mono text-base font-black text-primary">
          {bestMs !== null ? `${bestMs} ms` : pendingOrDash(tested, st.sweeping && !tested)}
        </span>
        <button
          onClick={() => st.connectDns(meta.id)}
          disabled={st.dnsAction !== null}
          title="این DNS را روی ویندوز فعال کن"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
        >
          <Plug className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => st.selectService(meta.id)}
          title={selected ? "انتخاب‌شده برای دکمه برق" : "انتخاب به‌عنوان DNS پیش‌فرض دکمه برق"}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={copy}
          title="کپی آی‌پی‌ها"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function pendingOrDash(tested: boolean, pending: boolean): string {
  if (pending) return "…";
  if (tested) return "—";
  return "";
}

/* --------------------------- system DNS card --------------------------- */

function SystemDnsCard() {
  const st = useStag();
  const s = st.dnsSys;
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          وضعیت DNS سیستم
        </h2>
        <button
          onClick={() => st.refreshDns()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                s.on ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60" : "bg-muted-foreground/40"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{s.on ? "DNS روشنه" : "DNS خاموشه"}</p>
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
            <p className="ltr mt-2.5 rounded-full bg-muted/60 px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
              {s.primary.servers.join("  ·  ")}
            </p>
          )}
          {s.primary && (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              اینترفیس: <span className="ltr font-mono">{s.primary.alias}</span>
            </p>
          )}

          {s.on && !st.sysMatch && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              این DNS را خودت دستی روی سیستم گذاشتی؛ دکمه برق برش می‌گرداند به حالت خودکار.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={st.flushDns}
              disabled={st.dnsAction !== null}
              className="flex-1 rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              پاک کردن کش DNS
            </button>
            <button
              onClick={st.checkConnection}
              className="flex-1 rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
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
  // Live-monitor the real game/auth server, not the marketing website.
  const domain = game ? primaryProbeHost(game) ?? null : null;

  /* live target: system DNS when connected, else selected/best service.
     Plain value — the live loop reads it through a ref, so a new identity
     per render is harmless (and the compiler auto-memoizes). */
  const liveTarget = (() => {
    if (st.dnsSys.on) {
      return { server: "system", label: st.sysMatch ? `DNS سیستم (${st.sysMatch.name})` : "DNS سیستم" };
    }
    const svc =
      (st.selectedService ? st.metaFor(st.selectedService) : null) ??
      (st.bestService ? st.metaFor(st.bestService.id) : null) ??
      st.services[0] ??
      null;
    if (!svc) return null;
    return { server: svc.ips[0], label: `${svc.latin} — ${svc.ips[0]}` };
  })();

  /* fresh samples per target — never mix two targets in one chart */
  const targetKey = liveTarget?.server ?? null;
  const prevTargetKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevTargetKey.current !== null && prevTargetKey.current !== targetKey) {
      setSamples([]);
    }
    prevTargetKey.current = targetKey;
  }, [targetKey]);

  /* auto-start live monitor once a target exists / when system DNS turns on */
  const startedOnce = useRef(false);
  useEffect(() => {
    if ((!startedOnce.current && liveTarget) || st.dnsSys.on) {
      startedOnce.current = true;
      setLive(true);
    }
  }, [liveTarget, st.dnsSys.on]);

  /* auto-start after each sweep finishes */
  const prevSweeping = useRef(false);
  useEffect(() => {
    if (prevSweeping.current && !st.sweeping && st.bestService) setLive(true);
    prevSweeping.current = st.sweeping;
  }, [st.sweeping, st.bestService]);

  /* live loop — strict 2s cadence; target/domain read through refs so the
     interval never restarts (the old per-render effect restarted constantly) */
  const targetRef = useRef(liveTarget);
  const domainRef = useRef(domain);
  const tcpRef = useRef(st.tcpEnabled);
  const portsRef = useRef<number[]>(game?.tcpPorts ?? []);
  useEffect(() => {
    targetRef.current = liveTarget;
    domainRef.current = domain;
    tcpRef.current = st.tcpEnabled;
    portsRef.current = game?.tcpPorts ?? [];
  }, [liveTarget, domain, st.tcpEnabled, game]);

  useEffect(() => {
    if (!live) return;
    if (!targetRef.current) {
      setLive(false);
      return;
    }
    let alive = true;
    const tick = async () => {
      const target = targetRef.current;
      if (!target) return;
      let ok = false;
      let ms: number | null = null;
      let msKind: "tcp" | "dns" | null = null;
      let tcpOk: boolean | null = null;
      try {
        const r = await fetch("/api/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            server: target.server,
            domain: domainRef.current,
            tcp: tcpRef.current,
            ports: portsRef.current,
          }),
        });
        const d = await r.json();
        ok = !!d.ok;
        ms = d.ok ? (d.ms ?? null) : null;
        msKind = d.ok ? (d.msKind ?? null) : null;
        tcpOk = d.tcpOk ?? null;
      } catch {
        ok = false;
      }
      if (!alive) return;
      setSamples((s) => [...s.slice(-59), { t: Date.now(), ok, ms, msKind, tcpOk }]);
    };
    tick();
    const iv = setInterval(() => {
      if (document.hidden) return; // skip probes while minimized
      tick();
    }, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [live]);

  const liveStats = useMemo(() => {
    /* A probe counts as a "delivered packet to the game server" only when we
       actually reached it. If TCP monitoring produced a verdict, that verdict
       (tcpOk) is the source of truth — a DNS answer alone does NOT mean the
       game server is reachable, so it must not be counted as a healthy packet.
       When no TCP verdict exists (TCP off / DNS-time fallback) we fall back to
       the request-level ok flag. */
    const reachable = (s: LiveSample) =>
      s.tcpOk === true ? true : s.tcpOk === false ? false : s.ok;
    const delivered = samples.filter((s) => reachable(s) && s.ms !== null);
    /* Latency stats use ONLY real game-server RTTs when any exist, so a stray
       DNS-time fallback never pollutes the average/jitter. If every sample is a
       DNS-time fallback we still show it (clearly labelled elsewhere). */
    const tcpVals = delivered.filter((s) => s.msKind === "tcp").map((s) => s.ms as number);
    const anyVals = delivered.map((s) => s.ms as number);
    const vals = tcpVals.length ? tcpVals : anyVals;
    const kind: "tcp" | "dns" | "mixed" =
      tcpVals.length && tcpVals.length === anyVals.length
        ? "tcp"
        : tcpVals.length
          ? "mixed"
          : "dns";
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
    const loss = samples.length
      ? Math.round(((samples.length - delivered.length) / samples.length) * 100)
      : null;
    return { cur, avg, min, max, jitter, loss, kind, total: samples.length };
  }, [samples]);

  const busy = st.dnsAction !== null;
  const dnsOn = st.dnsSys.on;

  const togglePower = () => {
    if (dnsOn) st.disconnectDns();
    else st.connectDns();
  };

  /* what the power button will apply right now */
  const powerTarget = (() => {
    if (dnsOn) return st.sysMatch;
    const id = st.selectedService ?? st.bestService?.id ?? st.services[0]?.id ?? null;
    return id ? st.metaFor(id) : null;
  })();

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
  const ordered = (() => {
    if (st.sweeping) return st.services;
    const scored = st.services.map((m, i) => {
      const b = bestMsOf(m, st.sweepResults);
      return { m, i, score: b ?? (hasResultOf(m, st.sweepResults) ? 50000 : 60000) };
    });
    return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.m);
  })();

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
    <div className="h-full overflow-y-auto p-5 pt-2" dir="rtl">
      {/* selected game — always visible on the dashboard */}
      {game ? (
        <section className="panel-tint flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <GameGlyph icon={game.icon} className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">بازی انتخابی — پینگ‌ها برای همین سنجیده می‌شن</p>
            <p className="text-sm font-black" dir="rtl">
              {game.name}
              <span className="ltr ms-2 text-[10px] font-medium text-muted-foreground">{game.latin}</span>
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              دامنه: <span className="ltr font-mono">{primaryProbeHost(game)}</span> · پورت‌ها:{" "}
              <span className="ltr font-mono">{game.tcpPorts.join(", ")}</span>
              {dnsOn && (
                <>
                  {" "}· <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {st.sysMatch ? `${st.sysMatch.name} روی سیستم فعاله` : "DNS دستی فعاله"}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => st.setView("optimize")}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3.5 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
          >
            تغییر بازی
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </section>
      ) : (
        <section className="panel p-4 text-center">
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
          {/* power panel = real DNS on/off + inline stats strip */}
          <section className="panel px-5 pb-4 pt-6">
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
              <span className={`mt-5 rounded-full px-5 py-2 text-sm font-bold ${powerBadge.cls}`}>
                {powerBadge.text}
              </span>
              <p className="mt-1.5 max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
                {busy
                  ? "پنجره تأیید دسترسی مدیر (UAC) را تأیید کن"
                  : dnsOn
                    ? st.sysMatch
                      ? `${st.sysMatch.name} روی سیستم فعاله — با دکمه بالا خاموشش کن`
                      : "DNS دستی روی سیستم فعاله — با دکمه بالا به حالت خودکار برمی‌گرده"
                    : powerTarget
                      ? `با دکمه برق، ${powerTarget.name} (${powerTarget.ips.join(" ، ")}) روی ویندوز فعال می‌شود`
                      : "اول از بخش سرورها یک DNS فعال کن"}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={st.runSweep}
                disabled={st.sweeping}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-[0_0_20px_-6px] shadow-primary/50 transition-opacity hover:bg-primary/90 disabled:opacity-50"
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
                className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
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
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-5 py-2.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-400"
                >
                  <Plug className="h-4 w-4" />
                  وصل بهترین ({st.bestService.ms}ms)
                </button>
              )}
            </div>

            {/* stats strip — divided, no boxes */}
            <div className="mt-6 flex items-stretch justify-center divide-x divide-x-reverse divide-border/60">
              <StatItem
                icon={<Timer className="h-3 w-3" />}
                label="بهترین تأخیر سرور بازی"
                value={best !== null ? <span className="ltr">{best} ms</span> : "—"}
                sub={
                  avgAll !== null ? (
                    <span className="ltr">میانگین: {avgAll} ms · TCP/443</span>
                  ) : (
                    "هنوز تستی نرفته"
                  )
                }
              />
              <StatItem
                icon={<ArrowDown className="h-3 w-3" />}
                label="کاهش پینگ"
                value={improvement !== null ? <span className="ltr">%{improvement}</span> : "—"}
                sub="نسبت به میانگین سرورها"
              />
              <StatItem
                icon={<ShieldCheck className="h-3 w-3" />}
                label="پایداری اتصال"
                value={<span className={stability.cls}>{stability.label}</span>}
                sub={
                  Object.keys(st.sweepResults).length > 0
                    ? `${okServices.length} از ${st.services.length} سرویس پاسخ داد`
                    : "—"
                }
              />
            </div>
          </section>

          {/* sweep results — one list, hairline dividers, no nested boxes */}
          {st.services.length > 0 ? (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1 px-4 pb-2 pt-4">
                <h2 className="text-sm font-bold">نتایج تست سرورها</h2>
                <p className="text-[10px] text-muted-foreground">
                  {st.sweeping
                    ? "هر سرویس با هر دو DNS خودش همزمان تست می‌شود"
                    : "هر سرویس با هر دو DNS خودش — مرتب‌شده از بهترین"}
                </p>
              </div>
              <div className="divide-y divide-border/50 px-1.5 pb-1.5">
                {ordered.map((m) => (
                  <ServiceResultRow key={m.id} meta={m} />
                ))}
              </div>
            </section>
          ) : (
            <section className="panel p-5 text-center">
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
          <section className="panel p-4">
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
                <div className="mb-3 flex items-stretch justify-between divide-x divide-x-reverse divide-border/50">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">پینگ فعلی</p>
                    <p className={`ltr text-lg font-black ${latencyClass(liveStats.cur)}`}>
                      {liveStats.cur !== null ? liveStats.cur : "—"}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">میانگین / جیتر</p>
                    <p className="ltr text-lg font-black text-primary">
                      {liveStats.avg !== null ? liveStats.avg : "—"}
                      <span className="ms-1 text-[9px] font-bold text-muted-foreground">
                        ±{liveStats.jitter ?? "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">پکت دور ریخته</p>
                    <p
                      className={`text-lg font-black ${
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
                  هر ۲ ثانیه یک دست‌دادن TCP به سرور بازی{" "}
                  {game?.tcpPorts.length ? (
                    <span className="ltr">
                      (پورت {game.tcpPorts.join("/")}، ۴۴۳)
                    </span>
                  ) : null}{" "}
                  — این تأخیرِ رسیدن به سرور است، نه پینگ داخل گیم (UDP){" "}
                  {pingQuality(liveStats.avg).label !== "—"
                    ? `· کیفیت: ${pingQuality(liveStats.avg).label}`
                    : "· در انتظار داده"}
                </p>
                {liveStats.total > 0 && liveStats.kind !== "tcp" && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-[9px] text-amber-600 dark:text-amber-400">
                    <Info className="h-3 w-3 shrink-0" />
                    {liveStats.kind === "dns"
                      ? "پورت بازی جواب نداد — عدد بالا زمان پاسخ DNS است، نه پینگ واقعی سرور بازی"
                      : "بخشی از نمونه‌ها فقط زمان DNS بود — پینگ نمایش‌داده‌شده از دست‌دادن واقعی سرور بازی گرفته شده"}
                  </p>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                اول یک سرور انتخاب یا تست کن تا پایش زنده روشن شود.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
