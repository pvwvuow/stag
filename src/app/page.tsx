import { DnsChecker } from "@/components/dns-checker";
import { Titlebar } from "@/components/titlebar";
import { CheckCircle2, Route, XCircle, Info } from "lucide-react";

export default function Home() {
  return (
    <div className="app-bg flex min-h-screen flex-col">
      {/* Custom software titlebar (drag region + theme toggle + window controls) */}
      <Titlebar />

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8 space-y-8">
        {/* Hero note */}
        <section className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5">
          <p className="text-sm sm:text-base leading-relaxed text-foreground/90">
            آی‌پی DNSهایی که روی گیم ست کردی رو بده (یا از پیشنهادهای آماده ایرانی و خارجی انتخاب
            کن)، بازی/پلتفرمت رو انتخاب کن و تست بگیر. هر DNS مستقیم کوئری میشه (UDP ۵۳)، پینگش
            اندازه گرفته میشه، آی‌پی‌هایی که برای دامنه‌های بازی برمی‌گردونه با DNS معمولی مقایسه
            میشه و پورت‌های بازی هم چک میشن — همه‌چیز بدون اینکه بازی باز بشه.
          </p>
        </section>

        <DnsChecker />

        {/* Help section */}
        <section aria-labelledby="help-title" className="space-y-3">
          <h2 id="help-title" className="font-bold text-lg">
            نتیجه رو چطور بخونم؟
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  «DNS کار میکنه»
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                DNS زنده‌ست و برای همه دامنه‌های بازی جواب سالم داد. اگه روی کنسول هم ست شده باشه،
                بازی باید بتونه سرورها رو پیدا کنه.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Route className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-amber-700 dark:text-amber-300">
                  «مسیر اختصاصی»
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                آی‌پی‌هایی که این DNS میده با جواب DNSهای معمولی (گوگل و کلادفلر) فرق داره — در
                سرویس‌های گیمینگ یعنی ترافیکت از مسیر خودشون عبور میکنه. توجه: بعضی CDNها هم بسته به
                موقعیت، جواب متفاوت میدن، پس این نشانه رو به‌تنهایی معیار صددرصدی ندون.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h3 className="font-bold text-sm text-rose-700 dark:text-rose-300">
                  «DNS جواب نمیده»
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                هیچ پاسخی از سرور DNS نرسید: آی‌پی اشتباه تایپ شده، پورت ۵۳ بسته‌ست، سرور خاموشه،
                یا سرویس فقط به IP ایران جواب میده (نکته بعدی رو ببین).
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-bold text-sm text-foreground">نکته مهم</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                کوئری‌ها از سرورِ این ابزار ارسال میشن، نه از مودم خونه‌ت. بعضی سرویس‌های DNS گیم فقط
                به درخواست‌های داخل ایران جواب میدن — مخصوصاً DNSهای با آی‌پی داخلی مثل رادار گیم،
                وانیلا و ۴۰۳ که از بیرون اصلاً قابل تست نیستن و براشون «جواب نمیده» طبیعیه. برای
                اینا باید روی کنسول خودت امتحانشون کنی؛ برای بقیه، نتیجه‌ی سلامت DNS قابل اعتماده.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground">
          تستر DNS گیم — سلامت DNS، پینگ و مسیر سرورهای بازی، قبل از روشن کردن کنسول
        </div>
      </footer>
    </div>
  );
}
