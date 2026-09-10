"use client";

import { useMemo, useState } from "react";
import { Server, Plus, Trash2, Search, ShieldAlert, Globe2 } from "lucide-react";
import { useStag, DNS_CATALOG, MAX_SERVICES } from "@/components/stag-store";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FlagCircle, SignalBars } from "@/components/views/dashboard";
import { reachLabel } from "@/lib/dns-catalog";

const REACH_BADGE = {
  global: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  geo: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "iran-only": "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
} as const;

/** Per-IP mini status inside a service row — the two DNS of one service sit side by side. */
function IpChip({ ip, sweep }: { ip: string; sweep?: { ok: boolean; ms: number | null } }) {
  return (
    <span className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-1.5">
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
        <span className="text-[10px] text-muted-foreground/60">تست نشده</span>
      )}
    </span>
  );
}

function ServiceRow({ id }: { id: string }) {
  const st = useStag();
  const entry = DNS_CATALOG.find((e) => e.id === id);
  if (!entry) return null;
  const enabled = st.activeServices.includes(id);
  const canEnable = enabled || st.activeServices.length < MAX_SERVICES;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
      <FlagCircle cc={entry.cc} />
      <div className="min-w-0 flex-1 basis-52">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold" dir="rtl">
            {entry.name}
          </p>
          <span className="ltr text-[11px] text-muted-foreground">{entry.latin}</span>
          {entry && (
            <Badge className={`border text-[10px] ${REACH_BADGE[entry.reach]}`}>
              {reachLabel(entry.reach)}
            </Badge>
          )}
        </div>
        {entry.note && <p className="mt-0.5 text-[10px] text-muted-foreground/80">{entry.note}</p>}
      </div>
      {/* both DNS addresses of the service, side by side */}
      <div className="flex flex-wrap gap-2">
        {entry.ips.map((ip) => (
          <IpChip key={ip} ip={ip} sweep={st.sweepResults[ip]} />
        ))}
      </div>
      <Switch
        checked={enabled}
        disabled={!canEnable}
        onCheckedChange={() => st.toggleService(id)}
        aria-label={enabled ? "غیرفعال کردن سرویس" : "فعال کردن سرویس"}
      />
    </div>
  );
}

function CustomRow({ ip }: { ip: string }) {
  const st = useStag();
  const id = `custom:${ip}`;
  const enabled = st.activeServices.includes(id);
  const canEnable = enabled || st.activeServices.length < MAX_SERVICES;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
      <FlagCircle cc="ir" />
      <div className="min-w-0 flex-1 basis-52">
        <p className="ltr font-mono text-sm font-bold">{ip}</p>
        <p className="text-[10px] text-muted-foreground">سرور دلخواه — از تنظیمات روتر/کنسول خودت</p>
      </div>
      <IpChip ip={ip} sweep={st.sweepResults[ip]} />
      <Switch
        checked={enabled}
        disabled={!canEnable}
        onCheckedChange={() => st.toggleService(id)}
        aria-label="تغییر وضعیت"
      />
      <button
        onClick={() => st.removeCustomServer(ip)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
        aria-label="حذف"
        title="حذف"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Servers() {
  const st = useStag();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (id: string) =>
      !q ||
      id.includes(q) ||
      DNS_CATALOG.find((e) => e.id === id)?.name.includes(query.trim()) ||
      DNS_CATALOG.find((e) => e.id === id)?.latin.toLowerCase().includes(q) ||
      DNS_CATALOG.find((e) => e.id === id)?.ips.some((ip) => ip.includes(q));
    return DNS_CATALOG.filter((e) => match(e.id));
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
      toast({ title: "سرور اضافه شد", description: `${ip} به لیست فعال‌ها هم اضافه شد.` });
      setInput("");
    } else {
      toast({
        title: "اضافه نشد",
        description: "آی‌پی نامعتبره یا قبلاً تو لیست هست.",
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
            سرورهای DNS
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            هر تعداد سرویس را فعال کن (تا {MAX_SERVICES} مورد) — هر سرویس با هر دو آی‌پی DNS خودش در
            تست‌ها همزمان و موازی سنجیده می‌شود.
          </p>
        </div>
        <Badge className="border border-primary/40 bg-primary/10 text-primary">
          {st.activeServices.length}/{MAX_SERVICES} فعال
        </Badge>
      </div>

      {/* add custom */}
      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h2 className="mb-2.5 text-sm font-bold">افزودن سرور دلخواه</h2>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="مثلاً 192.168.1.1 یا آی‌پی DNS دلخواه"
            dir="ltr"
            className="h-10 flex-1 rounded-xl border border-input bg-background/70 px-3 text-left font-mono text-sm outline-none placeholder:text-right placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-primary/60"
          />
          <button
            onClick={addCustom}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            افزودن
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          نکته: تست از سیستم خودت اجرا می‌شود؛ پس DNSهای داخلی ایران (مثل رادار گیم و وانیلا) هم
          واقعاً قابل سنجیدن — به شرطی که ISP مسیر UDP ۵۳ را بسته نباشد.
        </p>
      </section>

      {/* search */}
      <div className="relative">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو بین سرویس‌ها و آی‌پی‌ها..."
          className="h-10 w-full rounded-xl border border-input bg-background/70 pe-10 ps-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
      </div>

      {/* catalog groups */}
      {filteredGroups.map((e) => (
        <ServiceRow key={e.id} id={e.id} />
      ))}

      {/* custom servers */}
      {filteredCustom.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">سرورهای دلخواه</h2>
          {filteredCustom.map((ip) => (
            <CustomRow key={ip} ip={ip} />
          ))}
        </section>
      )}

      {/* reachability legend */}
      <section className="grid gap-2.5 pb-4 sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">قابل تست از همه‌جا</b> — این سرورها از هر اینترنتی پاسخ
            میدهن و نتیجه‌شون کاملاً قابل اعتماده.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">مخصوص IP ایران</b> — معمولاً فقط به درخواست‌های داخل ایران
            جواب میدن؛ از خارج «بدون پاسخ» طبیعیه.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">فقط داخل ایران</b> — آی‌پی داخلی دارن (10.x) و فقط از
            شبکه‌های ایران قابل استفاده‌ان.
          </p>
        </div>
      </section>
    </div>
  );
}
