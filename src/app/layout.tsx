import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "تستر DNS گیم | چک کردن سلامت DNS بازی‌ها",
  description:
    "بدون باز کردن بازی چک کن DNSهایی که روی گیم (کنسول/PC/روتر) ست کردی کار میکنن یا نه — با تست دامنه‌های PSN، Xbox، کالاف دیوتی، فورتنایت، EA و بیشتر.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint (dark = black+cyan is the default) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("gamedns.theme")==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
