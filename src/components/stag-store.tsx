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
import { DNS_CATALOG } from "@/lib/dns-catalog";
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

export interface SweepResult {
  ok: boolean;
  ms: number | null;
}

export interface HistoryPoint {
  t: number;
  best: number | null;
  avg: number | null;
}

interface FullTestState {
  gameId: string | null;
  inProgress: boolean;
  order: string[];
  results: Record<string, ApiResult>;
}

interface StagState {
  activeServers: string[];
  customServers: string[];
  selectedServer: string | null;
  gameId: string | null;
  tcpEnabled: boolean;
}

const STATE_KEY = "stag.state.v2";
const LEGACY_KEY = "stag.servers.v1";
export const MAX_SERVERS = 12;

const DEFAULT_ACTIVE = [
  "78.157.42.100", // Electro
  "178.22.122.100", // Shecan
  "8.8.8.8", // Google
  "1.1.1.1", // Cloudflare
  "9.9.9.9", // Quad9
];

const DEFAULT_STATE: StagState = {
  activeServers: DEFAULT_ACTIVE,
  customServers: [],
  selectedServer: null,
  gameId: "marvel-rivals",
  tcpEnabled: true,
};

function loadState(): StagState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StagState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        activeServers: Array.isArray(parsed.activeServers)
          ? parsed.activeServers.slice(0, MAX_SERVERS)
          : DEFAULT_ACTIVE,
        customServers: Array.isArray(parsed.customServers) ? parsed.customServers : [],
      };
    }
    // migrate legacy custom list
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr)) {
        const known = new Set(DNS_CATALOG.flatMap((e) => e.ips));
        const custom = arr.filter(
          (x): x is string => typeof x === "string" && !known.has(x),
        );
        const active = arr.filter((x): x is string => typeof x === "string");
        return { ...DEFAULT_STATE, activeServers: active.slice(0, MAX_SERVERS), customServers: custom };
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
  sweepResults: Record<string, SweepResult>;
  history: HistoryPoint[];
  fullTest: FullTestState;
  setActiveServers: (ips: string[]) => void;
  toggleServer: (ip: string) => void;
  addCustomServer: (ip: string) => boolean;
  removeCustomServer: (ip: string) => void;
  selectServer: (ip: string) => void;
  setGameId: (id: string | null) => void;
  setTcpEnabled: (v: boolean) => void;
  runSweep: () => void;
  runFullTest: () => void;
  bestServer: { ip: string; ms: number } | null;
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

  const patch = useCallback((p: Partial<StagState>) => setState((s) => ({ ...s, ...p })), []);

  const setActiveServers = useCallback(
    (ips: string[]) => patch({ activeServers: ips.slice(0, MAX_SERVERS) }),
    [patch],
  );

  const toggleServer = useCallback((ip: string) => {
    setState((s) => {
      const has = s.activeServers.includes(ip);
      if (has) {
        const next = s.activeServers.filter((x) => x !== ip);
        return {
          ...s,
          activeServers: next,
          selectedServer: s.selectedServer === ip ? null : s.selectedServer,
        };
      }
      if (s.activeServers.length >= MAX_SERVERS) return s;
      return { ...s, activeServers: [...s.activeServers, ip] };
    });
  }, []);

  const addCustomServer = useCallback(
    (ip: string) => {
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
        const activeServers =
          s.activeServers.length < MAX_SERVERS ? [...s.activeServers, clean] : s.activeServers;
        return { ...s, customServers, activeServers };
      });
      return ok;
    },
    [],
  );

  const removeCustomServer = useCallback((ip: string) => {
    setState((s) => ({
      ...s,
      customServers: s.customServers.filter((x) => x !== ip),
      activeServers: s.activeServers.filter((x) => x !== ip),
      selectedServer: s.selectedServer === ip ? null : s.selectedServer,
    }));
  }, []);

  const selectServer = useCallback((ip: string) => patch({ selectedServer: ip }), [patch]);
  const setGameId = useCallback((id: string | null) => patch({ gameId: id }), [patch]);
  const setTcpEnabled = useCallback((v: boolean) => patch({ tcpEnabled: v }), [patch]);

  /* ------------------------- ping sweep ------------------------- */

  const runSweep = useCallback(() => {
    if (sweeping) return;
    const servers = state.activeServers;
    if (servers.length === 0) {
      toast({ title: "هیچ سروری فعال نیست", description: "از بخش سرورها حداقل یک DNS اضافه کن." });
      return;
    }
    setSweeping(true);
    setSweepResults({});

    let done = 0;
    const collected: Record<string, SweepResult> = {};
    const apply = (ip: string, r: SweepResult) => {
      collected[ip] = r;
      done += 1;
      setSweepResults({ ...collected });
      if (done === servers.length) finish();
    };

    const finish = () => {
      const okEntries = Object.entries(collected).filter((e): e is [string, { ok: true; ms: number }] => e[1].ok && typeof e[1].ms === "number");
      const best = okEntries.sort((a, b) => a[1].ms - b[1].ms)[0] ?? null;
      const avg = okEntries.length
        ? Math.round(okEntries.reduce((a, [, v]) => a + v.ms, 0) / okEntries.length)
        : null;
      setHistory((h) => [...h.slice(-39), { t: Date.now(), best: best ? best[1].ms : null, avg }]);
      if (best) {
        setState((s) => ({ ...s, selectedServer: best[0] }));
        toast({
          title: "بهترین سرور پیدا شد",
          description: `${best[0]} با ${best[1].ms} میلی‌ثانیه — سریع‌ترین پاسخ بین ${servers.length} سرور`,
        });
      } else {
        toast({ title: "هیچ سروری پاسخ نداد", description: "اتصال اینترنت یا فایروال پورت ۵۳ را چک کن." });
      }
      setSweeping(false);
    };

    servers.forEach((ip) => {
      fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: ip }),
      })
        .then((r) => r.json())
        .then((d: { ok?: boolean; ms?: number | null }) =>
          apply(ip, { ok: !!d.ok, ms: d.ok ? (d.ms ?? null) : null }),
        )
        .catch(() => apply(ip, { ok: false, ms: null }));
    });
  }, [sweeping, state.activeServers, toast]);

  /* ------------------------ full game test ----------------------- */

  const runFullTest = useCallback(() => {
    if (fullTest.inProgress) return;
    const game = getPreset(state.gameId);
    if (!game) {
      toast({ title: "اول یک بازی انتخاب کن", description: "از بخش «بهینه‌سازی پینگ» یک بازی انتخاب کن." });
      setView("optimize");
      return;
    }
    const servers = state.activeServers;
    if (servers.length === 0) {
      toast({ title: "هیچ سروری فعال نیست", description: "از بخش سرورها حداقل یک DNS اضافه کن." });
      return;
    }
    setFullTest({ gameId: game.id, inProgress: true, order: servers, results: {} });

    servers.forEach((ip) => {
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
          /* leave missing; UI shows pending forever -> mark as failed */
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
            const stillRunning = servers.some((s) => !results[s]);
            return { ...f, results, inProgress: stillRunning };
          });
        });
    });
  }, [fullTest.inProgress, state.activeServers, state.gameId, state.tcpEnabled, toast]);

  const bestServer = useMemo(() => {
    const ok = Object.entries(sweepResults).filter(
      (e): e is [string, { ok: true; ms: number }] => e[1].ok && typeof e[1].ms === "number",
    );
    if (ok.length === 0) return null;
    const best = ok.sort((a, b) => a[1].ms - b[1].ms)[0];
    return { ip: best[0], ms: best[1].ms };
  }, [sweepResults]);

  const value: StagContextValue = {
    ...state,
    view,
    setView,
    sweeping,
    sweepResults,
    history,
    fullTest,
    setActiveServers,
    toggleServer,
    addCustomServer,
    removeCustomServer,
    selectServer,
    setGameId,
    setTcpEnabled,
    runSweep,
    runFullTest,
    bestServer,
  };

  return <StagContext.Provider value={value}>{children}</StagContext.Provider>;
}

export function useStag(): StagContextValue {
  const ctx = useContext(StagContext);
  if (!ctx) throw new Error("useStag must be used inside StagProvider");
  return ctx;
}

export { GAME_PRESETS, getPreset, DNS_CATALOG };
