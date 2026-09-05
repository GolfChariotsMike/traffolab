import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | Traffolyte Labels Perth WA`,
    template: `%s`,
  },
  description:
    "Traffolyte (engraving laminate) labels for Perth trades and businesses. Design online, engraved in WA. Stik Stickers group.",
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
