"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Play,
  Trophy,
  Timer,
  Route,
  CheckCircle2,
  XCircle,
  Info,
  Swords,
  ChevronDown,
  FileDown,
  FileJson,
} from "lucide-react";
import { useStag, GAME_PRESETS, getPreset, type ApiResult, type ServiceMeta } from "@/components/stag-store";
import { GameGlyph } from "@/components/brand";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  latencyClass,
  statusIcon,
  TONE_BADGE,
  verdictOf,
  type Tone,
} from "@/components/ui-helpers";
import { toneHint } from "@/lib/verdict";
import { DNS_GROUPS, groupLabel as dnsGroupLabel } from "@/lib/dns-catalog";
import { APP_VERSION } from "@/lib/version";
import { FlagCircle } from "@/components/views/dashboard";

/* --------------------------- game grid --------------------------- */

function GameCard({
  id,
  name,
  latin,
  icon,
  hint,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  latin: string;
  icon: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      title={hint}
      className={`group relative flex flex-col items-center gap-2 rounded-[22px] p-3.5 transition-all ${
        selected
          ? "bg-primary/[0.09] ring-2 ring-primary/70 shadow-[0_8px_30px_-12px] shadow-primary/40"
          : "bg-card/50 hover:bg-muted/50 hover:ring-1 hover:ring-primary/30"
      }`}
    >
      {selected && (
        <span className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      )}

      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
          selected ? "bg-primary/15 text-primary" : "bg-muted/70 text-muted-foreground group-hover:text-primary/80"
        }`}
      >
        <GameGlyph icon={icon} className="h-7 w-7" />
      </span>
      <span className="w-full text-center">
        <span className="block truncate text-xs font-bold" dir="rtl">
          {name}
        </span>
        <span className="ltr mt-0.5 block truncate text-[9px] text-muted-foreground">{latin}</span>
      </span>
      <span className="sr-only">{id}</span>
    </button>
  );
}

/* ------------------------- result pieces ------------------------- */

function DomainRow({ r, t, lang }: { r: ApiResult["results"][number]; t: (k: string) => string; lang: "fa" | "en" }) {
  return (
    <div className="space-y-1 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {statusIcon(r.status, r.publiclyUnresolvable)}
        <span className="ltr break-all font-mono text-xs text-foreground/90">{r.domain}</span>
        {!r.critical && (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            {t("opt.webBadge")}
          </span>
        )}
        {r.ipv6 && (
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
            {t("opt.ipv6")}
          </span>
        )}
        {r.publiclyUnresolvable ? (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
            {t("opt.outOfScope")}
          </span>
        ) : r.misleading ? (
          <span
            className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"
            title={r.privateAnswer ? t("opt.fakeIpTip") : t("opt.noServerTip")}
          >
            {r.privateAnswer ? t("opt.fakeIp") : t("opt.noServer")}
          </span>
        ) : r.differs === true ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            {t("opt.specialRoute")}
          </span>
        ) : null}
        <span className={`ltr ms-auto font-mono text-[11px] ${latencyClass(r.latencyMs)}`} title={t("opt.domainMsTip")}>
          {r.latencyMs !== null ? `${r.latencyMs}ms` : ""}
        </span>
      </div>
      {r.ips.length > 0 && (
        <p className="ltr truncate ps-6 font-mono text-[10px] text-muted-foreground">
          {r.ips.slice(0, 3).join(" · ")}
        </p>
      )}
      {r.error && !r.publiclyUnresolvable && (
        <p className="ps-6 text-[10px] text-rose-500/90">{r.error}</p>
      )}
      {r.tcp.length > 0 && (
        <div className="flex flex-wrap gap-1.5 ps-6">
          {r.tcp.map((t) => (
            <span
              key={t.port}
              className={`ltr rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                t.ok
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              TCP {t.port} {t.ok ? `✓ ${t.latencyMs}ms` : "✗"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IpResultCard({
  ip,
  res,
  isWinner,
  expanded,
  onToggle,
  t,
  lang,
}: {
  ip: string;
  res?: ApiResult;
  isWinner: boolean;
  expanded: boolean;
  onToggle: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  lang: "fa" | "en";
}) {
  if (!res) {
    return (
      <div className="flex items-center gap-3 rounded-[22px] bg-muted/40 p-3.5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="ltr font-mono text-sm">{ip}</span>
        <span className="text-xs text-muted-foreground">{t("opt.pending")}</span>
      </div>
    );
  }
  const { tone, label } = verdictOf(res, lang);
  const s = res.summary;
  return (
    <div
      className={`overflow-hidden rounded-[22px] transition-colors ${
        isWinner ? "bg-primary/[0.07] ring-1 ring-primary/50" : "bg-card/50"
      }`}
    >
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 p-3.5 text-start">
        {isWinner && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
        <span className="ltr font-mono text-sm font-bold">{ip}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_BADGE[tone as Tone]}`}>
          {label}
        </span>
        <span className="ms-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span title={t("opt.criticalServersTip")}>
            {s.reachable ?? s.resolved}/{s.total} {t("opt.criticalServers")}
          </span>
          {s.avgLatency !== null && (
            <span className="ltr flex items-center gap-1 font-mono" title={t("opt.avgLatencyTip")}>
              <Timer className="h-3 w-3" />
              {s.avgLatency}ms
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>
      {expanded && (
        <div className="bg-background/40">
          <div className="mx-3.5 hairline" />
          <p className="px-3.5 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {toneHint(tone as Tone, lang)}
          </p>
          {res.results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t("opt.noResult")}</p>
          ) : (
            res.results.map((r) => <DomainRow key={r.domain} r={r} t={t} lang={lang} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ export ------------------------------ */
/**
 * فاز ۸ — export the full-test results as CSV / JSON (client-side, no server
 * round-trip). CSV is Excel-friendly (BOM + comma), JSON keeps the raw shape.
 */
function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvEscape(v: string | number | boolean | null): string {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ------------------------------ view ------------------------------ */

export function Optimize() {
  const st = useStag();
  const t = st.t;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!st.fullTest.inProgress) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [st.fullTest.inProgress]);

  const game = getPreset(st.gameId);

  /*
   * beta.4 scoring — «اطلاعات درست»: rank by WHAT ACTUALLY MATTERS for
   * playing, in this order:
   *  1. fewest unreachable critical servers (unreachable = total - reachable)
   *  2. fake/private paths are a hard penalty (worse than plain filtering)
   *  3. fewest resolve-but-dead domains (misleading signals)
   *  4. fastest average DNS query
   * The old tone-rank put a 1/2-reachable (but working!) DNS below a dead one
   * — exactly the "آمار غلط" the user reported while gaming at 130ms.
   */
  const score = (res: ApiResult) => {
    const s = res.summary;
    const reachable = typeof s.reachable === "number" ? s.reachable : s.resolved;
    const unreachable = Math.max(0, s.total - reachable);
    const fake = s.private ?? 0;
    return (
      unreachable * 100000 + fake * 50000 + (s.misleading ?? 0) * 2000 + (s.avgLatency ?? 9999)
    );
  };

  /* group the full-test order by service (name header + paired IPs below) */
  const groups: Array<{ meta: ServiceMeta | null; ips: string[] }> = (() => {
    const bySid = new Map<string, string[]>();
    for (const { ip, sid } of st.fullTest.order) {
      const list = bySid.get(sid) ?? [];
      list.push(ip);
      bySid.set(sid, list);
    }
    return Array.from(bySid.entries()).map(([sid, ips]) => ({
      meta: st.metaFor(sid),
      ips,
    }));
  })();

  /*
   * beta.4 — the trophy goes to the best-scoring service that has at least ONE
   * reachable critical server, even when nothing is 100% green (the normal
   * case inside Iran). It no longer requires tone==="ok" — hiding the winner
   * whenever one publisher hop was filtered was part of the wrong-info bug.
   */
  const winnerIp = useMemo(() => {
    const done = st.fullTest.order
      .map((o) => ({ ip: o.ip, res: st.fullTest.results[o.ip] }))
      .filter((e) => e.res);
    const ranked = done.sort((a, b) => score(a.res!) - score(b.res!));
    const top = ranked[0];
    if (!top) return null;
    const s = top.res!.summary;
    return (typeof s.reachable === "number" ? s.reachable : s.resolved) > 0 ? top.ip : null;
  }, [st.fullTest.order, st.fullTest.results]);

  const groupRank = (meta: ServiceMeta | null, ips: string[]) => {
    const best = ips
      .map((ip) => st.fullTest.results[ip])
      .filter((r): r is ApiResult => !!r)
      .map((r) => score(r));
    const base = meta?.custom ? 9000 : 0;
    return best.length ? Math.min(...best) + base : 99999;
  };

  const hasResults = st.fullTest.order.some((o) => st.fullTest.results[o.ip]);

  const exportRows = () => {
    const metaOf = (sid: string) => st.metaFor(sid);
    return st.fullTest.order
      .map(({ ip, sid }) => ({ ip, sid, res: st.fullTest.results[ip], meta: metaOf(sid) }))
      .filter((e) => e.res);
  };

  const exportCsv = () => {
    const g = getPreset(st.fullTest.gameId);
    const gameName = (st.lang === "en" ? g?.latin : g?.name) ?? g?.latin ?? "";
    const head = ["service", "dns_ip", "verdict", "critical_total", "resolved", "reachable", "misleading", "avg_dns_ms", "domain", "domain_critical", "domain_status", "domain_ms", "ips", "tcp"];
    const lines = [head.join(",")];
    for (const e of exportRows()) {
      const { label } = verdictOf(e.res!, st.lang);
      const s = e.res!.summary;
      if (e.res!.results.length === 0) {
        lines.push([csvEscape(e.meta?.name ?? e.sid), e.ip, csvEscape(label), s.total, s.resolved, s.reachable ?? "", s.misleading ?? "", s.avgLatency ?? "", "", "", "", "", "", ""].join(","));
      }
      for (const r of e.res!.results) {
        lines.push(
          [
            csvEscape(e.meta?.name ?? e.sid),
            e.ip,
            csvEscape(label),
            s.total,
            s.resolved,
            s.reachable ?? "",
            s.misleading ?? "",
            s.avgLatency ?? "",
            r.domain,
            r.critical,
            r.status,
            r.latencyMs ?? "",
            csvEscape(r.ips.join(" | ")),
            csvEscape(r.tcp.map((t) => `${t.port}:${t.ok ? "ok" : "fail"}`).join(" | ")),
          ].join(","),
        );
      }
    }
    // BOM so Excel opens UTF-8 correctly
    downloadFile(
      `stag-${gameName || "test"}-results.csv`,
      "\uFEFF" + lines.join("\n"),
      "text/csv;charset=utf-8",
    );
  };

  const exportJson = () => {
    const game = getPreset(st.fullTest.gameId);
    const payload = {
      app: "STAG",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      game: game ? { id: game.id, name: st.lang === "en" ? game.latin : game.name, domains: game.domains, tcpPorts: game.tcpPorts } : null,
      results: exportRows().map((e) => ({
        service: e.meta?.name ?? e.sid,
        dnsIp: e.ip,
        verdict: verdictOf(e.res!, st.lang).label,
        summary: e.res!.summary,
        domains: e.res!.results,
      })),
    };
    downloadFile(
      `stag-${game?.name || "test"}-results.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      {/* header */}
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Swords className="h-5 w-5 text-primary" />
          {t("opt.title")}
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("opt.subtitle")}
        </p>
      </div>

      {/* game grid */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">
          {t("opt.gridTitle", { n: GAME_PRESETS.length })}
        </h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
          {GAME_PRESETS.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              name={st.lang === "en" ? g.latin : g.name}
              latin={st.lang === "en" ? g.name : g.latin}
              icon={g.icon}
              hint={st.lang === "en" ? g.hintEn : g.hint}
              selected={st.gameId === g.id}
              onSelect={() => st.setGameId(g.id)}
            />
          ))}
        </div>
      </section>

      {/* run strip */}
      <section className="flex flex-wrap items-center justify-between gap-3 panel p-4">
        <div className="min-w-0">
          {game ? (
            <>
              <p className="text-sm font-bold">
                {t("opt.current")} <span className="text-primary">{st.lang === "en" ? game.latin : game.name}</span>
                <span className="ltr ms-2 text-[10px] font-medium text-muted-foreground">
                  {st.lang === "en" ? game.name : game.latin}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("opt.runInfo", {
                  n: game.domains.length,
                  ports: game.tcpPorts.join(", "),
                  ips: st.services.reduce((a, m) => a + m.ips.length, 0),
                  svcs: st.services.length,
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("opt.pickFirst")}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <Switch id="tcp-opt" checked={st.tcpEnabled} onCheckedChange={st.setTcpEnabled} />
            <Label htmlFor="tcp-opt" className="cursor-pointer text-xs">
              {t("opt.tcpSwitch")}
            </Label>
          </span>
          <button
            onClick={st.runFullTest}
            disabled={st.fullTest.inProgress || !game || st.services.length === 0}
            className="flex min-h-[42px] items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-[0_0_30px_-8px] shadow-primary/50 transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            {st.fullTest.inProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("opt.running", { s: elapsed })}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {t("opt.run", { n: st.services.length })}
              </>
            )}
          </button>
        </div>
      </section>

      {/* results — grouped by service: name on top, its DNS IPs below side by side */}
      {st.fullTest.order.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-muted-foreground">{t("opt.resultsTitle")}</h2>
            {hasResults && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                  title="Excel CSV"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {t("opt.exportCsv")}
                </button>
                <button
                  onClick={exportJson}
                  className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3.5 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                  title="JSON"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  {t("opt.exportJson")}
                </button>
              </div>
            )}
          </div>
          {[...groups]
            .sort((a, b) => groupRank(a.meta, a.ips) - groupRank(b.meta, b.ips))
            .map(({ meta, ips }) => {
              const groupHasWinner = ips.some((ip) => ip === winnerIp && !st.fullTest.inProgress);
              return (
                <div key={meta?.id ?? ips[0]} className="space-y-2">
                  {/* service header — which service these DNS belong to */}
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    <FlagCircle cc={meta?.cc ?? "ir"} size="h-6 w-6" />
                    <p className="text-sm font-bold" dir="rtl">
                      {meta ? (st.lang === "en" && !meta.custom ? meta.latin : meta.name) : t("opt.svc")}
                      {meta && !meta.custom && (
                        <span className="ltr ms-1.5 text-[10px] font-medium text-muted-foreground">
                          {st.lang === "en" ? meta.name : meta.latin}
                        </span>
                      )}
                    </p>
                    {meta && !meta.custom && (
                      <span className="text-[10px] text-muted-foreground">
                        {dnsGroupLabel(meta.group ?? "global", st.lang)}
                      </span>
                    )}
                    {groupHasWinner && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                        <Trophy className="h-3 w-3" />
                        {t("opt.bestService")}
                      </span>
                    )}
                  </div>
                  {/* the DNS addresses of this service, side by side */}
                  <div className={`grid gap-2.5 ${ips.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                    {ips.map((ip) => (
                      <IpResultCard
                        key={ip}
                        ip={ip}
                        res={st.fullTest.results[ip]}
                        isWinner={winnerIp === ip && !st.fullTest.inProgress}
                        expanded={!!expanded[ip]}
                        onToggle={() => setExpanded((e) => ({ ...e, [ip]: !e[ip] }))}
                        t={t}
                        lang={st.lang}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </section>
      )}

      {/* interpretation help */}
      <section className="panel overflow-hidden pb-4">
        <div className="grid gap-px bg-border/40 sm:grid-cols-2">
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("opt.legendOk")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("opt.legendOkBody")}
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("opt.legendPartial")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("opt.legendPartialBody")}
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Route className="h-3.5 w-3.5" /> {t("opt.legendBlocked")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("opt.legendBlockedBody")}
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" /> {t("opt.legendBad")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("opt.legendBadBody")}
            </p>
          </div>
          <div className="bg-card/80 p-3.5 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Info className="h-3.5 w-3.5 text-muted-foreground" /> {t("opt.legendNote")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("opt.legendNoteBody")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
