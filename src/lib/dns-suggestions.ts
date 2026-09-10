/**
 * Curated DNS suggestions for Iranian gamers (Persian) + well-known global DNS.
 * IPs collected from public 2025/2026 sources; services change IPs occasionally,
 * so users can always type their own.
 *
 * reachability note:
 *  - "iran-only"  => private/geo-restricted; will likely time out when tested from abroad
 *  - "geo"        => public IP but the service usually only answers Iranian IPs
 *  - "global"     => normally answers from anywhere
 */

export type DnsSuggestionGroup = "ir-gaming" | "ir-general" | "global";
export type Reachability = "global" | "geo" | "iran-only";

export interface DnsSuggestion {
  name: string;
  latin: string;
  ips: string[];
  note?: string;
  reach: Reachability;
}

export interface SuggestionGroup {
  id: DnsSuggestionGroup;
  label: string;
  hint: string;
  suggestions: DnsSuggestion[];
}

export const DNS_SUGGESTIONS: SuggestionGroup[] = [
  {
    id: "ir-gaming",
    label: "ایرانی — مخصوص گیم",
    hint: "سرویس‌های گیمینگ ایرانی؛ روی کنسول/روتر داخل ایران ست میشن",
    suggestions: [
      {
        name: "رادار گیم",
        latin: "Radar Game",
        ips: ["10.202.10.10", "10.202.10.11"],
        note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
        reach: "iran-only",
      },
      {
        name: "وانیلا",
        latin: "Vanilla",
        ips: ["10.139.177.21", "10.139.177.22"],
        note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
        reach: "iran-only",
      },
      {
        name: "الکترو",
        latin: "Electro",
        ips: ["78.157.42.100", "78.157.42.101"],
        note: "از اکثر نقاط دنیا هم پاسخ میده",
        reach: "global",
      },
      {
        name: "زئوس",
        latin: "Zeus",
        ips: ["37.32.5.60", "37.32.5.61"],
        note: "معمولاً فقط به IPهای ایران جواب میده",
        reach: "geo",
      },
    ],
  },
  {
    id: "ir-general",
    label: "ایرانی — رفع تحریم و عمومی",
    hint: "برای دانلود و ورود به سرویس‌های تحریمی هم کاربرد دارن",
    suggestions: [
      {
        name: "شکن",
        latin: "Shecan",
        ips: ["178.22.122.100", "185.51.200.2"],
        note: "معمولاً فقط به IPهای ایران جواب میده",
        reach: "geo",
      },
      {
        name: "بگذر",
        latin: "Begzar",
        ips: ["185.55.226.26", "185.55.225.25"],
        note: "ممکنه فقط به IPهای ایران جواب بده",
        reach: "geo",
      },
      {
        name: "۴۰۳ آنلاین",
        latin: "403.online",
        ips: ["10.202.10.202", "10.202.10.102"],
        note: "آی‌پی داخلی ایران — فقط از داخل شبکه‌های ایران پاسخ میده؛ از سرور تست قابل بررسی نیست",
        reach: "iran-only",
      },
      {
        name: "شاتل",
        latin: "Shatel",
        ips: ["85.15.1.14", "85.15.1.15"],
        note: "DNS شرکت شاتل؛ ممکنه فقط به مشترکین خودش سرویس بده",
        reach: "geo",
      },
      {
        name: "پیشگامان",
        latin: "Pishgaman",
        ips: ["5.202.100.100", "5.202.100.101"],
        note: "DNS شرکت پیشگامان؛ ممکنه محدود به شبکه خودش باشه",
        reach: "geo",
      },
    ],
  },
  {
    id: "global",
    label: "خارجی — معروف",
    hint: "پاسخ از همه‌جا؛ البته در ایران بعضی ISPها به ۸.۸.۸.۸ و ۱.۱.۱.۱ دخالت میکنن",
    suggestions: [
      { name: "گوگل", latin: "Google", ips: ["8.8.8.8", "8.8.4.4"], reach: "global" },
      { name: "کلادفلر", latin: "Cloudflare", ips: ["1.1.1.1", "1.0.0.1"], reach: "global" },
      {
        name: "کواد۹",
        latin: "Quad9",
        ips: ["9.9.9.9", "149.112.112.112"],
        reach: "global",
      },
      {
        name: "اوپن‌دی‌ان‌اس",
        latin: "OpenDNS",
        ips: ["208.67.222.222", "208.67.220.220"],
        reach: "global",
      },
      {
        name: "ادگارد",
        latin: "AdGuard",
        ips: ["94.140.14.14", "94.140.15.15"],
        reach: "global",
      },
      {
        name: "یدکس",
        latin: "Yandex",
        ips: ["77.88.8.8", "77.88.8.1"],
        reach: "global",
      },
    ],
  },
];
