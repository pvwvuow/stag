"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Play,
  Trophy,
  Timer,
  Route,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Swords,
} from "lucide-react";
import { useStag, GAME_PRESETS, getPreset, type ApiResult } from "@/components/stag-store";
import { GameGlyph } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  latencyClass,
  statusIcon,
  TONE_BADGE,
  verdictOf,
  type Tone,
} from "@/components/ui-helpers";

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
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-3.5 transition-all ${
        selected
          ? "border-primary bg-primary/[0.08] shadow-[0_8px_30px_-12px] shadow-primary/40"
          : "border-border bg-card/70 hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      {selected && (
        <span className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      )}
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
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

function DomainRow({ r }: { r: ApiResult["results"][number] }) {
  return (
    <div className="space-y-1 border-b border-border/40 px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        {statusIcon(r.status, r.publiclyUnresolvable)}
        <span className="ltr break-all font-mono text-xs text-foreground/90">{r.domain}</span>
        {r.publiclyUnresolvable ? (
          <Badge className="border border-zinc-500/40 bg-zinc-500/15 text-[10px] text-zinc-600 dark:text-zinc-400">
            خارج از قضاوت
          </Badge>
        ) : r.differs === true ? (
          <Badge className="border border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
            <Route className="h-3 w-3" />
            مسیر اختصاصی
          </Badge>
        ) : null}
        <span className={`ltr ms-auto font-mono text-[11px] ${latencyClass(r.latencyMs)}`}>
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
              className={`ltr rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                t.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
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

function ServerResultCard({
  ip,
  res,
  isWinner,
  expanded,
  onToggle,
}: {
  ip: string;
  res: ApiResult;
  isWinner: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { tone, label } = verdictOf(res);
  const s = res.summary;
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card/70 ${
        isWinner ? "border-primary/60 shadow-[0_8px_30px_-14px] shadow-primary/50" : "border-border"
      }`}
    >
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 p-3.5 text-start">
        {isWinner && <Trophy className="h-4 w-4 shrink-0 text-primary" />}
        <span className="ltr font-mono text-sm font-bold">{ip}</span>
        <Badge className={`border font-bold ${TONE_BADGE[tone as Tone]}`}>{label}</Badge>
        <span className="ms-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            {s.resolved}/{s.total} دامنه
          </span>
          {s.avgLatency !== null && (
            <span className="ltr flex items-center gap-1 font-mono">
              <Timer className="h-3 w-3" />
              {s.avgLatency}ms
            </span>
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/50 bg-background/40">
          {res.results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">نتیجه‌ای ثبت نشد — احتمالاً DNS هیچ پاسخی نداد.</p>
          ) : (
            res.results.map((r) => <DomainRow key={r.domain} r={r} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ view ------------------------------ */

export function Optimize() {
  const st = useStag();
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

  const ranked = useMemo(() => {
    const entries = st.fullTest.order
      .map((ip) => ({ ip, res: st.fullTest.results[ip] }))
      .filter((e) => e.res);
    const score = (res: ApiResult) => {
      const { tone } = verdictOf(res);
      const toneRank = tone === "ok" ? 0 : tone === "partial" ? 1 : tone === "unknown" ? 2 : 3;
      return toneRank * 10000 + (res.summary.avgLatency ?? 9999);
    };
    return entries.sort((a, b) => score(a.res) - score(b.res));
  }, [st.fullTest.order, st.fullTest.results]);

  const winnerIp = ranked[0] && verdictOf(ranked[0].res).tone === "ok" ? ranked[0].ip : null;

  // Display: finished servers sorted best-first, then still-pending ones in activation order.
  const displayOrder = useMemo(() => {
    const done = ranked.map((e) => e.ip);
    const pending = st.fullTest.order.filter((ip) => !st.fullTest.results[ip]);
    return [...done, ...pending];
  }, [ranked, st.fullTest.order, st.fullTest.results]);

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      {/* header */}
      <div>
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Swords className="h-5 w-5 text-primary" />
          بهینه‌سازی پینگ
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          بازی را انتخاب کن؛ STAG دامنه‌های همان بازی را از طریق همه سرورهای فعال همزمان کوئری
          می‌گیرد و بهترین DNS را مشخص می‌کند — بدون اینکه بازی باز شود.
        </p>
      </div>

      {/* game grid */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">
          بازی / پلتفرم ({GAME_PRESETS.length} مورد)
        </h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
          {GAME_PRESETS.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              name={g.name}
              latin={g.latin}
              icon={g.icon}
              hint={g.hint}
              selected={st.gameId === g.id}
              onSelect={() => st.setGameId(g.id)}
            />
          ))}
        </div>
      </section>

      {/* run strip */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-4">
        <div className="min-w-0">
          {game ? (
            <>
              <p className="text-sm font-bold">
                انتخاب فعلی: <span className="text-primary">{game.name}</span>
                <span className="ltr ms-2 text-[10px] font-medium text-muted-foreground">
                  {game.latin}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {game.domains.length} دامنه + پورت‌های{" "}
                <span className="ltr font-mono">{game.tcpPorts.join(", ")}</span> — روی{" "}
                {st.activeServers.length} سرور فعال همزمان تست میشه
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">اول یک بازی از بالا انتخاب کن</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <Switch id="tcp-opt" checked={st.tcpEnabled} onCheckedChange={st.setTcpEnabled} />
            <Label htmlFor="tcp-opt" className="cursor-pointer text-xs">
              تست پورت‌های TCP
            </Label>
          </span>
          <button
            onClick={st.runFullTest}
            disabled={st.fullTest.inProgress || !game}
            className="flex min-h-[42px] items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-[0_0_30px_-8px] shadow-primary/50 transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            {st.fullTest.inProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال تست... {elapsed}s
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                تست همزمان {st.activeServers.length} سرور
              </>
            )}
          </button>
        </div>
      </section>

      {/* results */}
      {st.fullTest.order.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold text-muted-foreground">نتایج (مرتب‌شده از بهترین)</h2>
          {displayOrder.map((ip) => {
            const res = st.fullTest.results[ip];
            if (!res) {
              return (
                <div
                  key={ip}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3.5"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="ltr font-mono text-sm">{ip}</span>
                  <span className="text-xs text-muted-foreground">
                    در حال کوئری دامنه‌ها و تست پورت‌ها (تا ~۳۰ ثانیه)
                  </span>
                </div>
              );
            }
            return (
              <ServerResultCard
                key={ip}
                ip={ip}
                res={res}
                isWinner={winnerIp === ip && !st.fullTest.inProgress}
                expanded={!!expanded[ip]}
                onToggle={() => setExpanded((e) => ({ ...e, [ip]: !e[ip] }))}
              />
            );
          })}
        </section>
      )}

      {/* interpretation help */}
      <section className="grid gap-2.5 pb-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> DNS کار میکنه
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            همه دامنه‌های بازی پاسخ سالم دادند؛ ست‌کردنش روی کنسول/PC امنه.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Route className="h-3.5 w-3.5" /> مسیر اختصاصی
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            این DNS آی‌پی متفاوت از DNSهای معمولی میده — در سرویس‌های گیمینگ نشانه‌ی روتینگ اختصاصیه
            (نه تضمین صددرصدی).
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
            <XCircle className="h-3.5 w-3.5" /> DNS جواب نمیده
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            هیچ پاسخی نرسید؛ آی‌پی اشتباه، پورت ۵۳ بسته، یا سرویس محدود به IP ایران.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <Info className="h-3.5 w-3.5 text-muted-foreground" /> نکته
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            تست از سیستم خودت اجرا میشه؛ پس DNSهای داخلی ایران هم واقعاً سنجیده میشن — فقط
            مطمئن شو فایروال پورت ۵۳ (UDP) را نبسته باشد.
          </p>
        </div>
      </section>
    </div>
  );
}
