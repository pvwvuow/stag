/**
 * Curated DNS catalog for Iranian gamers (Persian) + well-known global DNS.
 * IPs collected from public 2025/2026 sources; services change IPs occasionally,
 * so users can always type their own.
 *
 * reachability note:
 *  - "iran-only"  => private/geo-restricted; will likely time out when tested from abroad
 *  - "geo"        => public IP but the service usually only answers Iranian IPs
 *  - "global"     => normally answers from anywhere
 */

import * as I18N from "./i18n";

export type DnsGroup = "ir-gaming" | "ir-general" | "global";
export type Reachability = "global" | "geo" | "iran-only";

export interface DnsEntry {
  id: string;
  name: string;
  latin: string;
  ips: string[];
  /** ISO country code -> public/flags/<cc>.svg */
  cc: string;
  group: DnsGroup;
  reach: Reachability;
  note?: string;
  /** English note (beta.5 i18n) */
  noteEn?: string;
}

export interface DnsGroupDef {
  id: DnsGroup;
  label: string;
  hint: string;
}

export const DNS_GROUPS: DnsGroupDef[] = [
  {
    id: "ir-gaming",
    label: "ایرانی — مخصوص گیم",
    hint: "سرویس‌های گیمینگ ایرانی؛ روی کنسول/روتر داخل ایران ست میشن",
  },
  {
    id: "ir-general",
    label: "ایرانی — رفع تحریم",
    hint: "برای دانلود و ورود به سرویس‌های تحریمی هم کاربرد دارن",
  },
  {
    id: "global",
    label: "جهانی — معروف",
    hint: "پاسخ از همه‌جا؛ البته در ایران بعضی ISPها به ۸.۸.۸.۸ و ۱.۱.۱.۱ دخالت میکنن",
  },
];

export const DNS_CATALOG: DnsEntry[] = [
  /* ---------- Iran — gaming ---------- */
  {
    id: "radar-game",
    name: "رادار گیم",
    latin: "Radar Game",
    ips: ["10.202.10.10", "10.202.10.11"],
    cc: "ir",
    group: "ir-gaming",
    reach: "iran-only",
    note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
    noteEn: "Iran-internal IP — answers only inside Iranian networks; untestable from external test servers",
  },
  {
    id: "vanilla",
    name: "وانیلا",
    latin: "Vanilla",
    ips: ["10.139.177.21", "10.139.177.22"],
    cc: "ir",
    group: "ir-gaming",
    reach: "iran-only",
    note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
  },
  {
    id: "electro",
    name: "الکترو",
    latin: "Electro",
    ips: ["78.157.42.100", "78.157.42.101"],
    cc: "ir",
    group: "ir-gaming",
    reach: "global",
    note: "از اکثر نقاط دنیا هم پاسخ میده",
    noteEn: "Answers from most of the world too",
  },
  {
    id: "zeus",
    name: "زئوس",
    latin: "Zeus",
    ips: ["37.32.5.60", "37.32.5.61"],
    cc: "ir",
    group: "ir-gaming",
    reach: "geo",
    note: "معمولاً فقط به IPهای ایران جواب میده",
    noteEn: "Usually answers only Iranian IPs",
  },
  {
    id: "memo",
    name: "مِمو",
    latin: "Memo",
    ips: ["178.237.33.230", "178.237.33.231"],
    cc: "ir",
    group: "ir-gaming",
    reach: "geo",
    note: "DNS گیمینگ ایرانی؛ ممکنه فقط به IPهای ایران جواب بده",
    noteEn: "Iranian gaming DNS; may answer only Iranian IPs",
  },

  /* ---------- Iran — general / anti-sanction ---------- */
  {
    id: "shecan",
    name: "شکن",
    latin: "Shecan",
    ips: ["178.22.122.100", "185.51.200.2"],
    cc: "ir",
    group: "ir-general",
    reach: "geo",
    note: "معمولاً فقط به IPهای ایران جواب میده",
  },
  {
    id: "begzar",
    name: "بگذر",
    latin: "Begzar",
    ips: ["185.55.226.26", "185.55.225.25"],
    cc: "ir",
    group: "ir-general",
    reach: "geo",
    note: "ممکنه فقط به IPهای ایران جواب بده",
    noteEn: "May answer only Iranian IPs",
  },
  {
    id: "403",
    name: "۴۰۳ آنلاین",
    latin: "403.online",
    ips: ["10.202.10.202", "10.202.10.102"],
    cc: "ir",
    group: "ir-general",
    reach: "iran-only",
    note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
  },
  {
    id: "shatel",
    name: "شاتل",
    latin: "Shatel",
    ips: ["85.15.1.14", "85.15.1.15"],
    cc: "ir",
    group: "ir-general",
    reach: "geo",
    note: "DNS شرکت شاتل؛ ممکنه فقط به مشترکین خودش سرویس بده",
    noteEn: "Shatel ISP DNS; may serve only its own subscribers",
  },
  {
    id: "pishgaman",
    name: "پیشگامان",
    latin: "Pishgaman",
    ips: ["5.202.100.100", "5.202.100.101"],
    cc: "ir",
    group: "ir-general",
    reach: "geo",
    note: "DNS شرکت پیشگامان؛ ممکنه محدود به شبکه خودش باشه",
    noteEn: "Pishgaman ISP DNS; may be limited to its own network",
  },
  {
    id: "asiatech",
    name: "آسیاتک",
    latin: "Asiatech",
    ips: ["194.36.174.161", "194.36.174.162"],
    cc: "ir",
    group: "ir-general",
    reach: "geo",
    note: "DNS آسیاتک؛ معمولاً مختص شبکه خودشونه",
    noteEn: "Asiatech ISP DNS; usually specific to its own network",
  },

  /* ---------- Global ---------- */
  {
    id: "cloudflare",
    name: "کلادفلر",
    latin: "Cloudflare",
    ips: ["1.1.1.1", "1.0.0.1"],
    cc: "us",
    group: "global",
    reach: "global",
  },
  {
    id: "google",
    name: "گوگل",
    latin: "Google",
    ips: ["8.8.8.8", "8.8.4.4"],
    cc: "us",
    group: "global",
    reach: "global",
  },
  {
    id: "quad9",
    name: "کواد۹",
    latin: "Quad9",
    ips: ["9.9.9.9", "149.112.112.112"],
    cc: "ch",
    group: "global",
    reach: "global",
  },
  {
    id: "opendns",
    name: "اوپن‌دی‌ان‌اس",
    latin: "OpenDNS",
    ips: ["208.67.222.222", "208.67.220.220"],
    cc: "us",
    group: "global",
    reach: "global",
  },
  {
    id: "adguard",
    name: "ادگارد",
    latin: "AdGuard DNS",
    ips: ["94.140.14.14", "94.140.15.15"],
    cc: "cy",
    group: "global",
    reach: "global",
  },
  {
    id: "controld",
    name: "کنترل‌دی",
    latin: "Control D",
    ips: ["76.76.2.0", "76.76.10.0"],
    cc: "ca",
    group: "global",
    reach: "global",
  },
  {
    id: "dnswatch",
    name: "دی‌ان‌اس‌واچ",
    latin: "DNS.WATCH",
    ips: ["84.200.69.80", "84.200.70.40"],
    cc: "de",
    group: "global",
    reach: "global",
  },
  {
    id: "yandex",
    name: "یاندکس",
    latin: "Yandex DNS",
    ips: ["77.88.8.8", "77.88.8.1"],
    cc: "ru",
    group: "global",
    reach: "global",
  },
  {
    id: "mullvad",
    name: "مولواد",
    latin: "Mullvad DNS",
    ips: ["194.242.2.2"],
    cc: "se",
    group: "global",
    reach: "global",
  },
];

export function getCatalogEntry(ip: string): DnsEntry | undefined {
  return DNS_CATALOG.find((e) => e.ips.includes(ip));
}

export function reachLabel(reach: Reachability, lang: "fa" | "en" = "fa"): string {
  const t = (k: string) => I18N.makeT(lang)(k);
  switch (reach) {
    case "global":
      return t("reach.global");
    case "geo":
      return t("reach.geo");
    case "iran-only":
      return t("reach.iran");
  }
}

/** beta.5 — localized label/hint for a DNS group (labels live in i18n). */
export function groupLabel(id: DnsGroup, lang: "fa" | "en" = "fa"): string {
  const key = id === "ir-gaming" ? "group.irGaming" : id === "ir-general" ? "group.irGeneral" : "group.global";
  return I18N.makeT(lang)(key);
}

export function groupHint(id: DnsGroup, lang: "fa" | "en" = "fa"): string {
  const key = id === "ir-gaming" ? "group.irGamingHint" : id === "ir-general" ? "group.irGeneralHint" : "group.globalHint";
  return I18N.makeT(lang)(key);
}
