"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_PRESETS, getPreset } from "@/lib/games";
import { DNS_SUGGESTIONS } from "@/lib/dns-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  Play,
  Server,
  Timer,
  Route,
  RotateCcw,
  Gamepad2,
  Tv,
  Crosshair,
  Rocket,
  Trophy,
  Swords,
  Store,
  Smartphone,
  Blocks,
  Car,
  Info,
  Shield,
  Check,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ---------------- types ---------------- */

interface TcpResult {
  port: number;
  ok: boolean;
  latencyMs: number | null;
}

interface DomainResult {
  domain: string;
  status: string;
  latencyMs: number | null;
  ips: string[];
  error: string | null;
  baselineIps: string[];
  differs: boolean | null;
  publiclyUnresolvable: boolean;
  tcp: TcpResult[];
}

interface ApiResult {
  dns: string;
  baseline: string;
  results: DomainResult[];
  summary: {
    total: number;
    resolved: number;
    skipped: number;
    avgLatency: number | null;
    routingActive: boolean;
  };
}

const PRESET_ICONS: Record<string, LucideIcon> = {
  "marvel-rivals": Shield,
  psn: Tv,
  xbox: Gamepad2,
  cod: Crosshair,
  fortnite: Rocket,
  ea: Trophy,
  riot: Swords,
  steam: Store,
  nintendo: Smartphone,
  roblox: Blocks,
  rockstar: Car,
};

const STORAGE_KEY = "stag.servers.v1";
const MAX_DNS = 8;

/* ---------------- helpers ---------------- */

function isValidIp(s: string): boolean {
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((x) => Number(x) <= 255);
  return s.includes(":") && /^[0-9a-fA-F:]{2,45}$/.test(s);
}

/** Iran-internal / private-range IPs can never be tested from an external server. */
function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  return v6.startsWith("fc") || v6.startsWith("fd") || v6 === "::1";
}

function parseCustomDomains(text: string): string[] {
  return text
    .split(/[\s,،\n]+/)
    .map((d) =>
      d
        .trim()
        .toLowerCase()
        .replace(/^[a-z]+:\/\//, "")
        .split("/")[0],
    )
    .filter((d) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d));
}

function latencyClass(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 120) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 350) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

type Tone = "ok" | "partial" | "dead" | "unknown";

const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  dead: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40",
  unknown: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/40",
};

function statusIcon(status: string, neutral = false) {
  if (neutral) return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (status === "nxdomain" || status === "nodata")
    return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  return <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />;
}

/* ---------------- component ---------------- */

export function DnsChecker() {
  const { toast } = useToast();

  const [dnsInput, setDnsInput] = useState("");
  const [dnsServers, setDnsServers] = useState<string[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>("psn");
  const [customDomains, setCustomDomains] = useState("");
  const [tcpCheck, setTcpCheck] = useState(true);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ApiResult>>({});
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [lastRunDomains, setLastRunDomains] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  /* localStorage load/save */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setDnsServers(arr.filter((x) => typeof x === "string" && isValidIp(x)));
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dnsServers));
    } catch {
      /* noop */
    }
  }, [dnsServers]);

  /* elapsed ticker */
  useEffect(() => {
    if (running) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const addManyDns = useCallback(
    (ips: string[]) => {
      setDnsServers((prev) => {
        const next = [...prev];
        for (const ip of ips) {
          if (next.includes(ip)) continue;
          if (next.length >= MAX_DNS) {
            toast({
              title: `حداکثر ${MAX_DNS} DNS میتونی داشته باشی`,
              description: "اول چندتا رو حذف کن بعد اضافه کن.",
              variant: "destructive",
            });
            break;
          }
          next.push(ip);
        }
        return next;
      });
    },
    [toast],
  );

  const addDns = useCallback(() => {
    const ip = dnsInput.trim();
    if (!ip) return;
    if (!isValidIp(ip)) {
      toast({ title: "آی‌پی نامعتبره", description: "یه آی‌پی درست مثل ۱۷۸.۲۲.۱۲۲.۱۰۰ وارد کن.", variant: "destructive" });
      return;
    }
    addManyDns([ip]);
    setDnsInput("");
  }, [dnsInput, addManyDns, toast]);

  const removeDns = useCallback((ip: string) => {
    setDnsServers((prev) => prev.filter((x) => x !== ip));
  }, []);

  const runTests = useCallback(async () => {
    if (dnsServers.length === 0) {
      toast({ title: "DNS وارد نکردی", description: "حداقل یه آی‌پی DNS اضافه کن.", variant: "destructive" });
      return;
    }
    const preset = getPreset(selectedGame);
    const custom = parseCustomDomains(customDomains);
    const domains = Array.from(new Set([...(preset?.domains ?? []), ...custom])).slice(0, 8);
    if (domains.length === 0) {
      toast({ title: "بازی یا دامنه انتخاب نکردی", description: "یه بازی از لیست انتخاب کن یا دامنه دلخواه وارد کن.", variant: "destructive" });
      return;
    }

    const tcpPorts = tcpCheck ? (preset?.tcpPorts ?? [443]) : [];

    setRunning(true);
    setResults({});
    setRequestErrors({});
    setPending(dnsServers.slice());
    setLastRunDomains(domains);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    await Promise.allSettled(
      dnsServers.map(async (ip) => {
        try {
          const res = await fetch("/api/dns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dns: ip, domains, tcpPorts }),
          });
          const data = await res.json();
          if (!res.ok) {
            setRequestErrors((e) => ({ ...e, [ip]: data?.error ?? `خطای سرور (${res.status})` }));
          } else {
            setResults((r) => ({ ...r, [ip]: data as ApiResult }));
          }
        } catch {
          setRequestErrors((e) => ({ ...e, [ip]: "ارتباط با سرور تست برقرار نشد" }));
        } finally {
          setPending((p) => p.filter((x) => x !== ip));
        }
      }),
    );

    setRunning(false);
  }, [dnsServers, selectedGame, customDomains, tcpCheck, toast]);

  const hasAnything = Object.keys(results).length > 0 || Object.keys(requestErrors).length > 0 || pending.length > 0;

  return (
    <div className="space-y-8">
      {/* ---------- Step 1: DNS servers ---------- */}
      <Card className="border-border bg-card/70 backdrop-blur">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-bold border border-primary/30">
              ۱
            </span>
            <div>
              <h2 className="font-bold text-base sm:text-lg">DNS سرورهات رو وارد کن</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                همون آی‌پی‌هایی که روی کنسول / PC / روتر ست کردی
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={dnsInput}
              onChange={(e) => setDnsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDns();
                }
              }}
              placeholder="178.22.122.100"
              dir="ltr"
              className="font-mono text-left bg-muted/40 border-input focus-visible:ring-ring/50"
              inputMode="url"
              aria-label="آی‌پی سرور DNS"
            />
            <Button onClick={addDns} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0" aria-label="افزودن DNS">
              <Plus className="h-4 w-4" />
              افزودن
            </Button>
          </div>

          {dnsServers.length > 0 && (
            <div className="flex flex-wrap gap-2" role="list" aria-label="لیست DNSها">
              <AnimatePresence initial={false}>
                {dnsServers.map((ip) => (
                  <motion.span
                    key={ip}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 py-1.5 pe-2 ps-3 text-sm"
                    role="listitem"
                  >
                    <Server className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono ltr">{ip}</span>
                    {isPrivateIp(ip) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400/90" title="آی‌پی داخلی ایران — فقط از داخل ایران قابل تست">
                        داخلی
                      </span>
                    )}
                    <button
                      onClick={() => removeDns(ip)}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      aria-label={`حذف ${ip}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* ---------- Quick suggestions ---------- */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold">پیشنهادهای آماده (ایران و خارج)</p>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">— با یه کلیک اضافه میشن</span>
            </div>

            {DNS_SUGGESTIONS.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xs font-bold text-primary">{group.label}</p>
                  <p className="text-[11px] text-muted-foreground">{group.hint}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.suggestions.map((s) => {
                    const added = s.ips.every((ip) => dnsServers.includes(ip));
                    return (
                      <button
                        key={s.latin}
                        type="button"
                        onClick={() => addManyDns(s.ips)}
                        title={`${s.latin} — ${s.ips.join(" ، ")}${s.note ? `\n${s.note}` : ""}`}
                        className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                          added
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-background/60 text-foreground/80 hover:border-primary/40 hover:text-primary"
                        }`}
                        aria-pressed={added}
                      >
                        {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {s.name}
                        <span className="font-mono ltr text-[10px] opacity-70">{s.ips[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              نکته: آی‌پی‌های داخلی ایران (مثل رادار گیم، وانیلا و ۴۰۳) فقط از داخل شبکه‌های ایران
              پاسخ میدن؛ پس تست از سرور براشون «جواب نمیده» نشون میده و طبیعیه. آی‌پی‌ها از منابع
              عمومی ۲۰۲۵–۲۰۲۶ جمع شدن و ممکنه سرویس‌ها گاهی آی‌پی عوض کنن.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Step 2: game preset ---------- */}
      <Card className="border-border bg-card/70 backdrop-blur">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-bold border border-primary/30">
              ۲
            </span>
            <div>
              <h2 className="font-bold text-base sm:text-lg">بازیت رو انتخاب کن</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                دامنه‌های کلیدی همون بازی از طریق DNSهات تست میشه
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="انتخاب بازی">
            {GAME_PRESETS.map((g) => {
              const Icon = PRESET_ICONS[g.id] ?? Gamepad2;
              const active = selectedGame === g.id;
              return (
                <button
                  key={g.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedGame(active ? null : g.id)}
                  className={`group flex min-h-[44px] flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    active
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_-5px] shadow-primary/30"
                      : "border-border bg-background/40 hover:border-foreground/25 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className={`text-xs font-medium leading-tight ${active ? "text-primary" : "text-foreground/80"}`}>
                    {g.name}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedGame && getPreset(selectedGame) && (
            <p className="text-xs text-muted-foreground">
              <span className="text-primary">{getPreset(selectedGame)!.name}:</span>{" "}
              {getPreset(selectedGame)!.hint} — دامنه‌ها:{" "}
              <span className="font-mono ltr">{getPreset(selectedGame)!.domains.join(" · ")}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="custom-domains" className="text-sm text-foreground/90">
              دامنه دلخواه (اختیاری — با کاما یا خط جدید جدا کن)
            </Label>
            <textarea
              id="custom-domains"
              value={customDomains}
              onChange={(e) => setCustomDomains(e.target.value)}
              rows={2}
              dir="ltr"
              placeholder="example.com, cdn.mygame.net"
              className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-sm text-left placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------- Step 3: run ---------- */}
      <Card className="border-border bg-card/70 backdrop-blur">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-bold border border-primary/30">
              ۳
            </span>
            <h2 className="font-bold text-base sm:text-lg">اجرای تست</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="tcp-check"
                checked={tcpCheck}
                onCheckedChange={setTcpCheck}
                aria-label="تست پورت TCP"
              />
              <div>
                <Label htmlFor="tcp-check" className="text-sm cursor-pointer">
                  تست پورت‌های بازی (TCP)
                </Label>
                <p className="text-xs text-muted-foreground">اتصال به IPهایی که DNS میده، روی پورت‌های خود بازی</p>
              </div>
            </div>

            <Button
              onClick={runTests}
              disabled={running}
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-h-[44px] shadow-[0_0_30px_-8px] shadow-primary/50"
            >
              {running ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  در حال تست... {elapsed}s
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  شروع تست
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Results ---------- */}
      <div ref={resultsRef} className="scroll-mt-6 space-y-4">
        <AnimatePresence>
          {hasAnything && (
            <motion.div
              key="results-header"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <h2 className="font-bold text-lg">نتایج تست</h2>
              {!running && (
                <Button variant="outline" size="sm" onClick={runTests} className="border-input hover:bg-muted/50">
                  <RotateCcw className="h-4 w-4" />
                  تست مجدد
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* pending cards */}
          {pending.map((ip) => (
            <Card key={ip} className="border-border bg-card/70">
              <CardContent className="p-4 sm:p-6 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium text-sm">
                    در حال تست <span className="font-mono ltr">{ip}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">کوئری DNS + تست پورت‌ها (تا ~۳۰ ثانیه)</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* request-level errors */}
          <AnimatePresence>
            {Object.entries(requestErrors).map(([ip, msg]) => (
              <motion.div key={`err-${ip}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-rose-500/30 bg-rose-500/5">
                  <CardContent className="p-4 sm:p-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      <span className="font-mono ltr text-sm font-bold">{ip}</span>
                      <Badge className={TONE_BADGE.dead}>خطا</Badge>
                    </div>
                    <p className="text-sm text-rose-600 dark:text-rose-300/90">{msg}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* successful results */}
          <AnimatePresence>
            {Object.values(results).map((res) => {
              const s = res.summary;
              const tone: Tone =
                s.total === 0 ? "unknown" : s.resolved === 0 ? "dead" : s.resolved === s.total ? "ok" : "partial";
              const verdictLabel =
                tone === "ok"
                  ? "DNS کار میکنه"
                  : tone === "dead"
                    ? "DNS جواب نمیده"
                    : tone === "partial"
                      ? "ناقص جواب میده"
                      : "قضاوت ممکن نبود";
              return (
                <motion.div key={res.dns} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border bg-card/70 overflow-hidden">
                    <CardContent className="p-0">
                      {/* verdict header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 p-4">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-primary" />
                          <span className="font-mono ltr font-bold">{res.dns}</span>
                          <Badge className={`border ${TONE_BADGE[tone]} font-bold`}>{verdictLabel}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {s.resolved}/{s.total} دامنه پاسخ داد
                          </span>
                          {s.avgLatency !== null && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5" />
                              <span className={`font-mono ltr ${latencyClass(s.avgLatency)}`}>{s.avgLatency}ms</span>
                            </span>
                          )}
                          {s.routingActive && (
                            <Badge
                              className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                              title="این DNS آی‌پی متفاوتی نسبت به DNSهای معمولی (گوگل و کلادفلر) برمی‌گردونه — در سرویس‌های گیمینگ نشانه روتینگ اختصاصیه (بعضی CDNها هم بسته به موقعیت رزولور جوابشون رو عوض میکنن)"
                            >
                              <Route className="h-3 w-3" />
                              مسیر اختصاصی
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* domain rows */}
                      <div>
                        {res.results.map((r) => (
                          <div key={r.domain} className="border-b border-border/50 px-4 py-3 last:border-b-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {statusIcon(r.status, r.publiclyUnresolvable)}
                              <span className="font-mono text-sm ltr text-foreground/90 break-all">{r.domain}</span>
                              {r.publiclyUnresolvable ? (
                                <Badge
                                  className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/40 text-[10px] px-1.5"
                                  title="هیچ DNS مرجعی هم این دامنه رو نمیشناسه؛ از قضاوت کنار گذاشته شد"
                                >
                                  دامنه عمومی نیست
                                </Badge>
                              ) : (
                                <>
                                  {r.latencyMs !== null && (
                                    <span className={`text-xs font-mono ltr ${latencyClass(r.latencyMs)}`}>
                                      {r.latencyMs}ms
                                    </span>
                                  )}
                                  {r.differs === true && (
                                    <Badge
                                      className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] px-1.5"
                                      title="IP این DNS با IP DNSهای معمولی فرق داره"
                                    >
                                      مسیر متفاوت
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>

                            {r.publiclyUnresolvable ? (
                              <p className="ps-6 text-xs text-muted-foreground">
                                نه این DNS و نه DNSهای مرجع (گوگل/کلادفلر) این دامنه رو رزولور نکردن — از محاسبه نتیجه خارج شد.
                              </p>
                            ) : r.status === "ok" ? (
                              <div className="ps-6 space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  IP:{" "}
                                  <span className="font-mono ltr text-foreground/80">
                                    {r.ips.slice(0, 3).join(", ")}
                                    {r.ips.length > 3 ? ` +${r.ips.length - 3}` : ""}
                                  </span>
                                  {r.differs === false && (
                                    <span className="text-muted-foreground/70"> (مثل DNS معمولی)</span>
                                  )}
                                </p>
                                {tcpCheck && r.tcp.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {r.tcp.map((t) => (
                                      <span
                                        key={t.port}
                                        title={`اتصال TCP به پورت ${t.port}`}
                                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono ltr ${
                                          t.ok
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "border-border bg-muted/40 text-muted-foreground"
                                        }`}
                                      >
                                        :{t.port}
                                        {t.ok ? " ✓" : " ✗"}
                                        {t.ok && t.latencyMs !== null ? ` ${t.latencyMs}ms` : ""}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="ps-6 text-xs text-rose-600 dark:text-rose-300/80">{r.error ?? "پاسخی دریافت نشد"}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* dead-dns hint */}
                      {tone === "dead" && (
                        <p className="border-t border-border bg-rose-500/5 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-300/80">
                          {isPrivateIp(res.dns)
                            ? "این DNS با آی‌پی داخلی (خصوصی) ایرانشه و فقط از داخل شبکه‌های ایران پاسخ میده — از سرورِ تست قابل بررسی نیست. برای امتحانش، روی کنسول/روتر خودت ستش کن."
                            : "احتمال‌ها: آی‌پی اشتباهه، پورت ۵۳ بسته‌ست، این سرویس فقط به IP ایران جواب میده، یا سرویس خاموشه (بخش نکات پایین صفحه رو ببین)."}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
