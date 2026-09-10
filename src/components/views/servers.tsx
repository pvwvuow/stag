"use client";

import { useMemo, useState } from "react";
import { Server, Plus, Trash2, Search, ShieldAlert, Globe2 } from "lucide-react";
import { useStag, DNS_CATALOG, MAX_SERVERS } from "@/components/stag-store";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FlagCircle, SignalBars, useServerRows } from "@/components/views/dashboard";
import { reachLabel } from "@/lib/dns-catalog";

const REACH_BADGE = {
  global: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  geo: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "iran-only": "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
} as const;

function ServerManageRow({ ip }: { ip: string }) {
  const st = useStag();
  const entry = DNS_CATALOG.find((e) => e.ips.includes(ip));
  const row = useServerRows().find((r) => r.ip === ip);
  const enabled = st.activeServers.includes(ip);
  const canEnable = enabled || st.activeServers.length < MAX_SERVERS;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
      <FlagCircle cc={entry?.cc ?? "ir"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold" dir="rtl">
            {entry?.name ?? "سرور دلخواه"}
          </p>
          <span className="ltr text-[11px] text-muted-foreground">{entry?.latin ?? ip}</span>
          {entry && (
            <Badge className={`border text-[10px] ${REACH_BADGE[entry.reach]}`}>
              {reachLabel(entry.reach)}
            </Badge>
          )}
        </div>
        <p className="ltr mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {entry ? entry.ips.join("  ·  ") : ip}
        </p>
        {entry?.note && <p className="mt-0.5 text-[10px] text-muted-foreground/80">{entry.note}</p>}
      </div>
      <span className="hidden items-center gap-1.5 sm:flex">
        {row?.sweep ? (
          row.sweep.ok ? (
            <span className="ltr text-xs font-bold text-primary">{row.sweep.ms} ms</span>
          ) : (
            <span className="text-xs text-muted-foreground">بدون پاسخ</span>
          )
        ) : null}
        <SignalBars ms={row?.sweep?.ok ? row.sweep.ms : null} />
      </span>
      <Switch
        checked={enabled}
        disabled={!canEnable}
        onCheckedChange={() => st.toggleServer(ip)}
        aria-label={enabled ? "غیرفعال کردن" : "فعال کردن"}
      />
    </div>
  );
}

function CustomRow({ ip }: { ip: string }) {
  const st = useStag();
  const row = useServerRows().find((r) => r.ip === ip);
  const enabled = st.activeServers.includes(ip);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
      <FlagCircle cc="ir" />
      <div className="min-w-0 flex-1">
        <p className="ltr font-mono text-sm font-bold">{ip}</p>
        <p className="text-[10px] text-muted-foreground">سرور دلخواه — از تنظیمات روتر/کنسول خودت</p>
      </div>
      {row?.sweep ? (
        row.sweep.ok ? (
          <span className="ltr text-xs font-bold text-primary">{row.sweep.ms} ms</span>
        ) : (
          <span className="text-xs text-muted-foreground">بدون پاسخ</span>
        )
      ) : null}
      <SignalBars ms={row?.sweep?.ok ? row.sweep.ms : null} />
      <Switch checked={enabled} onCheckedChange={() => st.toggleServer(ip)} aria-label="تغییر وضعیت" />
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

  const allIps = useMemo(() => {
    const catalogFirstIps = DNS_CATALOG.map((e) => e.ips[0]);
    return [...catalogFirstIps, ...st.customServers];
  }, [st.customServers]);

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
            هر تعداد سرور را فعال کن (تا {MAX_SERVERS} مورد) — همه در هر تست همزمان و موازی سنجیده
            میشن. ترتیب فعال‌شدن = ترتیب اولویت.
          </p>
        </div>
        <Badge className="border border-primary/40 bg-primary/10 text-primary">
          {st.activeServers.length}/{MAX_SERVERS} فعال
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
          نکته: تست از سیستم خودت اجرا میشه؛ پس DNSهای داخلی ایران (مثل رادار گیم و وانیلا) هم
          واقعاً قابل سنجیدن — به شرطی که ISP مسیر UDP ۵۳ را بسته نباشه.
        </p>
      </section>

      {/* search */}
      <div className="relative">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو بین ۱۸ سرویس..."
          className="h-10 w-full rounded-xl border border-input bg-background/70 pe-10 ps-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
      </div>

      {/* catalog groups */}
      {filteredGroups.map((e) => (
        <ServerManageRow key={e.id} ip={e.ips[0]} />
      ))}

      {/* custom servers */}
      {st.customServers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">سرورهای دلخواه</h2>
          {st.customServers.map((ip) => (
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
            میدن و نتیجه‌شون کاملاً قابل اعتماده.
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
