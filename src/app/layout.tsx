import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "STAG | Lower Ping • Better Play",
  description:
    "تستر سلامت DNS مخصوص گیم — تست همزمان چندین DNS، پیدا کردن سریع‌ترین سرور و بررسی دامنه‌ها و پورت‌های بازی، بدون باز کردن بازی.",
  icons: {
    icon: "/brand/stag.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint (day = white+cyan is the default) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("stag.theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
