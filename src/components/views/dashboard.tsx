"use client";

import { useMemo, useState } from "react";
import {
  Power,
  Loader2,
  Timer,
  ArrowDown,
  ShieldCheck,
  Globe,
  Search,
  Check,
  Settings2,
  Activity,
} from "lucide-react";
import { useStag, DNS_CATALOG, type SweepResult } from "@/components/stag-store";
import { PingChart } from "@/components/ping-chart";
import { flagUrl, pingQuality } from "@/components/ui-helpers";

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

/* --------------------------- server list --------------------------- */

export interface ListRow {
  key: string;
  ip: string;
  latin: string;
  name: string;
  cc: string;
  enabled: boolean;
  sweep: SweepResult | undefined;
  custom: boolean;
}

export function useServerRows(): ListRow[] {
  const st = useStag();
  return useMemo<ListRow[]>(() => {
    const list: ListRow[] = DNS_CATALOG.map((e) => ({
      key: e.id,
      ip: e.ips[0],
      latin: e.latin,
      name: e.name,
      cc: e.cc,
      enabled: st.activeServers.includes(e.ips[0]),
      sweep: st.sweepResults[e.ips[0]],
      custom: false,
    }));
    for (const ip of st.customServers) {
      list.push({
        key: `custom-${ip}`,
        ip,
        latin: ip,
        name: ip,
        cc: "ir",
        enabled: st.activeServers.includes(ip),
        sweep: st.sweepResults[ip],
        custom: true,
      });
    }
    const rank = (r: ListRow) =>
      (r.sweep?.ok ? r.sweep.ms ?? 9999 : r.sweep ? 100000 : 50000) + (r.enabled ? 0 : 1000000);
    return list.sort((a, b) => rank(a) - rank(b));
  }, [st.activeServers, st.customServers, st.sweepResults]);
}

export function ServerRow({
  row,
  selected,
  onSelect,
}: {
  row: ListRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition-colors ${
        selected
          ? "border-primary/60 bg-primary/[0.07] shadow-[0_0_0_1px] shadow-primary/30"
          : "border-transparent hover:bg-muted/60"
      }`}
    >
      <FlagCircle cc={row.cc} size="h-8 w-8" />
      <span className="min-w-0 flex-1">
        <span className="ltr block truncate text-sm font-bold text-foreground">{row.latin}</span>
        <span className="block truncate text-[10px] text-muted-foreground" dir="rtl">
          {row.custom ? "سرور دلخواه" : row.name}
        </span>
      </span>
      <span
        className={`ltr text-xs font-bold ${row.sweep?.ok ? "text-foreground" : "text-muted-foreground"}`}
      >
        {row.sweep ? (row.sweep.ok ? `${row.sweep.ms} ms` : "—") : "—"}
      </span>
      <SignalBars ms={row.sweep?.ok ? row.sweep.ms : null} />
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${row.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
        title={row.enabled ? "فعال در تست‌ها" : "غیرفعال — از بخش سرورها فعالش کن"}
      />
    </button>
  );
}

/* ----------------------------- dashboard ---------------------------- */

export function Dashboard() {
  const st = useStag();
  const [query, setQuery] = useState("");
  const rows = useServerRows();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.latin.toLowerCase().includes(q) || r.name.includes(q) || r.ip.includes(q),
    );
  }, [rows, query]);

  const selected = useMemo(() => {
    if (!st.selectedServer) return null;
    const cat = DNS_CATALOG.find((e) => e.ips.includes(st.selectedServer!));
    const custom = st.customServers.includes(st.selectedServer);
    const sweep = st.sweepResults[st.selectedServer];
    return {
      ip: st.selectedServer,
      latin: cat?.latin ?? st.selectedServer,
      name: cat?.name ?? (custom ? "سرور دلخواه" : st.selectedServer),
      cc: cat?.cc ?? "ir",
      ms: sweep?.ok ? sweep.ms : null,
    };
  }, [st.selectedServer, st.customServers, st.sweepResults]);

  const okCount = Object.values(st.sweepResults).filter((r) => r.ok).length;
  const totalCount = Object.keys(st.sweepResults).length;
  const okEntries = Object.values(st.sweepResults).filter(
    (r): r is { ok: true; ms: number } => r.ok && typeof r.ms === "number",
  );
  const best = okEntries.length ? Math.min(...okEntries.map((r) => r.ms)) : null;
  const avg = okEntries.length
    ? Math.round(okEntries.reduce((a, r) => a + r.ms, 0) / okEntries.length)
    : null;
  const improvement =
    best !== null && avg !== null && avg > 0 && avg > best
      ? Math.round(((avg - best) / avg) * 100)
      : null;
  const stability =
    totalCount === 0
      ? { label: "—", cls: "text-muted-foreground" }
      : okCount === totalCount
        ? { label: "عالی", cls: "text-emerald-600 dark:text-emerald-400" }
        : okCount >= totalCount * 0.6
          ? { label: "خوب", cls: "text-primary" }
          : { label: "ضعیف", cls: "text-rose-600 dark:text-rose-400" };

  const statusLine = st.sweeping
    ? "در حال تست همزمان سرورها..."
    : st.bestServer
      ? "بهینه‌سازی انجام شد — بهترین DNS پیدا شد"
      : "آماده بهینه‌سازی";

  return (
    <div className="flex h-full min-h-0 gap-4 overflow-y-auto p-4 pt-1" dir="rtl">
      {/* aux column (visual right in RTL) */}
      <aside className="hidden w-[320px] shrink-0 flex-col gap-4 xl:flex">
        {/* selected server */}
        <section className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-primary" />
              سرور انتخابی
            </h2>
            <button
              onClick={() => st.setView("servers")}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              تعویض سرور
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {selected ? (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <div className="flex items-center gap-3">
                <FlagCircle cc={selected.cc} />
                <div className="min-w-0 flex-1">
                  <p className="ltr truncate text-sm font-black">{selected.latin}</p>
                  <p className="truncate text-[10px] text-muted-foreground" dir="rtl">
                    {selected.name}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SignalBars ms={selected.ms} />
                  Ping:
                </span>
                {selected.ms !== null ? (
                  <span className="ltr text-sm font-black text-primary">{selected.ms} ms</span>
                ) : (
                  <span className="text-xs text-muted-foreground">تست نشده</span>
                )}
              </div>
              <p className="ltr mt-2 rounded-lg bg-muted/60 px-2 py-1 text-center font-mono text-[11px] text-muted-foreground">
                {selected.ip}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-center text-xs leading-relaxed text-muted-foreground">
              هنوز سروری انتخاب نشده
              <br />
              یک تست بگیر تا بهترینش خودکار انتخاب بشه
            </div>
          )}
        </section>

        {/* server list */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/70 p-4">
          <h2 className="mb-3 text-sm font-bold">لیست سرورها</h2>
          <div className="relative mb-2.5">
            <Search className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی سرور..."
              className="h-9 w-full rounded-full border border-input bg-background/70 pe-8 ps-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
            />
          </div>
          <div className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
            {filtered.map((r) => (
              <ServerRow
                key={r.key}
                row={r}
                selected={st.selectedServer === r.ip}
                onSelect={() => st.selectServer(r.ip)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">چیزی پیدا نشد</p>
            )}
          </div>
        </section>

        {/* benefits */}
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-primary" />
            مزایای STAG
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-foreground/85">
            {[
              "تست همزمان چندین DNS بدون باز کردن بازی",
              "پیدا کردن سریع‌ترین سرور با یک کلیک",
              "بررسی مسیر اختصاصی و پورت‌های بازی",
              "کاملاً آفلاین — تست از اینترنت خودت",
              "سازگار با کنسول، PC و روتر",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {/* center column */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-xl space-y-4">
          {/* status header */}
          <div className="pt-1 text-center">
            <h1 className="text-lg font-black">وضعیت اتصال</h1>
            <p className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${
                  st.sweeping
                    ? "animate-pulse bg-amber-400"
                    : st.bestServer
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40"
                }`}
              />
              {statusLine}
            </p>
          </div>

          {/* power button */}
          <div className="flex flex-col items-center py-2">
            <button
              onClick={st.runSweep}
              disabled={st.sweeping}
              aria-label={st.sweeping ? "در حال تست" : "شروع بهینه‌سازی"}
              className={`power-btn group ${st.sweeping ? "is-sweeping" : ""}`}
            >
              <span className="power-core">
                {st.sweeping ? (
                  <Loader2 className="h-9 w-9 animate-spin text-white" />
                ) : (
                  <Power className="h-9 w-9 text-white" strokeWidth={2.5} />
                )}
              </span>
            </button>
            <span
              className={`mt-4 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                st.sweeping
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : st.bestServer
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-primary/10 text-primary"
              }`}
            >
              {st.sweeping
                ? "در حال سنجش پینگ سرورها"
                : st.bestServer
                  ? `بهترین: ${st.bestServer.ms} میلی‌ثانیه`
                  : "برای شروع، دکمه را بزن"}
            </span>
          </div>

          {/* stats trio */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Timer className="h-3.5 w-3.5" />}
              label="پینگ فعلی"
              value={best !== null ? <span className="ltr">{best} ms</span> : "—"}
              sub={avg !== null ? <span className="ltr">میانگین: {avg} ms</span> : "هنوز تستی نرفته"}
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
              sub={totalCount > 0 ? `${okCount} از ${totalCount} سرور پاسخ داد` : "—"}
            />
          </div>

          {/* chart */}
          <section className="rounded-2xl border border-border bg-card/70 p-4">
            <h2 className="mb-2 text-sm font-bold">نمودار پینگ</h2>
            <PingChart history={st.history} />
          </section>

          {/* quick full test hint */}
          <p className="pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            این فقط پینگ سرورهای DNS را می‌سنجد — برای تست کامل دامنه‌ها و پورت‌های یک بازی به
            <button
              onClick={() => st.setView("optimize")}
              className="mx-1 font-bold text-primary hover:underline"
            >
              بهینه‌سازی پینگ
            </button>
            برو.
          </p>
        </div>
      </div>
    </div>
  );
}
