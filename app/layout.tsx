import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Devanagari } from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Two families. Geist does Latin display type and numerals; Noto Sans Devanagari does
// Hindi (and Latin fallback). Noto has no 800 weight here, so bold is the heaviest.
const latin = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const hindi = Noto_Sans_Devanagari({
  variable: "--font-sans-hi",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} · संभल`,
  description: "हर पेमेंट से बचत। Save from every payout.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17593B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body className={`${latin.variable} ${hindi.variable} antialiased`}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
