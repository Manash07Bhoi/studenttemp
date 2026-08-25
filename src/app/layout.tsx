import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

// Font loading with display:swap for no FOIT
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Only preload the primary font
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1f1c" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "StudentTemp — Disposable Email for Students & Developers",
    template: "%s — StudentTemp",
  },
  description:
    "Privacy-first temporary email. Generate a disposable inbox in seconds, receive verification codes, protect your real address. No sign-up, no tracking. 47 domains across India and international.",
  keywords: [
    "temporary email", "disposable email", "temp mail", "student email",
    "OTP verification", "burner email", "anonymous email", "StudentTemp",
    "temp email India", "disposable inbox", "throwaway email",
  ],
  authors: [{ name: "Roshan" }],
  creator: "Roshan",
  manifest: "/manifest.json",
  applicationName: "StudentTemp",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudentTemp",
  },
  openGraph: {
    title: "StudentTemp — Disposable Email for Students",
    description: "Generate a disposable inbox in seconds. Privacy-first, no tracking. 47 domains.",
    siteName: "StudentTemp",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudentTemp — Disposable Email",
    description: "Generate a disposable inbox in seconds. Privacy-first, no tracking.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to font origin for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="http://localhost:3003" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {/* Skip-to-content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          <QueryProvider>
            <div id="main-content">{children}</div>
            <Toaster richColors closeButton position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
