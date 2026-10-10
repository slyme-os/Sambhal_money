import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Three weights only: body, emphasis, display numbers.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Rent and savings from daily earnings — for gig workers. Also in Hindi.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c831f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
