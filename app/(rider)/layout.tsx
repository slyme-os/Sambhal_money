import { RiderShell } from "@/components/RiderShell";
import { StoreProvider } from "@/components/StoreProvider";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <RiderShell>{children}</RiderShell>
    </StoreProvider>
  );
}
