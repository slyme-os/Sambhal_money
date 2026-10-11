import type { Metadata, Viewport } from "next";
import {
  Inter, Noto_Sans_Bengali, Noto_Sans_Devanagari, Noto_Sans_Kannada, Noto_Sans_Malayalam, Noto_Sans_Oriya,
  Noto_Sans_Tamil, Noto_Sans_Telugu,
} from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Inter for Latin text and every number (tabular figures); a Noto Sans family for each
// Indian script. Inter has no Indic glyphs, so each script falls through to its Noto
// font automatically. Only the script on screen is downloaded (unicode-range).
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
// next/font needs literal options (no spreads); preload: false = fetch only when used.
const kannada = Noto_Sans_Kannada({ variable: "--font-kn", subsets: ["kannada"], display: "swap", preload: false });
const tamil = Noto_Sans_Tamil({ variable: "--font-ta", subsets: ["tamil"], display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ variable: "--font-te", subsets: ["telugu"], display: "swap", preload: false });
const malayalam = Noto_Sans_Malayalam({ variable: "--font-ml", subsets: ["malayalam"], display: "swap", preload: false });
const bengali = Noto_Sans_Bengali({ variable: "--font-bn", subsets: ["bengali"], display: "swap", preload: false });
const oriya = Noto_Sans_Oriya({ variable: "--font-or", subsets: ["oriya"], display: "swap", preload: false });
const fontVars = [inter, deva, kannada, tamil, telugu, malayalam, bengali, oriya].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: `${APP_NAME} · संभल`,
  description: "हर पेमेंट से बचत। Save from every payment.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // The app has its own 8-language picker; machine translation garbles money copy.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html> so :root's --font-sans can resolve them.
    <html lang="hi" translate="no" className={`notranslate ${fontVars}`}>
      <body className="antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
