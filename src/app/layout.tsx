import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/categories";
import { getSiteUrl } from "@/lib/seo/site-url";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = getSiteUrl();
const defaultTitle = `${APP_NAME} — ${APP_TAGLINE}`;
const defaultDescription =
  "FinBrief delivers finance, startup, and market news as quick AI summaries — professional, trustworthy, and easy to read on mobile.";

export const metadata: Metadata = {
  title: {
    default: defaultTitle,
    template: `%s · ${APP_NAME}`,
  },
  description: defaultDescription,
  metadataBase: new URL(siteUrl),
  applicationName: APP_NAME,
  keywords: [
    "finance news",
    "market news",
    "startup news",
    "fintech",
    "AI business",
    "investing",
    "economy",
  ],
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    url: siteUrl,
    siteName: APP_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
