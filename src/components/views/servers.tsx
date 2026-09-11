"use client";

import { useMemo, useState } from "react";
import { Server, Plus, Trash2, Search, ShieldAlert, Globe2, Zap } from "lucide-react";
import { useStag, DNS_CATALOG, MAX_SERVICES } from "@/components/stag-store";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FlagCircle, SignalBars } from "@/components/views/dashboard";
import { reachLabel, groupLabel, groupHint, DNS_GROUPS, type DnsGroup } from "@/lib/dns-catalog";

const REACH_PILL = {
  global: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  geo: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "iran-only": "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
} as const;

const GROUP_ICON: Record<DnsGroup, React.ReactNode> = {
  "ir-gaming": <Zap className="h-3.5 w-3.5 text-primary" />,
  "ir-general": <Globe2 className="h-3.5 w-3.5 text-primary" />,
  global: <Globe2 className="h-3.5 w-3.5 text-primary" />,
};

/** Per-IP mini status inside a service row — the two DNS of one service sit side by side. */
function IpChip({ ip, sweep }: { ip: string; sweep?: { ok: boolean; ms: number | null } }) {
  const t = useStag().t;
  return (
    <span className="flex items-center gap-2 rounded-full bg-muted/60 px-2.5 py-1">
      <span className="ltr font-mono text-[11px] text-foreground/90">{ip}</span>
      {sweep ? (
        sweep.ok ? (
          <>
            <span className="ltr text-[11px] font-bold text-primary">{sweep.ms} ms</span>
            <SignalBars ms={sweep.ms} />
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">بی‌پاسخ</span>
        )
      ) : (
        <span className="text-[10px] text-muted-foreground/60">{t("srv.notTested")}</span>
      )}
    </span>
  );
}

function ServiceRow({ id }: { id: string }) {
  const st = useStag();
  const t = st.t;
  const entry = DNS_CATALOG.find((e) => e.id === id);
  if (!entry) return null;
  const enabled = st.activeServices.includes(id);
  const canEnable = enabled || st.activeServices.length < MAX_SERVICES;
  const isEn = st.lang === "en";
  const displayName = isEn ? entry.latin : entry.name;
  const subName = isEn ? entry.name : entry.latin;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <FlagCircle cc={entry.cc} />
      <div className="min-w-0 flex-1 basis-52">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold" dir="rtl">
            {displayName}
          </p>
          <span className="ltr text-[11px] text-muted-foreground">{subName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${REACH_PILL[entry.reach]}`}>
            {reachLabel(entry.reach, st.lang)}
          </span>
        </div>
        {(isEn ? entry.noteEn : entry.note) && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
            {isEn ? entry.noteEn : entry.note}
          </p>
        )}
      </div>
      {/* both DNS addresses of the service, side by side */}
      <div className="flex flex-wrap gap-1.5">
        {entry.ips.map((ip) => (
          <IpChip key={ip} ip={ip} sweep={st.sweepResults[ip]} />
        ))}
      </div>
      <Switch
        checked={enabled}
        disabled={!canEnable}
        onCheckedChange={() => st.toggleService(id)}
        aria-label={enabled ? t("srv.disable") : t("srv.enable")}
      />
    </div>
  );
}

function CustomRow({ ip }: { ip: string }) {
  const st = useStag();
  const t = st.t;
  const id = `custom:${ip}`;
  const enabled = st.activeServices.includes(id);
  const canEnable = enabled || st.activeServices.length < MAX_SERVICES;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <FlagCircle cc="ir" />
      <div className="min-w-0 flex-1 basis-52">
        <p className="ltr font-mono text-sm font-bold">{ip}</p>
        <p className="text-[10px] text-muted-foreground">{t("srv.customNote")}</p>
      </div>
      <IpChip ip={ip} sweep={st.sweepResults[ip]} />
      <Switch
        checked={enabled}
        disabled={!canEnable}
        onCheckedChange={() => st.toggleService(id)}
        aria-label={t("srv.toggle")}
      />
      <button
        onClick={() => st.removeCustomServer(ip)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
        aria-label={t("srv.remove")}
        title={t("srv.remove")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Servers() {
  const st = useStag();
  const t = st.t;
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (e: (typeof DNS_CATALOG)[number]) =>
      !q ||
      e.id.includes(q) ||
      e.name.includes(query.trim()) ||
      e.latin.toLowerCase().includes(q) ||
      e.ips.some((ip) => ip.includes(q));
    return DNS_CATALOG.filter(match);
  }, [query]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return st.customServers;
    return st.customServers.filter((ip) => ip.includes(q));
  }, [query, st.customServers]);

  const addCustom = () => {
    const ip = input.trim();
    if (!ip) return;
    const ok = st.addCustomServer(ip);
    if (ok) {
      toast({ title: t("srv.added"), description: t("srv.addedDesc", { ip }) });
      setInput("");
    } else {
      toast({
        title: t("srv.addFailed"),
        description: t("srv.addFailedDesc"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto p-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-black">
            <Server className="h-5 w-5 text-primary" />
            {t("srv.title")}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("srv.subtitle", { n: MAX_SERVICES })}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary ltr">
          {st.activeServices.length}/{MAX_SERVICES}
        </span>
      </div>

      {/* add custom */}
      <section className="panel p-4">
        <h2 className="mb-2.5 text-sm font-bold">{t("srv.addTitle")}</h2>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder={t("srv.addPlaceholder")}
            dir="ltr"
            className="h-10 flex-1 rounded-full border border-input bg-background/70 px-4 text-left font-mono text-sm outline-none placeholder:text-right placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-primary/60"
          />
          <button
            onClick={addCustom}
            className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("srv.add")}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {t("srv.tip")}
        </p>
      </section>

      {/* search */}
      <div className="relative">
        <Search className="absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("srv.search")}
          className="h-10 w-full rounded-full border border-input bg-background/70 pe-11 ps-4 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
      </div>

      {/* catalog — one organized panel per group, hairline-divided rows */}
      {DNS_GROUPS.map((group) => {
        const rows = filtered.filter((e) => e.group === group.id);
        if (rows.length === 0) return null;
        return (
          <section key={group.id} className="panel overflow-hidden">
            <div className="px-4 pb-1.5 pt-4">
              <h2 className="flex items-center gap-1.5 text-sm font-bold">
                {GROUP_ICON[group.id]}
                {groupLabel(group.id, st.lang)}
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{groupHint(group.id, st.lang)}</p>
            </div>
            <div className="divide-y divide-border/50 px-1.5 pb-1.5">
              {rows.map((e) => (
                <ServiceRow key={e.id} id={e.id} />
              ))}
            </div>
          </section>
        );
      })}

      {/* custom servers */}
      {filteredCustom.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="px-4 pb-1.5 pt-4">
            <h2 className="text-sm font-bold">{t("srv.customTitle")}</h2>
          </div>
          <div className="divide-y divide-border/50 px-1.5 pb-1.5">
            {filteredCustom.map((ip) => (
              <CustomRow key={ip} ip={ip} />
            ))}
          </div>
        </section>
      )}

      {/* reachability legend — one quiet strip */}
      <section className="panel overflow-hidden pb-4">
        <div className="grid gap-px bg-border/40 sm:grid-cols-3">
          <div className="flex items-start gap-2 bg-card/80 p-3.5">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <b className="text-foreground">{t("srv.legGlobal")}</b> — {t("srv.legGlobalBody")}
            </p>
          </div>
          <div className="flex items-start gap-2 bg-card/80 p-3.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <b className="text-foreground">{t("srv.legGeo")}</b> — {t("srv.legGeoBody")}
            </p>
          </div>
          <div className="flex items-start gap-2 bg-card/80 p-3.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <b className="text-foreground">{t("srv.legIran")}</b> — {t("srv.legIranBody")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
