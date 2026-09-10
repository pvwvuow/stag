"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GAME_PRESETS, getPreset } from "@/lib/games";
import { DNS_CATALOG, type DnsGroup, type Reachability } from "@/lib/dns-catalog";
import { useToast } from "@/hooks/use-toast";

/* ------------------------------ types ------------------------------ */

export type ViewId = "dashboard" | "optimize" | "servers" | "settings" | "about";

export interface TcpResult {
  port: number;
  ok: boolean;
  latencyMs: number | null;
}

export interface DomainResult {
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

export interface ApiResult {
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

/** Per-IP ping result — `ms` is the game-realistic RTT (TCP handshake, fallback: DNS query). */
export interface SweepResult {
  ok: boolean;
  ms: number | null;
  dnsMs: number | null;
  tcpMs: number | null;
  tcpOk: boolean | null;
}

export interface HistoryPoint {
  t: number;
  best: number | null;
  avg: number | null;
}

/** A DNS service = one name with (usually) two paired IPs. */
export interface ServiceMeta {
  id: string; // catalog id or "custom:<ip>"
  name: string;
  latin: string;
  cc: string;
  ips: string[];
  custom: boolean;
  group?: DnsGroup;
  reach?: Reachability;
}

export interface SysInterface {
  alias: string;
  servers: string[];
}

export interface SystemDnsState {
  loaded: boolean;
  supported: boolean;
  error: string | null;
  interfaces: SysInterface[];
  primary: SysInterface | null;
  on: boolean;
}

interface FullTestState {
  gameId: string | null;
  inProgress: boolean;
  /** flat list of IPs tested, tagged with their service id for grouping */
  order: Array<{ ip: string; sid: string }>;
  results: Record<string, ApiResult>;
}

interface StagState {
  activeServices: string[]; // service ids (catalog id or "custom:<ip>")
  customServers: string[]; // raw custom IPs
  selectedService: string | null;
  gameId: string | null;
  tcpEnabled: boolean;
}

const STATE_KEY = "stag.state.v3";
const LEGACY_V2_KEY = "stag.state.v2";
const LEGACY_V1_KEY = "stag.servers.v1";
export const MAX_SERVICES = 12;

const DEFAULT_ACTIVE = ["electro", "shecan", "google", "cloudflare", "quad9"];

const DEFAULT_STATE: StagState = {
  activeServices: DEFAULT_ACTIVE,
  customServers: [],
  selectedService: null,
  gameId: "marvel-rivals",
  tcpEnabled: true,
};

/* --------------------------- persistence --------------------------- */

function idsFromIps(ips: unknown, customServers: string[]): string[] {
  const known = new Map<string, string>();
  DNS_CATALOG.forEach((e) => e.ips.forEach((ip) => known.set(ip, e.id)));
  const ids: string[] = [];
  if (!Array.isArray(ips)) return ids;
  for (const raw of ips) {
    if (typeof raw !== "string") continue;
    const id = known.get(raw) ?? `custom:${raw}`;
    if (!ids.includes(id)) ids.push(id);
    if (id.startsWith("custom:") && !customServers.includes(id.slice(7))) {
      customServers.push(id.slice(7));
    }
  }
  return ids;
}

function loadState(): StagState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StagState>;
      const base: StagState = {
        ...DEFAULT_STATE,
        ...parsed,
        activeServices: Array.isArray(parsed.activeServices)
          ? parsed.activeServices.slice(0, MAX_SERVICES)
          : DEFAULT_ACTIVE,
        customServers: Array.isArray(parsed.customServers) ? parsed.customServers : [],
      };
      // keep custom pseudo-services consistent
      idsFromIps(
        base.activeServices.map((id) => (id.startsWith("custom:") ? id.slice(7) : null)),
        base.customServers,
      );
      return base;
    }
    // v2 -> v3: activeServers was a flat IP list
    const v2raw = localStorage.getItem(LEGACY_V2_KEY);
    if (v2raw) {
      const v2 = JSON.parse(v2raw) as { activeServers?: unknown; customServers?: unknown; gameId?: string; tcpEnabled?: boolean };
      const customServers: string[] = Array.isArray(v2.customServers) ? v2.customServers : [];
      const activeServices = idsFromIps(v2.activeServers, customServers).slice(0, MAX_SERVICES);
      if (activeServices.length > 0) {
        return {
          activeServices,
          customServers,
          selectedService: null,
          gameId: typeof v2.gameId === "string" ? v2.gameId : DEFAULT_STATE.gameId,
          tcpEnabled: v2.tcpEnabled ?? true,
        };
      }
    }
    // v1 -> v3: plain IP array
    const v1raw = localStorage.getItem(LEGACY_V1_KEY);
    if (v1raw) {
      const arr = JSON.parse(v1raw);
      if (Array.isArray(arr)) {
        const customServers: string[] = [];
        const activeServices = idsFromIps(arr, customServers).slice(0, MAX_SERVICES);
        return { ...DEFAULT_STATE, activeServices, customServers };
      }
    }
  } catch {
    /* noop */
  }
  return DEFAULT_STATE;
}

/* ---------------------------- context ------------------------------ */

interface StagContextValue extends StagState {
  view: ViewId;
  setView: (v: ViewId) => void;
  sweeping: boolean;
  sweepResults: Record<string, SweepResult>; // keyed by IP
  history: HistoryPoint[];
  fullTest: FullTestState;
  services: ServiceMeta[]; // active services, in activation order
  metaFor: (id: string | null | undefined) => ServiceMeta | null;
  bestService: { id: string; ms: number } | null;
  setActiveServices: (ids: string[]) => void;
  toggleService: (id: string) => void;
  addCustomServer: (ip: string) => boolean;
  removeCustomServer: (ip: string) => void;
  selectService: (id: string | null) => void;
  setGameId: (id: string | null) => void;
  setTcpEnabled: (v: boolean) => void;
  runSweep: () => void;
  runFullTest: () => void;
  /* system DNS */
  dnsSys: SystemDnsState;
  dnsAction: null | "apply" | "off" | "flush";
  sysMatch: ServiceMeta | null; // catalog match for the ACTIVE system DNS (null => manual)
  refreshDns: () => Promise<void>;
  connectDns: (serviceId?: string) => Promise<void>;
  disconnectDns: () => Promise<void>;
  flushDns: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

const StagContext = createContext<StagContextValue | null>(null);

export function StagProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [view, setView] = useState<ViewId>("dashboard");
  const [state, setState] = useState<StagState>(DEFAULT_STATE);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResults, setSweepResults] = useState<Record<string, SweepResult>>({});
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [fullTest, setFullTest] = useState<FullTestState>({
    gameId: null,
    inProgress: false,
    order: [],
    results: {},
  });
  const [dnsSys, setDnsSys] = useState<SystemDnsState>({
    loaded: false,
    supported: true,
    error: null,
    interfaces: [],
    primary: null,
    on: false,
  });
  const [dnsAction, setDnsAction] = useState<null | "apply" | "off" | "flush">(null);
  const hydrateRef = useRef(false);

  useEffect(() => {
    if (hydrateRef.current) return;
    hydrateRef.current = true;
    setState(loadState());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* noop */
    }
  }, [state]);

  /* -------------------------- services --------------------------- */

  const metaFor = useCallback(
    (id: string | null | undefined): ServiceMeta | null => {
      if (!id) return null;
      if (id.startsWith("custom:")) {
        const ip = id.slice(7);
        if (!state.customServers.includes(ip)) return null;
        return { id, name: "سرور دلخواه", latin: ip, cc: "ir", ips: [ip], custom: true };
      }
      const e = DNS_CATALOG.find((x) => x.id === id);
      if (!e) return null;
      return {
        id: e.id,
        name: e.name,
        latin: e.latin,
        cc: e.cc,
        ips: e.ips,
        custom: false,
        group: e.group,
        reach: e.reach,
      };
    },
    [state.customServers],
  );

  const services = useMemo(
    () => state.activeServices.map((id) => metaFor(id)).filter(Boolean) as ServiceMeta[],
    [state.activeServices, metaFor],
  );

  const patch = useCallback((p: Partial<StagState>) => setState((s) => ({ ...s, ...p })), []);

  const setActiveServices = useCallback(
    (ids: string[]) => patch({ activeServices: ids.slice(0, MAX_SERVICES) }),
    [patch],
  );

  const toggleService = useCallback((id: string) => {
    setState((s) => {
      const has = s.activeServices.includes(id);
      if (has) {
        return {
          ...s,
          activeServices: s.activeServices.filter((x) => x !== id),
          selectedService: s.selectedService === id ? null : s.selectedService,
        };
      }
      if (s.activeServices.length >= MAX_SERVICES) return s;
      return { ...s, activeServices: [...s.activeServices, id] };
    });
  }, []);

  const addCustomServer = useCallback((ip: string) => {
    const clean = ip.trim();
    let ok = true;
    setState((s) => {
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(clean) || clean.split(".").some((p) => +p > 255)) {
        ok = false;
        return s;
      }
      const known = new Set(DNS_CATALOG.flatMap((e) => e.ips));
      if (known.has(clean) || s.customServers.includes(clean)) {
        ok = false;
        return s;
      }
      const customServers = [...s.customServers, clean];
      const activeServices =
        s.activeServices.length < MAX_SERVICES && !s.activeServices.includes(`custom:${clean}`)
          ? [...s.activeServices, `custom:${clean}`]
          : s.activeServices;
      return { ...s, customServers, activeServices };
    });
    return ok;
  }, []);

  const removeCustomServer = useCallback((ip: string) => {
    setState((s) => ({
      ...s,
      customServers: s.customServers.filter((x) => x !== ip),
      activeServices: s.activeServices.filter((x) => x !== `custom:${ip}`),
      selectedService:
        s.selectedService === `custom:${ip}` ? null : s.selectedService,
    }));
  }, []);

  const selectService = useCallback((id: string | null) => patch({ selectedService: id }), [patch]);
  const setGameId = useCallback((id: string | null) => patch({ gameId: id }), [patch]);
  const setTcpEnabled = useCallback((v: boolean) => patch({ tcpEnabled: v }), [patch]);

  /* ------------------------- ping sweep -------------------------- */

  const runSweep = useCallback(() => {
    if (sweeping) return;
    const metas = state.activeServices
      .map((id) => metaFor(id))
      .filter(Boolean) as ServiceMeta[];
    if (metas.length === 0) {
      toast({ title: "هیچ سرویسی فعال نیست", description: "از بخش سرورها حداقل یک DNS اضافه کن." });
      return;
    }
    const game = getPreset(state.gameId);
    const domain = game?.domains[0]; // game-realistic probe target
    setSweeping(true);
    setSweepResults({});

    const jobs = metas.flatMap((m) => m.ips.map((ip) => ({ ip, sid: m.id })));
    let done = 0;
    const collected: Record<string, SweepResult> = {};
    const apply = (ip: string, r: SweepResult) => {
      collected[ip] = r;
      done += 1;
      setSweepResults({ ...collected });
      if (done === jobs.length) finish();
    };

    const finish = () => {
      let best: { id: string; ms: number } | null = null;
      const okMsAll: number[] = [];
      for (const m of metas) {
        const msList = m.ips
          .map((ip) => collected[ip])
          .filter((r): r is SweepResult & { ok: true; ms: number } => !!r?.ok && typeof r.ms === "number")
          .map((r) => r.ms);
        okMsAll.push(...msList);
        if (msList.length > 0) {
          const ms = Math.min(...msList);
          if (!best || ms < best.ms) best = { id: m.id, ms };
        }
      }
      const avg = okMsAll.length
        ? Math.round(okMsAll.reduce((a, b) => a + b, 0) / okMsAll.length)
        : null;
      setHistory((h) => [...h.slice(-39), { t: Date.now(), best: best ? best.ms : null, avg }]);
      if (best) {
        const bMeta = metaFor(best.id);
        setState((s) => ({ ...s, selectedService: best.id }));
        toast({
          title: "بهترین DNS پیدا شد",
          description: `${bMeta?.name ?? best.id} با ${best.ms} میلی‌ثانیه — پینگ واقعی برای ${game ? game.name : "اینترنت"}`,
        });
      } else {
        toast({
          title: "هیچ سروری پاسخ نداد",
          description: "اتصال اینترنت یا فایروال پورت ۵۳ را چک کن.",
        });
      }
      setSweeping(false);
    };

    jobs.forEach(({ ip }) => {
      fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: ip, domain, tcp: state.tcpEnabled }),
      })
        .then((r) => r.json())
        .then(
          (d: {
            ok?: boolean;
            ms?: number | null;
            dnsMs?: number | null;
            tcpMs?: number | null;
            tcpOk?: boolean | null;
          }) =>
            apply(ip, {
              ok: !!d.ok,
              ms: d.ok ? (d.ms ?? null) : null,
              dnsMs: d.dnsMs ?? null,
              tcpMs: d.tcpMs ?? null,
              tcpOk: d.tcpOk ?? null,
            }),
        )
        .catch(() => apply(ip, { ok: false, ms: null, dnsMs: null, tcpMs: null, tcpOk: null }));
    });
  }, [sweeping, state.activeServices, state.gameId, state.tcpEnabled, metaFor, toast]);

  /* ------------------------ full game test ----------------------- */

  const runFullTest = useCallback(() => {
    if (fullTest.inProgress) return;
    const game = getPreset(state.gameId);
    if (!game) {
      toast({ title: "اول یک بازی انتخاب کن", description: "از همین بخش یک بازی انتخاب کن." });
      return;
    }
    const metas = state.activeServices
      .map((id) => metaFor(id))
      .filter(Boolean) as ServiceMeta[];
    if (metas.length === 0) {
      toast({ title: "هیچ سرویسی فعال نیست", description: "از بخش سرورها حداقل یک DNS اضافه کن." });
      return;
    }
    const order = metas.flatMap((m) => m.ips.map((ip) => ({ ip, sid: m.id })));
    setFullTest({ gameId: game.id, inProgress: true, order, results: {} });

    order.forEach(({ ip }) => {
      fetch("/api/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dns: ip,
          domains: game.domains,
          tcpPorts: state.tcpEnabled ? game.tcpPorts : [],
        }),
      })
        .then((r) => r.json())
        .then((d: ApiResult & { error?: string }) => {
          setFullTest((f) => {
            if (!f.inProgress || d.error) return f;
            return { ...f, results: { ...f.results, [ip]: d } };
          });
        })
        .catch(() => {
          /* handled below */
        })
        .finally(() => {
          setFullTest((f) => {
            const results = { ...f.results };
            if (!results[ip]) {
              results[ip] = {
                dns: ip,
                baseline: "8.8.8.8",
                results: [],
                summary: { total: 0, resolved: 0, skipped: 0, avgLatency: null, routingActive: false },
              };
            }
            const stillRunning = order.some((o) => !results[o.ip]);
            return { ...f, results, inProgress: stillRunning };
          });
        });
    });
  }, [fullTest.inProgress, state.activeServices, state.gameId, state.tcpEnabled, metaFor, toast]);

  const bestService = useMemo(() => {
    let best: { id: string; ms: number } | null = null;
    for (const m of services) {
      const msList = m.ips
        .map((ip) => sweepResults[ip])
        .filter((r): r is SweepResult & { ok: true; ms: number } => !!r?.ok && typeof r.ms === "number")
        .map((r) => r.ms);
      if (msList.length === 0) continue;
      const ms = Math.min(...msList);
      if (!best || ms < best.ms) best = { id: m.id, ms };
    }
    return best;
  }, [services, sweepResults]);

  /* ------------------------- system DNS -------------------------- */

  const refreshDns = useCallback(async () => {
    try {
      const r = await fetch("/api/system-dns");
      const d = (await r.json()) as {
        ok?: boolean;
        supported?: boolean;
        error?: string;
        interfaces?: SysInterface[];
        primary?: SysInterface | null;
      };
      if (!d.ok) {
        setDnsSys((s) => ({ ...s, loaded: true, error: d.error ?? "خطا در تشخیص وضعیت" }));
        return;
      }
      if (!d.supported) {
        setDnsSys({
          loaded: true,
          supported: false,
          error: null,
          interfaces: [],
          primary: null,
          on: false,
        });
        return;
      }
      const primary = d.primary ?? null;
      setDnsSys({
        loaded: true,
        supported: true,
        error: null,
        interfaces: d.interfaces ?? [],
        primary,
        on: (primary?.servers?.length ?? 0) > 0,
      });
    } catch {
      setDnsSys((s) => ({ ...s, loaded: true, error: "ارتباط با هسته برقرار نشد" }));
    }
  }, []);

  useEffect(() => {
    refreshDns();
    const iv = setInterval(refreshDns, 30000);
    return () => clearInterval(iv);
  }, [refreshDns]);

  /** If the active system DNS belongs to a known service, that service; otherwise manual. */
  const sysMatch = useMemo<ServiceMeta | null>(() => {
    const first = dnsSys.primary?.servers?.[0];
    if (!first) return null;
    const e = DNS_CATALOG.find((x) => x.ips.includes(first));
    return e ? metaFor(e.id) : null;
  }, [dnsSys.primary, metaFor]);

  const connectDns = useCallback(
    async (serviceId?: string) => {
      if (dnsAction) return;
      const target =
        serviceId ?? state.selectedService ?? bestService?.id ?? state.activeServices[0] ?? null;
      if (!target) {
        toast({ title: "سرویسی برای وصل کردن نیست", description: "اول از بخش سرورها یک DNS فعال کن." });
        return;
      }
      const meta = metaFor(target);
      if (!meta) return;
      if (!dnsSys.supported) {
        toast({
          title: "پشتیبانی نمی‌شود",
          description: "تغییر DNS سیستم فقط روی ویندوز فعال است.",
          variant: "destructive",
        });
        return;
      }
      setDnsAction("apply");
      try {
        const r = await fetch("/api/system-dns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply", ips: meta.ips }),
        });
        const d = (await r.json()) as { ok?: boolean; error?: string };
        await refreshDns();
        if (d.ok) {
          setState((s) => ({ ...s, selectedService: meta.id }));
          toast({
            title: "DNS وصل شد",
            description: `${meta.name} روی سیستم فعال شد — کش DNS هم پاک شد.`,
          });
          // verify real connectivity through the new DNS
          try {
            const c = await fetch("/api/ping", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ server: "system", tcp: false }),
            }).then((x) => x.json());
            if (c?.ok) {
              toast({
                title: "اتصال سالمه",
                description: `پاسخ از DNS جدید: ${c.ms} میلی‌ثانیه`,
              });
            } else {
              toast({
                title: "هشدار",
                description: "DNS ست شد ولی اینترنت جواب نداد — اینترنت یا فایروال را چک کن.",
                variant: "destructive",
              });
            }
          } catch {
            /* verification is best-effort */
          }
        } else {
          toast({
            title: "وصل نشد",
            description: d.error ?? "دسترسی مدیر (UAC) لازم است.",
            variant: "destructive",
          });
        }
      } catch {
        toast({ title: "خطا", description: "ارتباط با هسته برقرار نشد.", variant: "destructive" });
      } finally {
        setDnsAction(null);
      }
    },
    [dnsAction, state.selectedService, state.activeServices, bestService, metaFor, dnsSys.supported, refreshDns, toast],
  );

  const disconnectDns = useCallback(async () => {
    if (dnsAction) return;
    if (!dnsSys.supported) {
      toast({
        title: "پشتیبانی نمی‌شود",
        description: "تغییر DNS سیستم فقط روی ویندوز فعال است.",
        variant: "destructive",
      });
      return;
    }
    setDnsAction("off");
    try {
      const r = await fetch("/api/system-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "off" }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      await refreshDns();
      if (d.ok) {
        toast({
          title: "DNS خاموش شد",
          description: "DNS سیستم به حالت خودکار (DHCP) برگشت — کش هم پاک شد.",
        });
      } else {
        toast({
          title: "خاموش نشد",
          description: d.error ?? "دسترسی مدیر (UAC) لازم است.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "خطا", description: "ارتباط با هسته برقرار نشد.", variant: "destructive" });
    } finally {
      setDnsAction(null);
    }
  }, [dnsAction, dnsSys.supported, refreshDns, toast]);

  const flushDns = useCallback(async () => {
    setDnsAction("flush");
    try {
      const r = await fetch("/api/system-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flush" }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      toast(
        d.ok
          ? { title: "کش DNS پاک شد", description: "حالا آدرس‌ها دوباره از DNS فعالی گرفته می‌شن." }
          : { title: "پاک نشد", description: d.error ?? "خطای نامشخص", variant: "destructive" },
      );
    } catch {
      toast({ title: "خطا", description: "ارتباط با هسته برقرار نشد.", variant: "destructive" });
    } finally {
      setDnsAction(null);
    }
  }, [toast]);

  const checkConnection = useCallback(async () => {
    try {
      const d = (await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: "system", tcp: false }),
      }).then((x) => x.json())) as { ok?: boolean; ms?: number | null; domain?: string };
      if (d?.ok) {
        toast({
          title: "اینترنت وصل است",
          description: `پاسخ ${d.domain} از طریق DNS سیستم: ${d.ms} میلی‌ثانیه`,
        });
      } else {
        toast({
          title: "اینترنت جواب نمی‌دهد",
          description: "DNS فعلی یا مسیر اینترنت مشکل دارد.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "خطا", description: "ارتباط با هسته برقرار نشد.", variant: "destructive" });
    }
  }, [toast]);

  const value: StagContextValue = {
    ...state,
    view,
    setView,
    sweeping,
    sweepResults,
    history,
    fullTest,
    services,
    metaFor,
    bestService,
    setActiveServices,
    toggleService,
    addCustomServer,
    removeCustomServer,
    selectService,
    setGameId,
    setTcpEnabled,
    runSweep,
    runFullTest,
    dnsSys,
    dnsAction,
    sysMatch,
    refreshDns,
    connectDns,
    disconnectDns,
    flushDns,
    checkConnection,
  };

  return <StagContext.Provider value={value}>{children}</StagContext.Provider>;
}

export function useStag(): StagContextValue {
  const ctx = useContext(StagContext);
  if (!ctx) throw new Error("useStag must be used inside StagProvider");
  return ctx;
}

export { GAME_PRESETS, getPreset, DNS_CATALOG };
