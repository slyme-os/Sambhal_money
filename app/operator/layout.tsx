import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Fleet dashboard · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-surface">{children}</div>;
}
