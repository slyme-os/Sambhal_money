import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari } from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// One family for Hindi and English: Devanagari plus Latin, three weights.
const font = Noto_Sans_Devanagari({
  variable: "--font-sans-hi",
  subsets: ["devanagari", "latin"],
  weight: ["400", "600", "800"],
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
  themeColor: "#0E5C36",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body className={`${font.variable} antialiased`}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
