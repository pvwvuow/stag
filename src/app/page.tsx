import { StagProvider } from "@/components/stag-store";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <StagProvider>
      <AppShell />
    </StagProvider>
  );
}
