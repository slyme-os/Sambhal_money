import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Inter for Latin text and every number (tabular figures); Noto Sans Devanagari for
// Hindi. Inter has no Devanagari glyphs, so Hindi falls through to Noto automatically.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const deva = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} · संभल`,
  description: "हर पेमेंट से बचत। Save from every payment.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // The app has its own Hindi/English switch; machine translation garbles money copy.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17593B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi" translate="no" className="notranslate">
      <body className={`${inter.variable} ${deva.variable} antialiased`}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
