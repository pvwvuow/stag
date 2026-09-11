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
import { groupLabel as dnsGroupLabel } from "@/lib/dns-catalog";
import { DNS_GROUPS } from "@/lib/dns-catalog";
import { apiFetch } from "@/lib/api-client";
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

function groupLabel(
  meta: ServiceMeta,
  lang: "fa" | "en",
  t: (k: string) => string,
): string {
  if (meta.custom) return t("dash.custom");
  return dnsGroupLabel(meta.group ?? "global", lang);
}

/** best latency for a service (min across its IPs) */
function bestMsOf(meta: ServiceMeta, sweep: Record<string, SweepResult>): number | null {
  const vals = meta.ips
    .map((ip) => sweep[ip])
    .filter((r): r is SweepResult & { ok: true; ms: number } => !!r?.ok && typeof r.ms === "number")
    .map((r) => r.ms);
  return vals.length ? Math.min(...vals) : null;
}

/**
 * beta.5 — WHAT the best number of this service actually is. The dashboard
 * used to show any result as a green "ping", so when game servers were
 * sanctions-blocked every DNS looked great on its DNS-server RTT alone —
 * exactly the fake-good feeling the optimizer does not have. Now the kind
 * drives the label, the color AND the ranking.
 */
function bestOfMeta(
  meta: ServiceMeta,
  sweep: Record<string, SweepResult>,
): { ms: number; kind: "tcp" | "server" | "dns" } | null {
  const ok = meta.ips
    .map((ip) => sweep[ip])
    .filter((r): r is SweepResult & { ok: true; ms: number } => !!r?.ok && typeof r.ms === "number");
  if (ok.length === 0) return null;
  const tcp = ok.filter((r) => r.msKind === "tcp").map((r) => r.ms);
  if (tcp.length > 0) return { ms: Math.min(...tcp), kind: "tcp" };
  const server = ok.filter((r) => r.msKind === "server").map((r) => r.ms);
  if (server.length > 0) return { ms: Math.min(...server), kind: "server" };
  return { ms: Math.min(...ok.map((r) => r.ms)), kind: "dns" };
}

function hasResultOf(meta: ServiceMeta, sweep: Record<string, SweepResult>): boolean {
  return meta.ips.some((ip) => !!sweep[ip]);
}

/* ------------------------- service result row ------------------------- */

function IpPill({ ip, r }: { ip: string; r?: SweepResult }) {
  const st = useStag();
  const t = st.t;
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
              title={t("dash.dnsTimeTip")}
            >
              {t("dash.dnsTime")}
            </span>
          )}
          {r.msKind === "server" && (
            <span
              className="text-[8px] font-medium text-cyan-600 dark:text-cyan-400"
              title={t("dash.dnsServerPingTip")}
            >
              {t("dash.dnsServerPing")}
            </span>
          )}
          {r.tcpOk === false && (
            <span className="text-[8px] font-medium text-amber-600 dark:text-amber-400">
              {t("dash.portBlocked")}
            </span>
          )}
          {r.privateIp && (
            <span className="text-[8px] font-medium text-muted-foreground/80" title={t("dash.privateIpTip")}>
              {t("dash.privateIp")}
            </span>
          )}
        </>
      ) : (
        <span className="text-[10px] font-bold text-rose-500">{t("dash.noReply")}</span>
      )}
    </span>
  );
}

function ServiceResultRow({ meta }: { meta: ServiceMeta }) {
  const st = useStag();
  const { toast } = useToast();
  const t = st.t;
  const best = bestOfMeta(meta, st.sweepResults);
  const bestMs = best?.ms ?? null;
  const bestKind = best?.kind ?? null;
  const tested = hasResultOf(meta, st.sweepResults);
  const winner = st.bestService?.id === meta.id && !st.sweeping && bestMs !== null;
  const selected = st.selectedService === meta.id;

  const copy = () => {
    const text = meta.ips.join(", ");
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: t("dash.copied"), description: text }),
      () => toast({ title: t("dash.copyFailed"), variant: "destructive" }),
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
        <p className="truncate text-[10px] text-muted-foreground">{groupLabel(meta, st.lang, t)}</p>
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
            {t("dash.bestBadge")}
          </span>
        )}
        {bestKind !== null && bestMs !== null && bestKind !== "tcp" && (
          <span
            className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold text-amber-600 dark:text-amber-400"
            title={t("dash.noGameRouteTip")}
          >
            {t("dash.noGameRoute")} · {t("dash.dnsPing")}
          </span>
        )}
        {bestKind === "tcp" && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            {t("dash.gamePing")}
          </span>
        )}
        <span
          className={`ltr w-16 text-end font-mono text-base font-black ${
            bestKind === "tcp" || bestKind === null ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {bestMs !== null ? `${bestMs} ms` : pendingOrDash(tested, st.sweeping && !tested)}
        </span>
        <button
          onClick={() => st.connectDns(meta.id)}
          disabled={st.dnsAction !== null}
          title={t("dash.applyThisDns")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
        >
          <Plug className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => st.selectService(meta.id)}
          title={selected ? t("dash.pickedForPower") : t("dash.pickForPower")}
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
          title={t("dash.copyIps")}
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
  const t = st.t;
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("dash.sysDnsTitle")}
        </h2>
        <button
          onClick={() => st.refreshDns()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          title={t("dash.recheck")}
          aria-label={t("dash.recheck")}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {!s.loaded ? (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("dash.readingSys")}
        </div>
      ) : !s.supported ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("dash.unsupportedHere", { p: s.platform ?? t("dash.custom") })}
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
              <p className="text-sm font-black">{s.on ? t("dash.dnsOn") : t("dash.dnsOff")}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {s.on
                  ? st.sysMatch
                    ? `${st.sysMatch.name} (${st.sysMatch.latin})`
                    : t("dash.manualDns")
                  : t("dash.dhcpAuto")}
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
              {t("dash.iface")} <span className="ltr font-mono">{s.primary.alias}</span>
            </p>
          )}

          {s.on && !st.sysMatch && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t("dash.manualNote")}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={st.flushDns}
              disabled={st.dnsAction !== null}
              className="flex-1 rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {t("dash.flush")}
            </button>
            <button
              onClick={st.checkConnection}
              className="flex-1 rounded-full bg-muted/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("dash.checkNet")}
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
      return { server: "system", label: st.sysMatch ? st.t("dash.viaSystemName", { name: st.sysMatch.name }) : st.t("dash.viaSystem") };
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
  // 3.1 — the live loop must resolve through the CURRENT system DNS, not a
  // stale c-ares cache. Keep the freshest system servers in a ref so the probe
  // always pins the resolver to what the OS uses right now.
  const sysServersRef = useRef<string[]>(st.dnsSys.primary?.servers ?? []);
  useEffect(() => {
    targetRef.current = liveTarget;
    domainRef.current = domain;
    tcpRef.current = st.tcpEnabled;
    portsRef.current = game?.tcpPorts ?? [];
    sysServersRef.current = st.dnsSys.primary?.servers ?? [];
  }, [liveTarget, domain, st.tcpEnabled, game, st.dnsSys.primary]);

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
      let msKind: "tcp" | "region" | "server" | "dns" | null = null;
      let tcpOk: boolean | null = null;
      try {
        const r = await apiFetch("/api/ping", {
          method: "POST",
          body: JSON.stringify({
            server: target.server,
            domain: domainRef.current,
            tcp: tcpRef.current,
            ports: portsRef.current,
            // beta.5 — always measure the regional game path too, so the
            // headline can fall back to the closest in-game-like number
            region: true,
            // only relevant when probing the system resolver (3.1)
            systemServers: target.server === "system" ? sysServersRef.current : undefined,
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
    /* beta.5 — honesty chain for the headline: real game TCP RTT first; then
       the REGIONAL game-path RTT (geo-pinned EU anchors — the closest number
       to what the user actually sees in-game, e.g. Frankfurt ~130ms); then
       the DNS-server RTT; then DNS query time. The DNS number is now the
       LAST resort, per the user's explicit feedback ("not my DNS's ping"). */
    const delivered = samples.filter((s) => s.ok && s.ms !== null);
    const tcpVals = delivered.filter((s) => s.msKind === "tcp").map((s) => s.ms as number);
    const regionVals = delivered.filter((s) => s.msKind === "region").map((s) => s.ms as number);
    const serverVals = delivered.filter((s) => s.msKind === "server").map((s) => s.ms as number);
    const anyVals = delivered.map((s) => s.ms as number);
    const vals = tcpVals.length
      ? tcpVals
      : regionVals.length
        ? regionVals
        : serverVals.length
          ? serverVals
          : anyVals;
    /* which kind the headline stats represent right now */
    const kind: "tcp" | "region" | "server" | "dns" | "mixed" =
      delivered.length === 0
        ? "region"
        : tcpVals.length === delivered.length
          ? "tcp"
          : regionVals.length === delivered.length
            ? "region"
            : serverVals.length === delivered.length
              ? "server"
              : serverVals.length === 0 && regionVals.length === 0 && tcpVals.length === 0
                ? "dns"
                : "mixed";
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
    const tcpFailed = delivered.some((s) => s.tcpOk === false) ||
      (samples.length > 0 && samples.every((s) => s.tcpOk === false));
    return { cur, avg, min, max, jitter, loss, kind, total: samples.length, tcpFailed };
  }, [samples]);

  const busy = st.dnsAction !== null;
  const dnsOn = st.dnsSys.on;
  const t = st.t;

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

  /* stats trio from sweep — beta.5: only REAL game-server TCP RTTs count for
     "best/avg/improvement". DNS-RTT numbers must not masquerade as game ping
     here either; when nothing reached the game, the card says so honestly. */
  const okServices = st.services.filter((m) => bestMsOf(m, st.sweepResults) !== null);
  const reachedServices = st.services.filter((m) => bestOfMeta(m, st.sweepResults)?.kind === "tcp");
  const tcpAllMs = Object.values(st.sweepResults)
    .filter(
      (r): r is SweepResult & { ok: true; ms: number } =>
        r.ok && typeof r.ms === "number" && r.msKind === "tcp",
    )
    .map((r) => r.ms);
  const anyResultAtAll = Object.keys(st.sweepResults).length > 0;
  const avgAll = tcpAllMs.length
    ? Math.round(tcpAllMs.reduce((a, b) => a + b, 0) / tcpAllMs.length)
    : null;
  const best = tcpAllMs.length ? Math.min(...tcpAllMs) : null;
  const improvement =
    best !== null && avgAll !== null && avgAll > best ? Math.round(((avgAll - best) / avgAll) * 100) : null;
  const stability =
    st.services.length === 0 || !anyResultAtAll
      ? { label: "—", cls: "text-muted-foreground" }
      : okServices.length === st.services.length
        ? { label: t("dash.stabilityGreat"), cls: "text-emerald-600 dark:text-emerald-400" }
        : okServices.length >= st.services.length * 0.6
          ? { label: t("dash.stabilityGood"), cls: "text-primary" }
          : { label: t("dash.stabilityPoor"), cls: "text-rose-600 dark:text-rose-400" };

  /* results order: activation order while sweeping; afterwards REAL game reach
     first (tcp), then the rest by DNS RTT — never a blind "lowest wins". */
  const ordered = (() => {
    if (st.sweeping) return st.services;
    const kindRank = { tcp: 0, server: 1, dns: 2 } as const;
    const scored = st.services.map((m, i) => {
      const b = bestOfMeta(m, st.sweepResults);
      const score = b
        ? kindRank[b.kind] * 100000 + b.ms
        : hasResultOf(m, st.sweepResults)
          ? 500000
          : 600000;
      return { m, i, score };
    });
    return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.m);
  })();

  const powerBadge = busy
    ? st.dnsAction === "apply"
      ? { text: t("dash.applying"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
      : st.dnsAction === "off"
        ? { text: t("dash.turningOff"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
        : { text: t("dash.moment"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
    : dnsOn
      ? { text: t("dash.dnsOn"), cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
      : { text: t("dash.dnsOff"), cls: "bg-muted/70 text-muted-foreground" };

  return (
    <div className="h-full overflow-y-auto p-5 pt-2" dir="rtl">
      {/* selected game — always visible on the dashboard */}
      {game ? (
        <section className="panel-tint flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <GameGlyph icon={game.icon} className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">{t("dash.gameBanner")}</p>
            <p className="text-sm font-black" dir="rtl">
              {game.name}
              <span className="ltr ms-2 text-[10px] font-medium text-muted-foreground">{game.latin}</span>
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {t("dash.domain")} <span className="ltr font-mono">{primaryProbeHost(game)}</span> ·{" "}
              {t("dash.ports")}{" "}
              <span className="ltr font-mono">{game.tcpPorts.join(", ")}</span>
              {dnsOn && (
                <>
                  {" "}· <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {st.sysMatch ? t("dash.activeOnSys", { name: st.sysMatch.name }) : t("dash.manualActive")}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => st.setView("optimize")}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3.5 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
          >
            {t("dash.changeGame")}
            <ChevronLeft className="h-3.5 w-3.5 rtl:-rotate-180" />
          </button>
        </section>
      ) : (
        <section className="panel p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {t("dash.noGameYet")}{" "}
            <button onClick={() => st.setView("optimize")} className="font-bold text-primary hover:underline">
              {t("dash.pickGame")}
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
                aria-label={dnsOn ? t("dash.turnOff") : t("dash.connectName", { name: "DNS" })}
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
                  ? t("dash.uacHint")
                  : dnsOn
                    ? st.sysMatch
                      ? t("dash.onHintNamed", { name: st.sysMatch.name })
                      : t("dash.onHintManual")
                    : powerTarget
                      ? t("dash.powerWillApply", { name: powerTarget.name, ips: powerTarget.ips.join(", ") })
                      : t("dash.powerNoTarget")}
              </p>
              {st.dnsUnhealthy && !busy && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-2.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  <span>{t("dash.unhealthy")}</span>
                  <button
                    onClick={() => st.checkConnection()}
                    className="rounded-full bg-rose-500/15 px-3 py-1 transition-colors hover:bg-rose-500/25"
                  >
                    {t("dash.retest")}
                  </button>
                  <button
                    onClick={() => st.disconnectDns()}
                    className="rounded-full bg-rose-500 px-3 py-1 text-white transition-colors hover:bg-rose-500/90"
                  >
                    {t("dash.turnOff")}
                  </button>
                </div>
              )}
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
                {st.sweeping ? t("dash.sweeping") : t("dash.sweep")}
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
                {live ? t("dash.liveStop") : t("dash.liveStart")}
              </button>
              {!dnsOn && st.bestService && (
                <button
                  onClick={() => st.connectDns()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-5 py-2.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-400"
                >
                  <Plug className="h-4 w-4" />
                  {t("dash.connectBest", { ms: st.bestService.ms })}
                </button>
              )}
            </div>

            {/* stats strip — divided, no boxes */}
            <div className="mt-6 flex items-stretch justify-center divide-x divide-x-reverse divide-border/60">
              <StatItem
                icon={<Timer className="h-3 w-3" />}
                label={t("dash.statBest")}
                value={best !== null ? <span className="ltr">{best} ms</span> : "—"}
                sub={
                  avgAll !== null ? (
                    <span className="ltr">{t("dash.statBestSub", { ms: avgAll })}</span>
                  ) : anyResultAtAll ? (
                    t("dash.statNoRoute")
                  ) : (
                    t("dash.statNoTest")
                  )
                }
              />
              <StatItem
                icon={<ArrowDown className="h-3 w-3" />}
                label={t("dash.statImprove")}
                value={improvement !== null ? <span className="ltr">%{improvement}</span> : "—"}
                sub={t("dash.statImproveSub")}
              />
              <StatItem
                icon={<ShieldCheck className="h-3 w-3" />}
                label={t("dash.statStability")}
                value={<span className={stability.cls}>{stability.label}</span>}
                sub={
                  Object.keys(st.sweepResults).length > 0
                    ? reachedServices.length > 0
                      ? t("dash.stabilitySubReach", { ok: reachedServices.length, n: st.services.length })
                      : t("dash.stabilitySub", { ok: okServices.length, n: st.services.length })
                    : "—"
                }
              />
            </div>
          </section>

          {/* sweep results — one list, hairline dividers, no nested boxes */}
          {st.services.length > 0 ? (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1 px-4 pb-2 pt-4">
                <h2 className="text-sm font-bold">{t("dash.resultsTitle")}</h2>
                <p className="text-[10px] text-muted-foreground">
                  {st.sweeping ? t("dash.resultsSubLive") : t("dash.resultsSub")}
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
                {t("dash.noServices")}{" "}
                <button
                  onClick={() => st.setView("servers")}
                  className="font-bold text-primary hover:underline"
                >
                  {t("dash.fromServers")}
                </button>{" "}
                {t("dash.addOneDns")}
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
                {t("dash.liveTitle")}
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
                {live ? t("dash.liveOn") : t("dash.liveOff")}
              </button>
            </div>

            {liveTarget ? (
              <>
                <p className="mb-2 truncate text-[10px] text-muted-foreground">
                  {t("dash.via")} <span className="ltr font-mono">{liveTarget.label}</span>
                  {domain && (
                    <>
                      {" "}
                      · {t("dash.targetDomain")} <span className="ltr font-mono">{domain}</span>
                    </>
                  )}
                </p>
                <div className="mb-3 flex items-stretch justify-between divide-x divide-x-reverse divide-border/50">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">{t("dash.curPing")}</p>
                    <p className={`ltr text-lg font-black ${latencyClass(liveStats.cur)}`}>
                      {liveStats.cur !== null ? liveStats.cur : "—"}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">{t("dash.avgJitter")}</p>
                    <p className="ltr text-lg font-black text-primary">
                      {liveStats.avg !== null ? liveStats.avg : "—"}
                      <span className="ms-1 text-[9px] font-bold text-muted-foreground">
                        ±{liveStats.jitter ?? "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-center">
                    <p className="text-[9px] text-muted-foreground">{t("dash.loss")}</p>
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
                <LiveChart
                  samples={samples}
                  aria={t("chart.aria")}
                  empty={t("chart.empty")}
                  samplesLabel={(n) => t("chart.samples", { n })}
                />
                <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                  {liveStats.kind === "tcp"
                    ? t("dash.kindTcp")
                    : liveStats.kind === "region"
                      ? t("dash.kindRegion")
                      : liveStats.kind === "server"
                        ? t("dash.kindServer")
                        : t("dash.kindDns")}
                  {game?.tcpPorts.length && liveStats.kind === "tcp" ? (
                    <span className="ltr">
                      {" "}({t("dash.portTag", { ports: game.tcpPorts.join("/") })})
                    </span>
                  ) : null}{" "}
                  — {liveStats.kind === "server"
                    ? t("dash.noteServer")
                    : liveStats.kind === "region"
                      ? t("dash.noteRegion")
                      : liveStats.kind === "dns"
                        ? t("dash.noteDns")
                        : t("dash.noteTcp")}{" "}
                  {pingQuality(liveStats.avg, st.lang).label !== "—"
                    ? `· ${t("dash.quality", { q: pingQuality(liveStats.avg, st.lang).label })}`
                    : t("dash.waitData")}
                </p>
                {liveStats.kind === "region" && (
                  <p className="mt-1 flex items-start justify-center gap-1 text-center text-[9px] leading-relaxed text-cyan-600 dark:text-cyan-400">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("dash.regionInfo")}
                  </p>
                )}
                {liveStats.total > 0 && liveStats.kind !== "tcp" && liveStats.kind !== "region" && liveStats.kind !== "server" && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-[9px] text-amber-600 dark:text-amber-400">
                    <Info className="h-3 w-3 shrink-0" />
                    {t("dash.noteDnsPort")}
                  </p>
                )}
                {liveStats.total > 0 && liveStats.kind === "mixed" && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-[9px] text-amber-600 dark:text-amber-400">
                    <Info className="h-3 w-3 shrink-0" />
                    {t("dash.noteMixed")}
                  </p>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t("dash.needTarget")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
