import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudentTemp — Disposable Email for Students & Developers",
  description:
    "Privacy-first temporary email. Generate a disposable inbox in seconds, receive verification codes, protect your real address. No sign-up, no tracking.",
  keywords: [
    "temporary email", "disposable email", "temp mail", "student email",
    "OTP verification", "burner email", "anonymous email", "StudentTemp",
  ],
  authors: [{ name: "StudentTemp" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudentTemp",
  },
  openGraph: {
    title: "StudentTemp — Disposable Email for Students",
    description: "Generate a disposable inbox in seconds. Privacy-first, no tracking.",
    siteName: "StudentTemp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudentTemp — Disposable Email",
    description: "Generate a disposable inbox in seconds. Privacy-first, no tracking.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          <QueryProvider>
            {children}
            <Toaster richColors closeButton position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
