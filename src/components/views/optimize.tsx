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
import { DNS_GROUPS } from "@/lib/dns-catalog";
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

function DomainRow({ r }: { r: ApiResult["results"][number] }) {
  return (
    <div className="space-y-1 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {statusIcon(r.status, r.publiclyUnresolvable)}
        <span className="ltr break-all font-mono text-xs text-foreground/90">{r.domain}</span>
        {!r.critical && (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            وب‌سایت (غیرحیاتی)
          </span>
        )}
        {r.ipv6 && (
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
            IPv6
          </span>
        )}
        {r.publiclyUnresolvable ? (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
            خارج از قضاوت
          </span>
        ) : r.misleading ? (
          <span
            className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"
            title={
              r.privateAnswer
                ? "این دامنه به یک IP داخلیِ بی‌جواب اشاره می‌کند — resolve می‌شه ولی به سرور بازی نمی‌رسه"
                : "resolve شد ولی هیچ پورتی جواب نداد — به سرور بازی نمی‌رسه"
            }
          >
            {r.privateAnswer ? "IP داخلیِ بی‌جواب" : "به سرور نمی‌رسه"}
          </span>
        ) : r.differs === true ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            مسیر اختصاصی
          </span>
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
}: {
  ip: string;
  res?: ApiResult;
  isWinner: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!res) {
    return (
      <div className="flex items-center gap-3 rounded-[22px] bg-muted/40 p-3.5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="ltr font-mono text-sm">{ip}</span>
        <span className="text-xs text-muted-foreground">
          در حال کوئری دامنه‌ها و تست پورت‌ها (تا ~۳۰ ثانیه)
        </span>
      </div>
    );
  }
  const { tone, label } = verdictOf(res);
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
          <span title="سرورهای حیاتی (لاگین/بازی) که واقعاً قابل‌اتصال بودند">
            {s.reachable ?? s.resolved}/{s.total} سرور حیاتی
          </span>
          {s.avgLatency !== null && (
            <span className="ltr flex items-center gap-1 font-mono">
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

  const score = (res: ApiResult) => {
    const { tone } = verdictOf(res);
    // Reachable-good first; "misleading" (resolves but game server unreachable)
    // ranks WORST — even below a clean failure — so a fake "connected" DNS can
    // never be crowned best.
    const toneRank =
      tone === "ok" ? 0 : tone === "partial" ? 1 : tone === "unknown" ? 2 : tone === "dead" ? 3 : 4;
    return toneRank * 10000 + (res.summary.avgLatency ?? 9999);
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

  const winnerIp = useMemo(() => {
    const done = st.fullTest.order
      .map((o) => ({ ip: o.ip, res: st.fullTest.results[o.ip] }))
      .filter((e) => e.res);
    const ranked = done.sort((a, b) => score(a.res!) - score(b.res!));
    const top = ranked[0];
    return top && verdictOf(top.res!).tone === "ok" ? top.ip : null;
  }, [st.fullTest.order, st.fullTest.results]);

  const groupRank = (meta: ServiceMeta | null, ips: string[]) => {
    const best = ips
      .map((ip) => st.fullTest.results[ip])
      .filter((r): r is ApiResult => !!r)
      .map((r) => score(r));
    const base = meta?.custom ? 9000 : 0;
    return best.length ? Math.min(...best) + base : 99999;
  };

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
      <section className="flex flex-wrap items-center justify-between gap-3 panel p-4">
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
                {st.services.reduce((a, m) => a + m.ips.length, 0)} آی‌پی از {st.services.length}{" "}
                سرویس همزمان تست می‌شود
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
            disabled={st.fullTest.inProgress || !game || st.services.length === 0}
            className="flex min-h-[42px] items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-[0_0_30px_-8px] shadow-primary/50 transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            {st.fullTest.inProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال تست... {elapsed}s
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                تست همزمان {st.services.length} سرویس
              </>
            )}
          </button>
        </div>
      </section>

      {/* results — grouped by service: name on top, its DNS IPs below side by side */}
      {st.fullTest.order.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground">
            نتایج (مرتب‌شده از بهترین — هر سرویس با آی‌پی‌های خودش)
          </h2>
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
                      {meta?.name ?? "سرویس"}
                      {meta && !meta.custom && (
                        <span className="ltr ms-1.5 text-[10px] font-medium text-muted-foreground">
                          {meta.latin}
                        </span>
                      )}
                    </p>
                    {meta && !meta.custom && (
                      <span className="text-[10px] text-muted-foreground">
                        {DNS_GROUPS.find((g) => g.id === meta.group)?.label}
                      </span>
                    )}
                    {groupHasWinner && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                        <Trophy className="h-3 w-3" />
                        بهترین سرویس
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
              <CheckCircle2 className="h-3.5 w-3.5" /> DNS کار میکنه
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              سرورهای حیاتی بازی (لاگین و سرویس) نه‌فقط resolve شدند بلکه واقعاً قابل‌اتصال بودند؛
              ست‌کردنش روی کنسول/PC امنه.
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" /> به سرور بازی نمی‌رسه
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              دامنه resolve می‌شه ولی به یک IP داخلی/بی‌جواب می‌رسه — بازی «انگار وصله» ولی بالا
              نمی‌آید. این از resolve‌نشدن هم بدتره چون توهم اتصال می‌سازه.
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Route className="h-3.5 w-3.5" /> مسیر اختصاصی
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              این DNS آی‌پی متفاوت از DNSهای معمولی میده — در سرویس‌های گیمینگ نشانه‌ی روتینگ اختصاصیه
              (نه تضمین صددرصدی).
            </p>
          </div>
          <div className="bg-card/80 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" /> DNS جواب نمیده
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              هیچ پاسخی نرسید؛ آی‌پی اشتباه، پورت ۵۳ بسته، یا سرویس محدود به IP ایران.
            </p>
          </div>
          <div className="bg-card/80 p-3.5 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Info className="h-3.5 w-3.5 text-muted-foreground" /> نکته
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              قضاوت و رتبه‌بندی فقط بر پایه‌ی دامنه‌های حیاتی (لاگین/سرویس بازی) و قابل‌اتصال‌بودن واقعی
              (نه فقط resolve) محاسبه می‌شه؛ وب‌سایت تبلیغاتی بازی در رتبه اثری نداره. عدد پینگ هم «تأخیر
              رسیدن به سرور بازی روی TCP/443» است، نه پینگ داخل گیم (UDP). فقط مطمئن شو فایروال پورت ۵۳
              (UDP) را نبسته باشد.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
